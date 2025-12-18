"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import toast from "react-hot-toast";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await login(email, password);
            toast.success("התחברת בהצלחה!");
        } catch (err: unknown) {
            let message = "שגיאה בהתחברות";

            if (err instanceof ApiError) {
                // Check for rejected status with rejectionReason in data
                if (err.message === "הבקשה נדחתה" || err.message.includes("נדחתה")) {
                    const rejectionReason = err.data && typeof err.data === 'object' && 'rejectionReason' in err.data
                        ? (err.data as any).rejectionReason
                        : null;
                    if (rejectionReason) {
                        message = `הבקשה נדחתה: ${rejectionReason}`;
                    } else {
                        message = "הבקשה נדחתה";
                    }
                } else if (err.message === "המשתמש נחסם") {
                    message = "המשתמש נחסם";
                } else if (err.message === "המשתמש ממתין לאישור אדמין") {
                    message = "המשתמש ממתין לאישור אדמין";
                } else if (err.message.match(/[\u0590-\u05FF]/)) {
                    message = err.message;
                } else {
                    const errorMessage = err.message.toLowerCase();
                    // Translate common errors to Hebrew
                    if (errorMessage.includes("invalid credentials") || errorMessage.includes("credentials")) {
                        message = "אימייל או סיסמה שגויים";
                    } else if (errorMessage.includes("not approved") || errorMessage.includes("approved")) {
                        message = "החשבון ממתין לאישור אדמין";
                    } else if (errorMessage.includes("already logged in") || errorMessage.includes("another device") || errorMessage.includes("different device")) {
                        message = "המשתמש מחובר כבר ממכשיר אחר";
                    } else if (errorMessage.includes("not authenticated") || errorMessage.includes("unauthorized")) {
                        message = "שם המשתמש ו/או הסיסמא שגויים";
                    } else if (errorMessage.includes("admin only") || errorMessage.includes("forbidden")) {
                        message = "גישה מוגבלת לאדמין בלבד";
                    } else {
                        message = "שגיאה בהתחברות. אנא נסה שוב.";
                    }
                }
            } else if (err instanceof Error) {
                const errorMessage = err.message.toLowerCase();
                // Check if message is already in Hebrew
                if (err.message.match(/[\u0590-\u05FF]/)) {
                    message = err.message;
                } else {
                    // Translate common errors to Hebrew
                    if (errorMessage.includes("invalid credentials") || errorMessage.includes("credentials")) {
                        message = "אימייל או סיסמה שגויים";
                    } else if (errorMessage.includes("not approved") || errorMessage.includes("approved")) {
                        message = "החשבון ממתין לאישור אדמין";
                    } else if (errorMessage.includes("already logged in") || errorMessage.includes("another device") || errorMessage.includes("different device")) {
                        message = "המשתמש מחובר כבר ממכשיר אחר";
                    } else if (errorMessage.includes("not authenticated") || errorMessage.includes("unauthorized")) {
                        message = "שם המשתמש ו/או הסיסמא שגויים";
                    } else if (errorMessage.includes("admin only") || errorMessage.includes("forbidden")) {
                        message = "גישה מוגבלת לאדמין בלבד";
                    } else {
                        message = "שגיאה בהתחברות. אנא נסה שוב.";
                    }
                }
            }

            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
            <div className="w-full max-w-md space-y-8">
                <div>
                    <h2 className="text-center text-3xl font-bold text-gray-900">
                        התחברות
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        הכנס פרטי התחברות
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700"
                            >
                                אימייל
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                placeholder="your@email.com"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700"
                            >
                                סיסמה
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-md bg-blue-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {loading ? "מתחבר..." : "התחבר"}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/register"
                            className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                            אין לך חשבון? הירשם כאן
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

