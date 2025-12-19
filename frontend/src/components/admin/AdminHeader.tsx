"use client";

import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export function AdminHeader() {
    const router = useRouter();

    return (
        <div className="border-b border-theme bg-surface">
            <div className="mx-auto max-w-7xl px-4 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
                        <span style={{ color: "var(--muted)", fontWeight: "var(--font-weight-normal)" }}>מצפה 6-8</span> • ניהול
                    </h1>
                    <div className="flex items-center gap-3">
                        <ThemeSwitcher />
                        <button
                            onClick={() => router.push("/")}
                            className="rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 focus-theme"
                            style={{ color: "var(--text)" }}
                        >
                            חזרה לפתיחת שער
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

