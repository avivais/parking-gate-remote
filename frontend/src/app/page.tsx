"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { apiRequest, ApiError } from "@/lib/api";
import toast from "react-hot-toast";

export default function HomePage() {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleOpenGate = async () => {
        setLoading(true);
        try {
            await apiRequest("/gate/open", {
                method: "POST",
            });
            toast.success("השער נפתח בהצלחה!");
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : "שגיאה בפתיחת השער";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };


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
                            <button
                                onClick={handleOpenGate}
                                disabled={loading}
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
