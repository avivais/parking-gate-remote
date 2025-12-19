"use client";

import { useRouter } from "next/navigation";

export function AdminHeader() {
    const router = useRouter();

    return (
        <div className="border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">
                        <span className="text-gray-500 font-normal">מצפה 6-8</span> • ניהול
                    </h1>
                    <button
                        onClick={() => router.push("/")}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        חזרה לפתיחת שער
                    </button>
                </div>
            </div>
        </div>
    );
}

