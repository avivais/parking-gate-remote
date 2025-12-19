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
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
            <div className="w-full max-w-md space-y-8">
                <div>
                    <h2 className="text-center text-3xl font-bold text-gray-900">
                        הרשמה
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        צור חשבון חדש
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
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="firstName"
                                className="block text-sm font-medium text-gray-700"
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
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                placeholder="שם פרטי"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="lastName"
                                className="block text-sm font-medium text-gray-700"
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
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                placeholder="שם משפחה"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="phone"
                                className="block text-sm font-medium text-gray-700"
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
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    placeholder="1234567"
                                    maxLength={7}
                                />
                                <select
                                    id="phonePrefix"
                                    name="phonePrefix"
                                    required
                                    value={phonePrefix}
                                    onChange={(e) => setPhonePrefix(e.target.value)}
                                    className="w-24 rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                                <p className="mt-1 text-sm text-red-600">מספר טלפון לא תקין</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="apartmentNumber"
                                    className="block text-sm font-medium text-gray-700"
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
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    placeholder="1"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="floor"
                                    className="block text-sm font-medium text-gray-700"
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
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                    placeholder="1"
                                />
                            </div>
                        </div>
                    </div>

                    {showPendingNotice && (
                        <div className="rounded-md bg-blue-50 p-4">
                            <p className="text-sm text-blue-800">
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
                            className="w-full rounded-md bg-blue-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                        >
                            {loading ? "נרשם..." : "הירשם"}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                            יש לך חשבון? התחבר כאן
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
