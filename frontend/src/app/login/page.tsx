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
                if (err.message === "הבקשה לאישור החשבון נדחתה" || err.message.includes("נדחתה")) {
                    const rejectionReason = err.data && typeof err.data === 'object' && 'rejectionReason' in err.data
                        ? (err.data as { rejectionReason?: string | null }).rejectionReason ?? null
                        : null;
                    if (rejectionReason) {
                        message = `הבקשה לאישור החשבון נדחתה: ${rejectionReason}`;
                    } else {
                        message = "הבקשה לאישור החשבון נדחתה";
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
        <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ backgroundColor: "var(--bg)" }}>
            <div className="w-full max-w-md space-y-8">
                <div>
                    <h2 className="text-center text-3xl font-bold" style={{ color: "var(--text)" }}>
                        <span style={{ color: "var(--muted)", fontWeight: "var(--font-weight-normal)" }}>מצפה 6-8</span> • התחברות
                    </h2>
                    <p className="mt-2 text-center text-sm text-muted">
                        הכנס פרטי התחברות
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium"
                                style={{ color: "var(--text)" }}
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
                                className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="your@email.com"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium"
                                style={{ color: "var(--text)" }}
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
                                className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full px-4 py-3 text-base font-medium shadow-theme-sm disabled:opacity-50"
                        >
                            {loading ? "מתחבר..." : "התחבר"}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/register"
                            className="text-sm font-medium focus-theme"
                            style={{ color: "var(--primary)" }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = "0.8";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = "1";
                            }}
                        >
                            אין לך חשבון? הירשם כאן
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

