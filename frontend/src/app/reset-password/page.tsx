"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { ApiError } from "@/lib/api";
import toast from "react-hot-toast";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    if (!token) {
        return (
            <div
                className="flex min-h-screen items-center justify-center px-4 py-12"
                style={{ backgroundColor: "var(--bg)" }}
            >
                <div className="w-full max-w-md space-y-6 text-center">
                    <p
                        className="text-center"
                        style={{ color: "var(--text)" }}
                    >
                        קישור לא תקף. בקש קישור חדש בדף איפוס סיסמה.
                    </p>
                    <Link
                        href="/forgot-password"
                        className="link-hover text-sm font-medium focus-theme"
                        style={{ color: "var(--primary)" }}
                    >
                        איפוס סיסמה
                    </Link>
                    <Link
                        href="/login"
                        className="block link-hover text-sm font-medium focus-theme mt-4"
                        style={{ color: "var(--primary)" }}
                    >
                        התחברות
                    </Link>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
            return;
        }
        if (password !== confirmPassword) {
            toast.error("הסיסמאות לא תואמות");
            return;
        }

        setLoading(true);
        try {
            await apiRequest("/auth/reset-password", {
                method: "POST",
                body: { token, newPassword: password },
                auth: false,
            });
            toast.success("הסיסמה עודכנה. אפשר להתחבר.");
            router.push("/login");
        } catch (err: unknown) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : "שגיאה. נסה שוב.";
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
                        • סיסמה חדשה
                    </h2>
                    <p className="mt-2 text-center text-sm text-muted">
                        בחר סיסמה חדשה לחשבונך
                    </p>
                </div>
                <form
                    className="mt-8 space-y-6"
                    onSubmit={handleSubmit}
                >
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium"
                                style={{ color: "var(--text)" }}
                            >
                                סיסמה חדשה
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }
                                className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-sm font-medium"
                                style={{ color: "var(--text)" }}
                            >
                                אימות סיסמה
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
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
                            {loading
                                ? "מעדכן..."
                                : "עדכן סיסמה"}
                        </button>
                    </div>

                    <div className="text-center space-y-2">
                        <Link
                            href="/login"
                            className="block link-hover text-sm font-medium focus-theme"
                            style={{ color: "var(--primary)" }}
                        >
                            התחברות
                        </Link>
                        <Link
                            href="/forgot-password"
                            className="block link-hover text-sm font-medium focus-theme"
                            style={{ color: "var(--primary)" }}
                        >
                            איפוס סיסמה
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div
                    className="flex min-h-screen items-center justify-center"
                    style={{ backgroundColor: "var(--bg)" }}
                >
                    <p style={{ color: "var(--text)" }}>טוען...</p>
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}
