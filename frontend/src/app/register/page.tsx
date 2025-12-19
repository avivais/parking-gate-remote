"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ISRAEL_PHONE_PREFIXES, validatePhoneNumber } from "@/lib/phone";
import toast from "react-hot-toast";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phonePrefix, setPhonePrefix] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [apartmentNumber, setApartmentNumber] = useState("");
    const [floor, setFloor] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPendingNotice, setShowPendingNotice] = useState(false);
    const { register } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const aptNum = parseInt(apartmentNumber, 10);
            const floorNum = parseInt(floor, 10);

            if (isNaN(aptNum) || isNaN(floorNum)) {
                toast.error("מספר דירה וקומה חייבים להיות מספרים");
                setLoading(false);
                return;
            }

            // Validate phone number
            if (!phonePrefix || !phoneNumber) {
                toast.error("מספר טלפון לא תקין");
                setLoading(false);
                return;
            }

            if (!validatePhoneNumber(phonePrefix, phoneNumber)) {
                toast.error("מספר טלפון לא תקין");
                setLoading(false);
                return;
            }

            // Combine prefix and number
            const fullPhone = `${phonePrefix}${phoneNumber}`;

            await register(email, password, firstName, lastName, fullPhone, aptNum, floorNum);
            setShowPendingNotice(true);
            toast.success("נרשמת בהצלחה! ממתין לאישור אדמין.");
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (err: unknown) {
            let message = "שגיאה בהרשמה";

            if (err instanceof Error) {
                // Check if message is already in Hebrew
                if (err.message.match(/[\u0590-\u05FF]/)) {
                    message = err.message;
                } else {
                    const errorMessage = err.message.toLowerCase();
                    // Translate common validation errors to Hebrew
                    if (errorMessage.includes("name") || errorMessage.includes("should not be empty")) {
                        message = "יש למלא את כל השדות הנדרשים";
                    } else if (errorMessage.includes("email")) {
                        message = "כתובת אימייל לא תקינה";
                    } else if (errorMessage.includes("password") || errorMessage.includes("minlength")) {
                        message = "הסיסמה חייבת להכיל לפחות 6 תווים";
                    } else if (errorMessage.includes("already exists") || errorMessage.includes("exists")) {
                        message = "כתובת אימייל זו כבר רשומה במערכת";
                    } else {
                        message = "שגיאה בהרשמה. אנא נסה שוב.";
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
                        <span style={{ color: "var(--muted)", fontWeight: "var(--font-weight-normal)" }}>מצפה 6-8</span> • הרשמה
                    </h2>
                    <p className="mt-2 text-center text-sm text-muted">
                        צור חשבון חדש
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
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="firstName"
                                className="block text-sm font-medium"
                                style={{ color: "var(--text)" }}
                            >
                                שם פרטי
                            </label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                autoComplete="given-name"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="שם פרטי"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="lastName"
                                className="block text-sm font-medium"
                                style={{ color: "var(--text)" }}
                            >
                                שם משפחה
                            </label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                autoComplete="family-name"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="שם משפחה"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="phone"
                                className="block text-sm font-medium"
                                style={{ color: "var(--text)" }}
                            >
                                טלפון
                            </label>
                            <div className="mt-1 flex gap-2">
                                <input
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    type="tel"
                                    autoComplete="tel"
                                    required
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        // Strip non-digits and leading 0
                                        const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                                        setPhoneNumber(digits);
                                    }}
                                    className="input-theme flex-1 px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                    style={{ color: "var(--text)" }}
                                    placeholder="1234567"
                                    maxLength={7}
                                />
                                <select
                                    id="phonePrefix"
                                    name="phonePrefix"
                                    required
                                    value={phonePrefix}
                                    onChange={(e) => setPhonePrefix(e.target.value)}
                                    className="input-theme w-24 px-3 py-2 shadow-theme-sm focus-theme"
                                    style={{ color: "var(--text)" }}
                                >
                                    <option value="">קידומת</option>
                                    {ISRAEL_PHONE_PREFIXES.map((prefix) => (
                                        <option key={prefix.value} value={prefix.value}>
                                            {prefix.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {phonePrefix && phoneNumber && !validatePhoneNumber(phonePrefix, phoneNumber) && (
                                <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>מספר טלפון לא תקין</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="apartmentNumber"
                                    className="block text-sm font-medium"
                                    style={{ color: "var(--text)" }}
                                >
                                    מספר דירה
                                </label>
                                <input
                                    id="apartmentNumber"
                                    name="apartmentNumber"
                                    type="number"
                                    required
                                    value={apartmentNumber}
                                    onChange={(e) => setApartmentNumber(e.target.value)}
                                    className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                    style={{ color: "var(--text)" }}
                                    placeholder="1"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="floor"
                                    className="block text-sm font-medium"
                                    style={{ color: "var(--text)" }}
                                >
                                    קומה
                                </label>
                                <input
                                    id="floor"
                                    name="floor"
                                    type="number"
                                    required
                                    value={floor}
                                    onChange={(e) => setFloor(e.target.value)}
                                    className="input-theme mt-1 block w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                    style={{ color: "var(--text)" }}
                                    placeholder="1"
                                />
                            </div>
                        </div>
                    </div>

                    {showPendingNotice && (
                        <div className="rounded-theme-md border p-4" style={{ backgroundColor: "var(--primary)", borderColor: "var(--primary)", opacity: 0.1 }}>
                            <p className="text-sm" style={{ color: "var(--primary)" }}>
                                נרשמת, ממתין לאישור אדמין
                            </p>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={
                                loading ||
                                !phonePrefix ||
                                !phoneNumber ||
                                !validatePhoneNumber(phonePrefix, phoneNumber)
                            }
                            className="btn-primary w-full px-4 py-3 text-base font-medium shadow-theme-sm disabled:opacity-50"
                        >
                            {loading ? "נרשם..." : "הירשם"}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="text-sm font-medium focus-theme"
                            style={{ color: "var(--primary)" }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = "0.8";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = "1";
                            }}
                        >
                            יש לך חשבון? התחבר כאן
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
