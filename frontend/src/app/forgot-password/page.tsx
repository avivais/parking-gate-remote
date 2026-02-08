"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await apiRequest("/auth/forgot-password", {
                method: "POST",
                body: { email },
                auth: false,
            });
            toast.success(
                "אם החשבון קיים, נשלח אליך אימייל עם קישור לאיפוס הסיסמה.",
            );
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "שגיאה. נסה שוב.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="flex min-h-screen items-center justify-center px-4 py-12"
            style={{ backgroundColor: "var(--bg)" }}
        >
            <div className="w-full max-w-md space-y-8">
                <div>
                    <h2
                        className="text-center text-3xl font-bold"
                        style={{ color: "var(--text)" }}
                    >
                        <span
                            style={{
                                color: "var(--muted)",
                                fontWeight: "var(--font-weight-normal)",
                            }}
                        >
                            מצפה 6-8
                        </span>{" "}
                        • איפוס סיסמה
                    </h2>
                    <p className="mt-2 text-center text-sm text-muted">
                        הכנס את כתובת האימייל שלך ונשלח אליך קישור לאיפוס
                    </p>
                </div>
                <form
                    className="mt-8 space-y-6"
                    onSubmit={handleSubmit}
                >
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
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full px-4 py-3 text-base font-medium shadow-theme-sm disabled:opacity-50"
                        >
                            {loading
                                ? "שולח..."
                                : "לחץ כאן לאיפוס הסיסמה"}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="link-hover text-sm font-medium focus-theme"
                            style={{ color: "var(--primary)" }}
                        >
                            חזרה להתחברות
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
