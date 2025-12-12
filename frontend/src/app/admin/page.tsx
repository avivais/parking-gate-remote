"use client";

import { useState, useEffect } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { apiRequest, ApiError } from "@/lib/api";
import type { GateLog } from "@/types/auth";

export default function AdminPage() {
    const [logs, setLogs] = useState<GateLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiRequest<GateLog[]>("/gate/logs?limit=100");
            setLogs(data);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 403) {
                    setError("אין הרשאה לצפות בלוגים");
                } else {
                    setError(err.message || "שגיאה בטעינת הלוגים");
                }
            } else {
                setError("שגיאה בטעינת הלוגים");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <RequireAuth requireAdmin={true}>
            <div className="min-h-screen bg-gray-50 px-4 py-8">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">
                            ניהול - לוגים
                        </h1>
                        <p className="mt-2 text-sm text-gray-600">
                            רשימת פתיחות שער אחרונות
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-lg text-gray-600">טוען...</div>
                        </div>
                    ) : error ? (
                        <div className="rounded-lg bg-red-50 p-4 text-red-800">
                            {error}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg bg-white shadow">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                נפתח על ידי
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                אימייל
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                מזהה מכשיר
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                IP
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                User Agent
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                תאריך ושעה
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {logs.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="px-6 py-4 text-center text-sm text-gray-500"
                                                >
                                                    אין לוגים להצגה
                                                </td>
                                            </tr>
                                        ) : (
                                            logs.map((log) => (
                                                <tr
                                                    key={log._id}
                                                    className="hover:bg-gray-50"
                                                >
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                        {log.openedBy ===
                                                        "user"
                                                            ? "משתמש"
                                                            : "אדמין (דלת אחורית)"}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                        {log.email || "-"}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                                                        {log.deviceId
                                                            ? log.deviceId.substring(
                                                                  0,
                                                                  8,
                                                              ) + "..."
                                                            : "-"}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                                                        {log.ip || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        <div className="max-w-xs truncate">
                                                            {log.userAgent ||
                                                                "-"}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                        {log.createdAt
                                                            ? new Date(
                                                                  log.createdAt,
                                                              ).toLocaleString(
                                                                  "he-IL",
                                                              )
                                                            : "-"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="mt-4">
                        <button
                            onClick={loadLogs}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            רענן
                        </button>
                    </div>
                </div>
            </div>
        </RequireAuth>
    );
}
