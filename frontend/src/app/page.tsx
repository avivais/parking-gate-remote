"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, ApiError, AUTH_UNAUTHORIZED, AUTH_FORBIDDEN } from "@/lib/api";
import { GateButton } from "@/components/GateButton";
import * as haptics from "@/lib/haptics";
import toast from "react-hot-toast";

type FeedbackState = "idle" | "loading" | "success" | "error";

export default function HomePage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<FeedbackState>("idle");
    const [isOffline, setIsOffline] = useState(false);

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
        <div className="flex min-h-screen flex-col bg-gray-50">
            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900">
                            <span className="text-gray-500 font-normal">מצפה 6-8</span> • פתיחת שער חניה
                        </h1>
                        {user && (
                            <p className="mt-2 text-sm text-gray-600">
                                שלום, {user.email}
                            </p>
                        )}
                    </div>

                    <div className="space-y-6">
                        {isOffline && (
                            <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-center">
                                <p className="text-sm font-medium text-yellow-800">
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
                            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-center">
                                <p className="text-sm font-medium text-green-800 flex items-center justify-center gap-2">
                                    <svg
                                        className="w-5 h-5 text-green-600"
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
                            <div className="text-center min-h-[24px] text-sm text-gray-700">
                                פותח שער…
                            </div>
                        )}
                        {status === "error" && (
                            <div className="text-center min-h-[24px] text-sm text-red-700">
                                נכשל, נסה שוב
                            </div>
                        )}

                        <div className="flex gap-4">
                            {user?.role === "admin" && (
                                <a
                                    href="/admin"
                                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    ניהול
                                </a>
                            )}
                            <button
                                onClick={logout}
                                className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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

