"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, ApiError, AUTH_UNAUTHORIZED, AUTH_FORBIDDEN } from "@/lib/api";
import { GateButton } from "@/components/GateButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import * as haptics from "@/lib/haptics";
import toast from "react-hot-toast";

type FeedbackState = "idle" | "loading" | "success" | "error";

export default function HomePage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<FeedbackState>("idle");
    const [isOffline, setIsOffline] = useState(false);
    const [showThemeSettings, setShowThemeSettings] = useState(false);
    const settingsPanelRef = useRef<HTMLDivElement>(null);

    // Offline detection
    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOffline(!navigator.onLine);
        };

        updateOnlineStatus();
        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);

        return () => {
            window.removeEventListener("online", updateOnlineStatus);
            window.removeEventListener("offline", updateOnlineStatus);
        };
    }, []);

    // Click outside and ESC handling for theme settings panel
    useEffect(() => {
        if (!showThemeSettings) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
                setShowThemeSettings(false);
            }
        };

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setShowThemeSettings(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEsc);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [showThemeSettings]);

    const handleOpenGate = useCallback(async () => {
        if (status === "loading" || isOffline) return;

        haptics.light();
        setStatus("loading");

        try {
            await apiRequest("/gate/open", { method: "POST" });

            haptics.success();
            toast.success("השער נפתח ✅");
            setStatus("success");
            setTimeout(() => setStatus("idle"), 2000);
        } catch (err) {
            haptics.error();

            if (err instanceof ApiError) {
                if (err.message === AUTH_UNAUTHORIZED) {
                    toast.error("נדרש להתחבר מחדש");
                    setStatus("error");
                    setTimeout(() => router.push("/login"), 1500);
                    throw err; // Re-throw only for AUTH_UNAUTHORIZED to signal re-login requirement
                } else if (err.message === AUTH_FORBIDDEN) {
                    toast.error("אין לך הרשאה לפתוח שער");
                } else if (err.status === 409) {
                    toast.error("המשתמש מחובר כבר ממכשיר אחר");
                } else if (err.status && err.status >= 500) {
                    toast.error("אין תקשורת עם השרת, נסה שוב");
                } else {
                    toast.error(err.message || "שגיאה בפתיחת השער");
                }
            } else {
                toast.error("אין תקשורת עם השרת, נסה שוב");
            }

            // For recoverable errors, set error state and reset after 2s
            // Don't re-throw as they've already been handled with user feedback
            setStatus("error");
            setTimeout(() => setStatus("idle"), 2000);
        }
    }, [status, isOffline, router]);

    const isLoading = status === "loading";

    return (
        <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg)" }}>
            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center relative">
                        <button
                            onClick={() => setShowThemeSettings(!showThemeSettings)}
                            className={`absolute left-0 top-0 rounded-theme-md p-2 transition-colors ${
                                showThemeSettings ? "bg-surface-2" : "hover:bg-surface-2"
                            }`}
                            aria-label="הגדרות עיצוב"
                            aria-expanded={showThemeSettings}
                        >
                            <svg
                                className="w-5 h-5"
                                style={{ color: showThemeSettings ? "var(--primary)" : "var(--muted)" }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                            </svg>
                        </button>
                        {showThemeSettings && (
                            <div
                                ref={settingsPanelRef}
                                className="theme-panel absolute left-0 top-12 z-50 rounded-theme-md border border-theme bg-surface shadow-theme-lg p-4"
                            >
                                <ThemeSwitcher />
                            </div>
                        )}
                        <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
                            <span style={{ color: "var(--muted)", fontWeight: "var(--font-weight-normal)" }}>מצפה 6-8</span> • פתיחת שער חניה
                        </h1>
                        {user && (
                            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                                שלום, {user.email}
                            </p>
                        )}
                    </div>

                    <div className="space-y-6">
                        {isOffline && (
                            <div className="rounded-theme-md border px-4 py-3 text-center" style={{ backgroundColor: "var(--warning)", borderColor: "var(--warning)", opacity: 0.1 }}>
                                <p className="text-sm font-medium" style={{ color: "var(--warning)" }}>
                                    אין אינטרנט
                                </p>
                            </div>
                        )}

                        <GateButton
                            onOpen={handleOpenGate}
                            loading={isLoading}
                            disabled={isOffline}
                        />

                        {status === "success" && (
                            <div className="rounded-theme-md border px-4 py-3 text-center" style={{ backgroundColor: "var(--success)", borderColor: "var(--success)", opacity: 0.1 }}>
                                <p className="text-sm font-medium flex items-center justify-center gap-2" style={{ color: "var(--success)" }}>
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    נפתח בהצלחה
                                </p>
                            </div>
                        )}
                        {status === "loading" && (
                            <div className="text-center min-h-[24px] text-sm" style={{ color: "var(--muted)" }}>
                                פותח שער…
                            </div>
                        )}
                        {status === "error" && (
                            <div className="text-center min-h-[24px] text-sm" style={{ color: "var(--danger)" }}>
                                נכשל, נסה שוב
                            </div>
                        )}

                        <div className="flex gap-4">
                            {user?.role === "admin" && (
                                <a
                                    href="/admin"
                                    className="flex-1 rounded-theme-md px-4 py-3 text-center font-medium focus-theme"
                                    style={{
                                        backgroundColor: "var(--primary)",
                                        color: "var(--primary-contrast)",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "var(--primary-hover)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "var(--primary)";
                                    }}
                                >
                                    ניהול
                                </a>
                            )}
                            <button
                                onClick={logout}
                                className="flex-1 rounded-theme-md px-4 py-3 font-medium focus-theme"
                                style={{
                                    backgroundColor: "var(--danger)",
                                    color: "var(--primary-contrast)",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = "0.9";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = "1";
                                }}
                            >
                                התנתק
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

