"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ISRAEL_PHONE_PREFIXES, parsePhone, validatePhoneNumber } from "@/lib/phone";
import toast from "react-hot-toast";

export default function MePage() {
    const { user, updateUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phonePrefix, setPhonePrefix] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [apartmentNumber, setApartmentNumber] = useState<number>(0);
    const [floor, setFloor] = useState<number>(0);

    // Initialize form with user data
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            const { prefix, number } = parsePhone(user.phone || "");
            setPhonePrefix(prefix);
            setPhoneNumber(number);
            setApartmentNumber(user.apartmentNumber || 0);
            setFloor(user.floor || 0);
        }
    }, [user]);

    // Check if form has changes
    const hasChanges = useMemo(() => {
        if (!user) return false;
        const currentPhone = phonePrefix + phoneNumber;
        return (
            firstName !== (user.firstName || "") ||
            lastName !== (user.lastName || "") ||
            currentPhone !== (user.phone || "") ||
            apartmentNumber !== (user.apartmentNumber || 0) ||
            floor !== (user.floor || 0)
        );
    }, [user, firstName, lastName, phonePrefix, phoneNumber, apartmentNumber, floor]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate phone
        if (!validatePhoneNumber(phonePrefix, phoneNumber)) {
            toast.error("מספר טלפון לא תקין");
            return;
        }

        const phone = phonePrefix + phoneNumber;

        setLoading(true);
        try {
            await updateUser({
                firstName,
                lastName,
                phone,
                apartmentNumber,
                floor,
            });
            toast.success("הפרופיל עודכן בהצלחה");
        } catch (error: any) {
            toast.error(error?.message || "שגיאה בעדכון הפרופיל");
        } finally {
            setLoading(false);
        }
    };


    if (!user) {
        return null;
    }

    return (
        <form id="profile-form" onSubmit={handleSubmit} className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg)" }}>
            <div className="flex-1 px-4 pt-20 pb-24">
                <div className="mx-auto max-w-2xl">
                    <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text)" }}>
                        אזור אישי
                    </h1>

                    <div className="space-y-6">
                        {/* First Name */}
                        <div>
                            <label
                                htmlFor="firstName"
                                className="block text-sm font-medium mb-1"
                                style={{ color: "var(--text)" }}
                            >
                                שם פרטי
                            </label>
                            <input
                                id="firstName"
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="input-theme w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="שם פרטי"
                            />
                        </div>

                        {/* Last Name */}
                        <div>
                            <label
                                htmlFor="lastName"
                                className="block text-sm font-medium mb-1"
                                style={{ color: "var(--text)" }}
                            >
                                שם משפחה
                            </label>
                            <input
                                id="lastName"
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="input-theme w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="שם משפחה"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label
                                htmlFor="phone"
                                className="block text-sm font-medium mb-1"
                                style={{ color: "var(--text)" }}
                            >
                                טלפון
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="phoneNumber"
                                    type="tel"
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
                        </div>

                        {/* Apartment Number */}
                        <div>
                            <label
                                htmlFor="apartmentNumber"
                                className="block text-sm font-medium mb-1"
                                style={{ color: "var(--text)" }}
                            >
                                מספר דירה
                            </label>
                            <input
                                id="apartmentNumber"
                                type="number"
                                required
                                min="1"
                                value={apartmentNumber}
                                onChange={(e) => setApartmentNumber(parseInt(e.target.value) || 0)}
                                className="input-theme w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="מספר דירה"
                            />
                        </div>

                        {/* Floor */}
                        <div>
                            <label
                                htmlFor="floor"
                                className="block text-sm font-medium mb-1"
                                style={{ color: "var(--text)" }}
                            >
                                קומה
                            </label>
                            <input
                                id="floor"
                                type="number"
                                required
                                min="0"
                                value={floor}
                                onChange={(e) => setFloor(parseInt(e.target.value) || 0)}
                                className="input-theme w-full px-3 py-2 shadow-theme-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                                placeholder="קומה"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed Update Button at bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-theme bg-surface px-4 py-3 shadow-theme-lg">
                <div className="mx-auto max-w-2xl">
                    <button
                        type="submit"
                        disabled={loading || !hasChanges}
                        className="btn-primary w-full rounded-theme-md px-4 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                            backgroundColor: loading || !hasChanges ? "var(--muted)" : "var(--primary)",
                            color: "var(--primary-contrast)",
                        }}
                    >
                        {loading ? "מעדכן..." : "עדכן"}
                    </button>
                </div>
            </div>
        </form>
    );
}
