"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest, ApiError, AUTH_FORBIDDEN } from "@/lib/api";
import type {
    PaginatedUsersResponse,
    PaginatedLogsResponse,
    AdminUser,
} from "@/types/auth";
import toast from "react-hot-toast";

type Tab = "users" | "logs";

type UserStatusFilter = "pending" | "approved" | "all";

type OpenedByFilter = "all" | "user" | "admin-backdoor";

// Helper function to generate page numbers for pagination
function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];

    if (currentPage <= 4) {
        // Show first 5 pages, ellipsis, last page
        for (let i = 1; i <= 5; i++) {
            pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
        // Show first page, ellipsis, last 5 pages
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Show first page, ellipsis, current-1, current, current+1, ellipsis, last page
        pages.push(1);
        pages.push("ellipsis");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("ellipsis");
        pages.push(totalPages);
    }

    return pages;
}

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<Tab>("users");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Users state
    const [usersData, setUsersData] = useState<PaginatedUsersResponse | null>(null);
    const [usersStatusFilter, setUsersStatusFilter] = useState<UserStatusFilter>("pending");
    const [usersSearchQuery, setUsersSearchQuery] = useState("");
    const [usersSearchDebounced, setUsersSearchDebounced] = useState("");
    const [usersPage, setUsersPage] = useState(1);
    const [usersLimit, setUsersLimit] = useState(20);

    // Logs state
    const [logsData, setLogsData] = useState<PaginatedLogsResponse | null>(null);
    const [logsEmailSearch, setLogsEmailSearch] = useState("");
    const [logsEmailDebounced, setLogsEmailDebounced] = useState("");
    const [logsOpenedBy, setLogsOpenedBy] = useState<OpenedByFilter>("all");
    const [logsPage, setLogsPage] = useState(1);
    const [logsLimit, setLogsLimit] = useState(50);

    // Debounce users search
    useEffect(() => {
        const timer = setTimeout(() => {
            setUsersSearchDebounced(usersSearchQuery);
            setUsersPage(1); // Reset to first page on search
        }, 300);
        return () => clearTimeout(timer);
    }, [usersSearchQuery]);

    // Debounce logs email search
    useEffect(() => {
        const timer = setTimeout(() => {
            setLogsEmailDebounced(logsEmailSearch);
            setLogsPage(1); // Reset to first page on search
        }, 300);
        return () => clearTimeout(timer);
    }, [logsEmailSearch]);

    // Load users
    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                status: usersStatusFilter,
                page: usersPage.toString(),
                limit: usersLimit.toString(),
            });
            if (usersSearchDebounced) {
                params.append("q", usersSearchDebounced);
            }

            const data = await apiRequest<PaginatedUsersResponse>(
                `/admin/users?${params.toString()}`,
            );
            setUsersData(data);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.message === AUTH_FORBIDDEN || err.status === 403) {
                    setError("אין לך הרשאה לצפות במשתמשים");
                } else {
                    setError(err.message || "שגיאה בטעינת המשתמשים");
                }
            } else {
                setError("שגיאה בטעינת המשתמשים");
            }
        } finally {
            setLoading(false);
        }
    }, [usersStatusFilter, usersSearchDebounced, usersPage, usersLimit]);

    // Load logs
    const loadLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: logsPage.toString(),
                limit: logsLimit.toString(),
            });
            if (logsEmailDebounced) {
                params.append("email", logsEmailDebounced);
            }
            if (logsOpenedBy !== "all") {
                params.append("openedBy", logsOpenedBy);
            }

            const data = await apiRequest<PaginatedLogsResponse>(
                `/admin/logs?${params.toString()}`,
            );
            setLogsData(data);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.message === AUTH_FORBIDDEN || err.status === 403) {
                    setError("אין לך הרשאה לצפות בלוגים");
                } else {
                    setError(err.message || "שגיאה בטעינת הלוגים");
                }
            } else {
                setError("שגיאה בטעינת הלוגים");
            }
        } finally {
            setLoading(false);
        }
    }, [logsEmailDebounced, logsOpenedBy, logsPage, logsLimit]);

    // Load data when tab or filters change
    useEffect(() => {
        if (activeTab === "users") {
            loadUsers();
        } else {
            loadLogs();
        }
    }, [activeTab, loadUsers, loadLogs]);

    // Handle approve user
    const handleApproveUser = async (userId: string) => {
        try {
            await apiRequest(`/admin/users/${userId}/approve`, {
                method: "POST",
            });
            toast.success("המשתמש אושר בהצלחה");
            loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה באישור המשתמש");
            } else {
                toast.error("שגיאה באישור המשתמש");
            }
        }
    };

    // Handle reset device
    const handleResetDevice = async (userId: string) => {
        try {
            await apiRequest(`/admin/users/${userId}/reset-device`, {
                method: "POST",
            });
            toast.success("המכשיר אופס בהצלחה");
            loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה באיפוס המכשיר");
            } else {
                toast.error("שגיאה באיפוס המכשיר");
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">ניהול</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        ניהול משתמשים ולוגים
                    </p>
                </div>

                {/* Tabs */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex gap-4">
                        <button
                            onClick={() => setActiveTab("users")}
                            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                                activeTab === "users"
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            }`}
                        >
                            משתמשים
                        </button>
                        <button
                            onClick={() => setActiveTab("logs")}
                            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                                activeTab === "logs"
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            }`}
                        >
                            לוגים
                        </button>
                    </nav>
                </div>

                {/* Error state */}
                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800">
                        {error}
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === "users" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("pending");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                        usersStatusFilter === "pending"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    }`}
                                >
                                    ממתינים
                                </button>
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("approved");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                        usersStatusFilter === "approved"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    }`}
                                >
                                    מאושרים
                                </button>
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("all");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                        usersStatusFilter === "all"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    }`}
                                >
                                    הכל
                                </button>
                            </div>

                            <input
                                type="text"
                                placeholder="חיפוש לפי אימייל..."
                                value={usersSearchQuery}
                                onChange={(e) => setUsersSearchQuery(e.target.value)}
                                className="flex-1 min-w-[200px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                            <select
                                value={usersLimit}
                                onChange={(e) => {
                                    setUsersLimit(Number(e.target.value));
                                    setUsersPage(1);
                                }}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={20}>20 לדף</option>
                                <option value={50}>50 לדף</option>
                            </select>
                        </div>

                        {/* Users Table */}
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-lg text-gray-600">טוען...</div>
                            </div>
                        ) : error && error.includes("הרשאה") ? (
                            <div className="rounded-lg bg-red-50 p-4 text-red-800">
                                {error}
                            </div>
                        ) : usersData ? (
                            <>
                                <div className="overflow-hidden rounded-lg bg-white shadow">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                        אימייל
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                        סטטוס
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                        מכשיר פעיל
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                        תאריך יצירה
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                        פעולות
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {usersData.items.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={5}
                                                            className="px-6 py-4 text-center text-sm text-gray-500"
                                                        >
                                                            אין משתמשים להצגה
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    usersData.items.map((user) => (
                                                        <tr
                                                            key={user.id}
                                                            className="hover:bg-gray-50"
                                                        >
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                                {user.email}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                                {user.approved ? (
                                                                    <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                                                        מאושר
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                                                                        ממתין
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                                                                {user.activeDeviceId ? (
                                                                    <span className="text-green-600">
                                                                        {user.activeDeviceId.substring(0, 8)}...
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-400">אין</span>
                                                                )}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                                {new Date(user.createdAt).toLocaleString("he-IL")}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                                <div className="flex gap-2">
                                                                    {!user.approved && (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleApproveUser(user.id)
                                                                            }
                                                                            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                                                                        >
                                                                            אישור
                                                                        </button>
                                                                    )}
                                                                    {user.activeDeviceId && (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleResetDevice(user.id)
                                                                            }
                                                                            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                                                                        >
                                                                            איפוס מכשיר
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pagination */}
                                {usersData && usersData.total > 0 && (
                                    <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                                        <div className="text-sm font-medium text-gray-700">
                                            עמוד {usersData.page} מתוך {usersData.totalPages} ({usersData.total} משתמשים)
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                                                disabled={usersData.page === 1}
                                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                הקודם
                                            </button>
                                            <div className="flex gap-1">
                                                {getPageNumbers(usersData.page, usersData.totalPages).map(
                                                    (page, idx) => {
                                                        if (page === "ellipsis") {
                                                            return (
                                                                <span
                                                                    key={`ellipsis-${idx}`}
                                                                    className="px-2 py-2 text-sm text-gray-500"
                                                                >
                                                                    ...
                                                                </span>
                                                            );
                                                        }
                                                        const isActive = page === usersData.page;
                                                        return (
                                                            <button
                                                                key={page}
                                                                onClick={() => setUsersPage(page)}
                                                                className={`min-w-[2.5rem] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                                                    isActive
                                                                        ? "border-blue-500 bg-blue-600 text-white"
                                                                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                                                }`}
                                                            >
                                                                {page}
                                                            </button>
                                                        );
                                                    },
                                                )}
                                            </div>
                                            <button
                                                onClick={() =>
                                                    setUsersPage((p) =>
                                                        Math.min(usersData.totalPages, p + 1),
                                                    )
                                                }
                                                disabled={usersData.page === usersData.totalPages}
                                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                הבא
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                )}

                {/* Logs Tab */}
                {activeTab === "logs" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4">
                            <input
                                type="text"
                                placeholder="חיפוש לפי אימייל..."
                                value={logsEmailSearch}
                                onChange={(e) => setLogsEmailSearch(e.target.value)}
                                className="flex-1 min-w-[200px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                            <select
                                value={logsOpenedBy}
                                onChange={(e) => {
                                    setLogsOpenedBy(e.target.value as OpenedByFilter);
                                    setLogsPage(1);
                                }}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">הכל</option>
                                <option value="user">משתמש</option>
                                <option value="admin-backdoor">אדמין</option>
                            </select>

                            <select
                                value={logsLimit}
                                onChange={(e) => {
                                    setLogsLimit(Number(e.target.value));
                                    setLogsPage(1);
                                }}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={20}>20 לדף</option>
                                <option value={50}>50 לדף</option>
                                <option value={100}>100 לדף</option>
                                <option value={200}>200 לדף</option>
                            </select>
                        </div>

                        {/* Logs Table */}
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-lg text-gray-600">טוען...</div>
                            </div>
                        ) : error && error.includes("הרשאה") ? (
                            <div className="rounded-lg bg-red-50 p-4 text-red-800">
                                {error}
                            </div>
                        ) : logsData ? (
                            <>
                                <div className="overflow-hidden rounded-lg bg-white shadow">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                                        תאריך ושעה
                                                    </th>
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
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {logsData.items.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-6 py-4 text-center text-sm text-gray-500"
                                                        >
                                                            אין לוגים להצגה
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    logsData.items.map((log) => (
                                                        <tr
                                                            key={log.id}
                                                            className="hover:bg-gray-50"
                                                        >
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                                                {new Date(log.createdAt).toLocaleString("he-IL")}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                                {log.openedBy === "user"
                                                                    ? "משתמש"
                                                                    : "אדמין (דלת אחורית)"}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                                {log.email || "-"}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                                                                {log.deviceId
                                                                    ? log.deviceId.substring(0, 8) + "..."
                                                                    : "-"}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                                                                {log.ip || "-"}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                                <div className="max-w-xs truncate">
                                                                    {log.userAgent || "-"}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pagination */}
                                {logsData && logsData.total > 0 && (
                                    <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                                        <div className="text-sm font-medium text-gray-700">
                                            עמוד {logsData.page} מתוך {logsData.totalPages} ({logsData.total} לוגים)
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                                                disabled={logsData.page === 1}
                                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                הקודם
                                            </button>
                                            <div className="flex gap-1">
                                                {getPageNumbers(logsData.page, logsData.totalPages).map(
                                                    (page, idx) => {
                                                        if (page === "ellipsis") {
                                                            return (
                                                                <span
                                                                    key={`ellipsis-${idx}`}
                                                                    className="px-2 py-2 text-sm text-gray-500"
                                                                >
                                                                    ...
                                                                </span>
                                                            );
                                                        }
                                                        const isActive = page === logsData.page;
                                                        return (
                                                            <button
                                                                key={page}
                                                                onClick={() => setLogsPage(page)}
                                                                className={`min-w-[2.5rem] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                                                    isActive
                                                                        ? "border-blue-500 bg-blue-600 text-white"
                                                                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                                                }`}
                                                            >
                                                                {page}
                                                            </button>
                                                        );
                                                    },
                                                )}
                                            </div>
                                            <button
                                                onClick={() =>
                                                    setLogsPage((p) =>
                                                        Math.min(logsData.totalPages, p + 1),
                                                    )
                                                }
                                                disabled={logsData.page === logsData.totalPages}
                                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                הבא
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

