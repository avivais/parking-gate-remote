"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, ApiError, setAccessToken, API_BASE_URL } from "@/lib/api";
import type { MeResponse, RefreshResponse } from "@/types/auth";
import toast from "react-hot-toast";

export default function PendingPage() {
    const { logout, user, refresh } = useAuth();
    const router = useRouter();
    const [checking, setChecking] = useState(false);

    const handleCheckAgain = async () => {
        setChecking(true);

        try {
            // Step 1: Refresh the access token
            const refreshUrl = `${API_BASE_URL}/auth/refresh`;
            const refreshResponse = await fetch(refreshUrl, {
                method: "POST",
                credentials: "include",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!refreshResponse.ok) {
                if (refreshResponse.status === 401) {
                    toast.error("החיבור פג, נסה להתחבר מחדש");
                    setTimeout(() => {
                        router.push("/login");
                    }, 1500);
                    return;
                }
                throw new Error("שגיאה ברענון החיבור");
            }

            // Store the new access token
            const refreshData: RefreshResponse = await refreshResponse.json();
            setAccessToken(refreshData.tokens.accessToken);

            // Step 2: Check user status
            try {
                const meData = await apiRequest<MeResponse>("/auth/me");

                // If we get here, user is approved (ApprovedGuard passed)
                if (meData.user?.approved) {
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
                }
            } catch (meErr) {
                if (meErr instanceof ApiError) {
                    if (meErr.status === 403) {
                        // Still pending - this is expected
                        toast("עדיין ממתין לאישור", {
                            icon: "⏳",
                        });
                        return;
                    } else if (meErr.status === 401) {
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
                if (err.status === 401) {
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
        <RequireAuth requireApproved={false}>
            <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-4">
                        <div className="mx-auto h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center">
                            <svg
                                className="h-8 w-8 text-yellow-600"
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
                        <h2 className="text-3xl font-bold text-gray-900">
                            ממתין לאישור
                        </h2>
                        <div className="space-y-3 text-right">
                            <p className="text-lg text-gray-700">
                                שלום! החשבון שלך נשלח לאישור על ידי מנהל המערכת.
                            </p>
                            <p className="text-base text-gray-600">
                                תהליך האישור יכול לקחת כמה דקות. ברגע שהחשבון יאושר, תוכל להשתמש בכל התכונות של האפליקציה.
                            </p>
                            <p className="text-sm text-gray-500">
                                תוכל לבדוק את סטטוס האישור בכל עת באמצעות הכפתור למטה.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleCheckAgain}
                            disabled={checking}
                            className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {checking ? (
                                <span className="flex items-center justify-center">
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                            className="w-full rounded-lg bg-red-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all"
                        >
                            התנתק
                        </button>
                    </div>
                </div>
            </div>
        </RequireAuth>
    );
}

