"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, ApiError, refreshToken, AUTH_UNAUTHORIZED, AUTH_FORBIDDEN } from "@/lib/api";
import type { MeResponse } from "@/types/auth";
import toast from "react-hot-toast";

export default function PendingPage() {
    const { logout, refresh } = useAuth();
    const router = useRouter();
    const [checking, setChecking] = useState(false);

    const handleCheckAgain = async () => {
        setChecking(true);

        try {
            // Step 1: Refresh the access token
            // refreshToken() automatically sets the access token
            await refreshToken();

            // Step 2: Check user status
            try {
                const meData = await apiRequest<MeResponse>("/auth/me");

                // Check user status
                if (meData.user?.status === "approved") {
                    // Update AuthContext state by calling refresh
                    // This ensures the user state is updated before redirect
                    try {
                        await refresh();
                    } catch (refreshErr) {
                        // If refresh fails, still redirect (we already confirmed approval)
                        console.warn("Failed to refresh auth context:", refreshErr);
                    }
                    toast.success("החשבון אושר! מעביר לדף הבית...");
                    setTimeout(() => {
                        router.push("/");
                    }, 1000);
                    return;
                } else if (meData.user?.status === "rejected") {
                    // User was rejected - show reason and redirect to login
                    const rejectionReason = meData.user.rejectionReason
                        ? `: ${meData.user.rejectionReason}`
                        : "";
                    toast.error(`הבקשה לאישור החשבון נדחתה: ${rejectionReason}`);
                    setTimeout(() => {
                        router.push("/login");
                    }, 2000);
                    return;
                } else if (meData.user?.status === "archived") {
                    // User was archived - redirect to login
                    toast.error("המשתמש נחסם");
                    setTimeout(() => {
                        router.push("/login");
                    }, 2000);
                    return;
                } else if (meData.user?.status === "pending") {
                    // Still pending - this is expected
                    toast("עדיין ממתין לאישור", {
                        icon: "⏳",
                    });
                    return;
                }
            } catch (meErr) {
                if (meErr instanceof ApiError) {
                    if (meErr.message === AUTH_FORBIDDEN) {
                        // Still pending or rejected/archived - check the error data
                        const rejectionReason = meErr.data && typeof meErr.data === 'object' && 'rejectionReason' in meErr.data
                            ? (meErr.data as { rejectionReason?: string | null }).rejectionReason ?? null
                            : null;
                        if (rejectionReason) {
                            toast.error(`הבקשה לאישור החשבון נדחתה: ${rejectionReason}`);
                            setTimeout(() => {
                                router.push("/login");
                            }, 2000);
                        } else {
                            // Still pending - this is expected
                            toast("עדיין ממתין לאישור", {
                                icon: "⏳",
                            });
                        }
                        return;
                    } else if (meErr.message === AUTH_UNAUTHORIZED) {
                        toast.error("החיבור פג, נסה להתחבר מחדש");
                        setTimeout(() => {
                            router.push("/login");
                        }, 1500);
                        return;
                    }
                }
                // Other error
                throw meErr;
            }
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.message === AUTH_UNAUTHORIZED) {
                    toast.error("החיבור פג, נסה להתחבר מחדש");
                    setTimeout(() => {
                        router.push("/login");
                    }, 1500);
                } else if (err.status && err.status >= 500) {
                    toast.error("אין תקשורת עם השרת, נסה שוב");
                } else {
                    toast.error(err.message || "שגיאה בבדיקת הסטטוס");
                }
            } else {
                toast.error("אין תקשורת עם השרת, נסה שוב");
            }
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ backgroundColor: "var(--bg)" }}>
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-4">
                        <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--warning)", opacity: 0.2 }}>
                            <svg
                                className="h-8 w-8"
                                style={{ color: "var(--warning)" }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                            <h2 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
                                <span style={{ color: "var(--muted)", fontWeight: "var(--font-weight-normal)" }}>מצפה 6-8</span> • ממתין לאישור
                            </h2>
                        <div className="space-y-3 text-right">
                            <p className="text-lg" style={{ color: "var(--text)" }}>
                                שלום! החשבון שלך נשלח לאישור על ידי מנהל המערכת.
                            </p>
                            <p className="text-base text-muted">
                                תהליך האישור יכול לקחת כמה דקות. ברגע שהחשבון יאושר, תוכל להשתמש בכל התכונות של האפליקציה.
                            </p>
                            <p className="text-sm text-muted">
                                תוכל לבדוק את סטטוס האישור בכל עת באמצעות הכפתור למטה.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleCheckAgain}
                            disabled={checking}
                            className="btn-primary w-full rounded-theme-lg px-6 py-4 text-lg font-bold shadow-theme-lg focus-theme disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: "var(--primary)",
                                color: "var(--primary-contrast)",
                            }}
                        >
                            {checking ? (
                                <span className="flex items-center justify-center">
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5"
                                        style={{ color: "var(--primary-contrast)" }}
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    בודק...
                                </span>
                            ) : (
                                "בדוק שוב"
                            )}
                        </button>

                        <button
                            onClick={logout}
                            className="btn-danger w-full rounded-theme-md px-6 py-3 text-base font-medium shadow-theme-sm focus-theme"
                            style={{
                                backgroundColor: "var(--danger)",
                                color: "var(--primary-contrast)",
                            }}
                        >
                            התנתק
                        </button>
                    </div>
                </div>
            </div>
    );
}

