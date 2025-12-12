"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";

export default function PendingPage() {
    return (
        <RequireAuth requireApproved={false}>
            <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
                <div className="w-full max-w-md space-y-8 text-center">
                    <div className="space-y-4">
                        <div className="mx-auto h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center">
                            <svg
                                className="h-8 w-8 text-yellow-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">
                            ממתין לאישור
                        </h2>
                        <p className="text-lg text-gray-600">
                            החשבון ממתין לאישור אדמין
                        </p>
                        <p className="text-sm text-gray-500">
                            תקבל הודעה ברגע שהחשבון יאושר
                        </p>
                    </div>
                    <div>
                        <Link
                            href="/login"
                            className="inline-block rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            חזרה להתחברות
                        </Link>
                    </div>
                </div>
            </div>
        </RequireAuth>
    );
}
