"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError, AUTH_UNAUTHORIZED, AUTH_FORBIDDEN } from "@/lib/api";
import { GateButton } from "@/components/GateButton";
import * as haptics from "@/lib/haptics";
import toast from "react-hot-toast";

type FeedbackState = "idle" | "loading" | "success" | "error";

export default function HomePage() {
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
            toast.success("השער נפתח");
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
            <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-12">
                <div className="w-full max-w-md space-y-6">
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
                </div>
            </div>
        </div>
    );
}

