"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { apiRequest, ApiError } from "@/lib/api";
import toast from "react-hot-toast";

export default function HomePage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const lockStartTimeRef = useRef<number | null>(null);

    // Offline detection
    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOffline(!navigator.onLine);
        };

        // Check initial status
        updateOnlineStatus();

        // Listen to online/offline events
        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);

        return () => {
            window.removeEventListener("online", updateOnlineStatus);
            window.removeEventListener("offline", updateOnlineStatus);
        };
    }, []);

    const handleOpenGate = async () => {
        // Prevent double-click
        if (isLocked || loading || isOffline) {
            return;
        }

        // Start lock and track time
        setIsLocked(true);
        setLoading(true);
        lockStartTimeRef.current = Date.now();

        try {
            await apiRequest("/gate/open", {
                method: "POST",
            });

            // Success: show toast and success message
            toast.success("השער נפתח ✅");
            setShowSuccess(true);

            // Hide success message after 2 seconds
            setTimeout(() => {
                setShowSuccess(false);
            }, 2000);
        } catch (err) {
            if (err instanceof ApiError) {
                // Handle specific status codes
                if (err.status === 401) {
                    toast.error("החיבור פג, מתחבר מחדש…");
                    // Auto-refresh should handle this, but wait a bit and retry once
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    try {
                        await apiRequest("/gate/open", {
                            method: "POST",
                        });
                        toast.success("השער נפתח ✅");
                        setShowSuccess(true);
                        setTimeout(() => {
                            setShowSuccess(false);
                        }, 2000);
                    } catch (retryErr) {
                        // If retry also fails, redirect to login
                        toast.error("נדרש להתחבר מחדש");
                        setTimeout(() => {
                            router.push("/login");
                        }, 1500);
                    }
                } else if (err.status === 403) {
                    toast.error("אין לך הרשאה לפתוח שער");
                } else if (err.status === 409) {
                    toast.error("המשתמש מחובר כבר ממכשיר אחר");
                } else if (err.status && err.status >= 500) {
                    toast.error("אין תקשורת עם השרת, נסה שוב");
                } else {
                    toast.error(err.message || "שגיאה בפתיחת השער");
                }
            } else {
                // Network error or other
                toast.error("אין תקשורת עם השרת, נסה שוב");
            }
        } finally {
            setLoading(false);

            // Ensure minimum 2-second lock duration
            const elapsed = lockStartTimeRef.current
                ? Date.now() - lockStartTimeRef.current
                : 0;
            const remainingLockTime = Math.max(0, 2000 - elapsed);

            setTimeout(() => {
                setIsLocked(false);
                lockStartTimeRef.current = null;
            }, remainingLockTime);
        }
    };

    const isButtonDisabled = loading || isLocked || isOffline;

    return (
        <RequireAuth>
            <div className="flex min-h-screen flex-col bg-gray-50">
                <div className="flex-1 flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-md space-y-8">
                        <div className="text-center">
                            <h1 className="text-3xl font-bold text-gray-900">
                                פתיחת שער חניה
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

                            <button
                                onClick={handleOpenGate}
                                disabled={isButtonDisabled}
                                className="w-full rounded-lg bg-green-600 px-6 py-8 text-2xl font-bold text-white shadow-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center">
                                        <svg
                                            className="animate-spin -ml-1 mr-3 h-6 w-6 text-white"
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
                                        פותח שער...
                                    </span>
                                ) : (
                                    "פתח שער"
                                )}
                            </button>

                            {showSuccess && (
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
                                        השער נפתח בהצלחה
                                    </p>
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
        </RequireAuth>
    );
}

