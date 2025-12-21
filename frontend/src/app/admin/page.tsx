"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiRequest, ApiError, AUTH_FORBIDDEN } from "@/lib/api";
import { ISRAEL_PHONE_PREFIXES, parsePhone, validatePhoneNumber } from "@/lib/phone";
import type {
    PaginatedUsersResponse,
    PaginatedLogsResponse,
    AdminUser,
} from "@/types/auth";
import toast from "react-hot-toast";

type Tab = "users" | "logs";

type UserStatusFilter = "pending" | "approved" | "rejected" | "archived" | "all";

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

    // Modal state
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editModalConfirmClose, setEditModalConfirmClose] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [editFormData, setEditFormData] = useState({
        firstName: "",
        lastName: "",
        phonePrefix: "",
        phoneNumber: "",
        apartmentNumber: "",
        floor: "",
        status: "pending" as "pending" | "approved" | "rejected" | "archived",
        rejectionReason: "",
    });

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
            await apiRequest(`/admin/users/${userId}`, {
                method: "PATCH",
                body: { status: "approved" },
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

    // Handle reject user
    const handleRejectUser = async () => {
        if (!selectedUser || !rejectionReason.trim()) {
            toast.error("יש להזין סיבת דחייה");
            return;
        }
        try {
            await apiRequest(`/admin/users/${selectedUser.id}`, {
                method: "PATCH",
                body: { status: "rejected", rejectionReason: rejectionReason.trim() },
            });
            toast.success("המשתמש נדחה בהצלחה");
            setRejectModalOpen(false);
            setSelectedUser(null);
            setRejectionReason("");
            loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה בדחיית המשתמש");
            } else {
                toast.error("שגיאה בדחיית המשתמש");
            }
        }
    };

    // Handle archive user
    const handleArchiveUser = async (userId: string) => {
        try {
            await apiRequest(`/admin/users/${userId}`, {
                method: "PATCH",
                body: { status: "archived" },
            });
            toast.success("המשתמש הושבת בהצלחה");
            loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה בהשבתת המשתמש");
            } else {
                toast.error("שגיאה בהשבתת המשתמש");
            }
        }
    };

    // Handle edit user
    const handleEditUser = async () => {
        if (!selectedUser) return;

        const aptNum = parseInt(editFormData.apartmentNumber, 10);
        const floorNum = parseInt(editFormData.floor, 10);

        if (isNaN(aptNum) || isNaN(floorNum)) {
            toast.error("מספר דירה וקומה חייבים להיות מספרים");
            return;
        }

        // Validate phone number
        if (!editFormData.phonePrefix || !editFormData.phoneNumber) {
            toast.error("מספר טלפון לא תקין");
            return;
        }

        if (!validatePhoneNumber(editFormData.phonePrefix, editFormData.phoneNumber)) {
            toast.error("מספר טלפון לא תקין");
            return;
        }

        // Combine prefix and number
        const fullPhone = `${editFormData.phonePrefix}${editFormData.phoneNumber}`;

        const updateData: {
            firstName: string;
            lastName: string;
            phone: string;
            apartmentNumber: number;
            floor: number;
            status: "pending" | "approved" | "rejected" | "archived";
            rejectionReason?: string | null;
        } = {
            firstName: editFormData.firstName,
            lastName: editFormData.lastName,
            phone: fullPhone,
            apartmentNumber: aptNum,
            floor: floorNum,
            status: editFormData.status,
        };

        if (editFormData.status === "rejected") {
            if (!editFormData.rejectionReason.trim()) {
                toast.error("יש להזין סיבת דחייה");
                return;
            }
            updateData.rejectionReason = editFormData.rejectionReason.trim();
        } else {
            updateData.rejectionReason = null;
        }

        try {
            await apiRequest(`/admin/users/${selectedUser.id}`, {
                method: "PATCH",
                body: updateData,
            });
            toast.success("המשתמש עודכן בהצלחה");
            setEditModalOpen(false);
            setSelectedUser(null);
            loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה בעדכון המשתמש");
            } else {
                toast.error("שגיאה בעדכון המשתמש");
            }
        }
    };

    // Open reject modal
    const openRejectModal = (user: AdminUser) => {
        setSelectedUser(user);
        setRejectionReason("");
        setRejectModalOpen(true);
    };

    // Open edit modal
    const openEditModal = (user: AdminUser) => {
        setSelectedUser(user);
        // Parse existing phone number
        const parsedPhone = parsePhone(user.phone);
        setEditFormData({
            firstName: user.firstName,
            lastName: user.lastName,
            phonePrefix: parsedPhone.prefix,
            phoneNumber: parsedPhone.number,
            apartmentNumber: user.apartmentNumber.toString(),
            floor: user.floor.toString(),
            status: user.status,
            rejectionReason: user.rejectionReason || "",
        });
        setEditModalOpen(true);
        setEditModalConfirmClose(false);
    };

    // Check if form has changes
    const editFormHasChanges = useMemo(() => {
        if (!selectedUser) return false;
        const parsedPhone = parsePhone(selectedUser.phone);
        const currentPhone = editFormData.phonePrefix + editFormData.phoneNumber;
        const originalPhone = parsedPhone.prefix + parsedPhone.number;
        return (
            editFormData.firstName !== selectedUser.firstName ||
            editFormData.lastName !== selectedUser.lastName ||
            currentPhone !== originalPhone ||
            editFormData.apartmentNumber !== selectedUser.apartmentNumber.toString() ||
            editFormData.floor !== selectedUser.floor.toString() ||
            editFormData.status !== selectedUser.status ||
            (editFormData.status === "rejected" && editFormData.rejectionReason !== (selectedUser.rejectionReason || ""))
        );
    }, [selectedUser, editFormData]);

    // Close edit modal with confirmation if needed
    const closeEditModal = () => {
        if (editFormHasChanges) {
            setEditModalConfirmClose(true);
        } else {
            setEditModalOpen(false);
            setSelectedUser(null);
            setEditModalConfirmClose(false);
        }
    };

    // Confirm close edit modal (discard changes)
    const confirmCloseEditModal = () => {
        setEditModalOpen(false);
        setSelectedUser(null);
        setEditModalConfirmClose(false);
    };

    // Cancel close edit modal (keep editing)
    const cancelCloseEditModal = () => {
        setEditModalConfirmClose(false);
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
        <div className="px-4 py-8">
            <div className="mx-auto max-w-7xl w-full">
                {/* Tabs */}
                <div className="mb-6">
                    <nav className="flex gap-2 md:gap-4 border-b border-theme">
                        <button
                            onClick={() => setActiveTab("users")}
                            className={`border-b-2 px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap -mb-px ${
                                activeTab === "users"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted hover:border-theme hover:text-text"
                            }`}
                            style={activeTab === "users" ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}
                        >
                            משתמשים
                        </button>
                        <button
                            onClick={() => setActiveTab("logs")}
                            className={`border-b-2 px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap -mb-px ${
                                activeTab === "logs"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted hover:border-theme hover:text-text"
                            }`}
                            style={activeTab === "logs" ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}
                        >
                            לוגים
                        </button>
                    </nav>
                </div>

                {/* Error state */}
                {error && (
                    <div className="mb-4 rounded-theme-md border p-4" style={{ backgroundColor: "var(--danger)", borderColor: "var(--danger)", opacity: 0.1 }}>
                        <p style={{ color: "var(--danger)" }}>{error}</p>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === "users" && (
                    <div className="space-y-4">
                        {/* Filters - Mobile: vertical, Desktop: horizontal */}
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Status Filter Buttons - Mobile: wrap, Desktop: no wrap */}
                            <div className="flex flex-wrap gap-2 md:flex-nowrap">
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("pending");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "pending"
                                            ? "bg-primary text-primary-contrast"
                                            : "bg-surface-2 text-muted hover:bg-surface"
                                    }`}
                                    style={usersStatusFilter === "pending" ? {} : { color: "var(--muted)" }}
                                >
                                    ממתינים
                                </button>
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("approved");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "approved"
                                            ? "bg-primary text-primary-contrast"
                                            : "bg-surface-2 text-muted hover:bg-surface"
                                    }`}
                                    style={usersStatusFilter === "approved" ? {} : { color: "var(--muted)" }}
                                >
                                    מאושרים
                                </button>
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("rejected");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "rejected"
                                            ? "bg-primary text-primary-contrast"
                                            : "bg-surface-2 text-muted hover:bg-surface"
                                    }`}
                                    style={usersStatusFilter === "rejected" ? {} : { color: "var(--muted)" }}
                                >
                                    נדחו
                                </button>
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("archived");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "archived"
                                            ? "bg-primary text-primary-contrast"
                                            : "bg-surface-2 text-muted hover:bg-surface"
                                    }`}
                                    style={usersStatusFilter === "archived" ? {} : { color: "var(--muted)" }}
                                >
                                    מושבתים
                                </button>
                                <button
                                    onClick={() => {
                                        setUsersStatusFilter("all");
                                        setUsersPage(1);
                                    }}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "all"
                                            ? "bg-primary text-primary-contrast"
                                            : "bg-surface-2 text-muted hover:bg-surface"
                                    }`}
                                    style={usersStatusFilter === "all" ? {} : { color: "var(--muted)" }}
                                >
                                    הכל
                                </button>
                            </div>

                            {/* Search and Limit - Mobile: full width, Desktop: flex */}
                            <div className="flex flex-col sm:flex-row gap-2 md:gap-4 flex-1">
                                <input
                                    type="text"
                                    placeholder="חיפוש לפי אימייל, טלפון או שם..."
                                    value={usersSearchQuery}
                                    onChange={(e) => setUsersSearchQuery(e.target.value)}
                                    className="input-theme flex-1 w-full px-4 py-2 text-sm placeholder:text-muted focus-theme"
                                    style={{ color: "var(--text)" }}
                                />

                                <select
                                    value={usersLimit}
                                    onChange={(e) => {
                                        setUsersLimit(Number(e.target.value));
                                        setUsersPage(1);
                                    }}
                                    className="input-theme px-4 py-2 text-sm focus-theme w-full sm:w-auto"
                                    style={{ color: "var(--text)" }}
                                >
                                    <option value={20}>20 לדף</option>
                                    <option value={50}>50 לדף</option>
                                </select>
                            </div>
                        </div>

                        {/* Users Table */}
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-lg text-muted">טוען...</div>
                            </div>
                        ) : error && error.includes("הרשאה") ? (
                            <div className="rounded-theme-md border p-4" style={{ backgroundColor: "var(--danger)", borderColor: "var(--danger)", opacity: 0.1 }}>
                                <p style={{ color: "var(--danger)" }}>{error}</p>
                            </div>
                        ) : usersData ? (
                            <>
                                {/* Mobile: Cards View */}
                                <div className="md:hidden space-y-3">
                                    {usersData.items.length === 0 ? (
                                        <div className="rounded-theme-md border p-4 text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                                            <p className="text-sm text-muted">אין משתמשים להצגה</p>
                                        </div>
                                    ) : (
                                        usersData.items.map((user) => (
                                            <div
                                                key={user.id}
                                                className="rounded-theme-md border p-4 space-y-3"
                                                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                                                            {user.firstName} {user.lastName}
                                                        </h3>
                                                        <p className="text-xs text-muted mt-1">{user.email}</p>
                                                    </div>
                                                    <div>
                                                        {user.status === "approved" ? (
                                                            <span className="badge-success inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                מאושר
                                                            </span>
                                                        ) : user.status === "pending" ? (
                                                            <span className="badge-warning inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                ממתין
                                                            </span>
                                                        ) : user.status === "rejected" ? (
                                                            <span className="badge-danger inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                נדחה
                                                            </span>
                                                        ) : (
                                                            <span className="badge-muted inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                מושבת
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">טלפון:</span>
                                                        <span style={{ color: "var(--text)" }}>{user.phone}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">דירה + קומה:</span>
                                                        <span style={{ color: "var(--text)" }}>{user.apartmentNumber} / {user.floor}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">מכשיר פעיל:</span>
                                                        <span className={user.activeDeviceId ? "text-success" : "text-muted"}>
                                                            {user.activeDeviceId ? `${user.activeDeviceId.substring(0, 8)}...` : "אין"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">תאריך יצירה:</span>
                                                        <span className="text-muted">{new Date(user.createdAt).toLocaleString("he-IL")}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                                                    {user.status === "pending" && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApproveUser(user.id)}
                                                                className="rounded-theme-sm px-3 py-1.5 text-xs font-medium flex-1"
                                                                style={{
                                                                    backgroundColor: "var(--success)",
                                                                    color: "var(--primary-contrast)",
                                                                }}
                                                            >
                                                                אישור
                                                            </button>
                                                            <button
                                                                onClick={() => openRejectModal(user)}
                                                                className="rounded-theme-sm px-3 py-1.5 text-xs font-medium flex-1"
                                                                style={{
                                                                    backgroundColor: "var(--danger)",
                                                                    color: "var(--primary-contrast)",
                                                                }}
                                                            >
                                                                דחייה
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => openEditModal(user)}
                                                        className="rounded-theme-sm px-3 py-1.5 text-xs font-medium"
                                                        style={{
                                                            backgroundColor: "var(--primary)",
                                                            color: "var(--primary-contrast)",
                                                        }}
                                                    >
                                                        עריכה
                                                    </button>
                                                    {user.status !== "archived" && (
                                                        <button
                                                            onClick={() => handleArchiveUser(user.id)}
                                                            className="rounded-theme-sm px-3 py-1.5 text-xs font-medium"
                                                            style={{
                                                                backgroundColor: "var(--muted)",
                                                                color: "var(--primary-contrast)",
                                                            }}
                                                        >
                                                            השבתה
                                                        </button>
                                                    )}
                                                    {user.activeDeviceId && (
                                                        <button
                                                            onClick={() => handleResetDevice(user.id)}
                                                            className="rounded-theme-sm px-3 py-1.5 text-xs font-medium"
                                                            style={{
                                                                backgroundColor: "var(--warning)",
                                                                color: "var(--primary-contrast)",
                                                            }}
                                                        >
                                                            איפוס מכשיר
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Desktop: Table View */}
                                <div className="hidden md:block overflow-hidden rounded-theme-lg bg-surface shadow-theme-md">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y" style={{ borderColor: "var(--table-border)" }}>
                                            <thead className="table-header">
                                                <tr>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        אימייל
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        שם
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        טלפון
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        דירה + קומה
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        סטטוס
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        מכשיר פעיל
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        תאריך יצירה
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        פעולות
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y bg-surface" style={{ borderColor: "var(--table-border)" }}>
                                                {usersData.items.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={8}
                                                            className="px-6 py-4 text-center text-sm text-muted"
                                                        >
                                                            אין משתמשים להצגה
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    usersData.items.map((user) => (
                                                        <tr
                                                            key={user.id}
                                                            className="table-row"
                                                        >
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm" style={{ color: "var(--text)" }}>
                                                                {user.email}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm" style={{ color: "var(--text)" }}>
                                                                {user.firstName} {user.lastName}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm" style={{ color: "var(--text)" }}>
                                                                {user.phone}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm" style={{ color: "var(--text)" }}>
                                                                {user.apartmentNumber} / {user.floor}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                                {user.status === "approved" ? (
                                                                    <span className="badge-success inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                        מאושר
                                                                    </span>
                                                                ) : user.status === "pending" ? (
                                                                    <span className="badge-warning inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                        ממתין
                                                                    </span>
                                                                ) : user.status === "rejected" ? (
                                                                    <span className="badge-danger inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                        נדחה
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge-muted inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                        מושבת
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-muted">
                                                                {user.activeDeviceId ? (
                                                                    <span className="text-success">
                                                                        {user.activeDeviceId.substring(0, 8)}...
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted">אין</span>
                                                                )}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                                                                {new Date(user.createdAt).toLocaleString("he-IL")}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {user.status === "pending" && (
                                                                        <>
                                                                            <button
                                                                                onClick={() =>
                                                                                    handleApproveUser(user.id)
                                                                                }
                                                                                className="rounded-theme-sm px-3 py-1 text-xs font-medium"
                                                                                style={{
                                                                                    backgroundColor: "var(--success)",
                                                                                    color: "var(--primary-contrast)",
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    e.currentTarget.style.opacity = "0.9";
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.style.opacity = "1";
                                                                                }}
                                                                            >
                                                                                אישור
                                                                            </button>
                                                                            <button
                                                                                onClick={() => openRejectModal(user)}
                                                                                className="rounded-theme-sm px-3 py-1 text-xs font-medium"
                                                                                style={{
                                                                                    backgroundColor: "var(--danger)",
                                                                                    color: "var(--primary-contrast)",
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    e.currentTarget.style.opacity = "0.9";
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.style.opacity = "1";
                                                                                }}
                                                                            >
                                                                                דחייה
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <button
                                                                        onClick={() => openEditModal(user)}
                                                                        className="rounded-theme-sm px-3 py-1 text-xs font-medium"
                                                                        style={{
                                                                            backgroundColor: "var(--primary)",
                                                                            color: "var(--primary-contrast)",
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            e.currentTarget.style.backgroundColor = "var(--primary-hover)";
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            e.currentTarget.style.backgroundColor = "var(--primary)";
                                                                        }}
                                                                    >
                                                                        עריכה
                                                                    </button>
                                                                    {user.status !== "archived" && (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleArchiveUser(user.id)
                                                                            }
                                                                            className="rounded-theme-sm px-3 py-1 text-xs font-medium"
                                                                            style={{
                                                                                backgroundColor: "var(--muted)",
                                                                                color: "var(--primary-contrast)",
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.opacity = "0.9";
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.opacity = "1";
                                                                            }}
                                                                        >
                                                                            השבתה
                                                                        </button>
                                                                    )}
                                                                    {user.activeDeviceId && (
                                                                        <button
                                                                            onClick={() =>
                                                                                handleResetDevice(user.id)
                                                                            }
                                                                            className="rounded-theme-sm px-3 py-1 text-xs font-medium"
                                                                            style={{
                                                                                backgroundColor: "var(--warning)",
                                                                                color: "var(--primary-contrast)",
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.opacity = "0.9";
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.opacity = "1";
                                                                            }}
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
                                    <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3 rounded-theme-md border border-theme bg-surface px-4 py-3">
                                        <div className="text-xs md:text-sm font-medium text-center md:text-right" style={{ color: "var(--text)" }}>
                                            עמוד {usersData.page} מתוך {usersData.totalPages} ({usersData.total} משתמשים)
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap justify-center">
                                            <button
                                                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                                                disabled={usersData.page === 1}
                                                className="rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                style={{ color: "var(--text)" }}
                                            >
                                                הקודם
                                            </button>
                                            <div className="flex gap-1 flex-wrap justify-center">
                                                {getPageNumbers(usersData.page, usersData.totalPages).map(
                                                    (page, idx) => {
                                                        if (page === "ellipsis") {
                                                            return (
                                                                <span
                                                                    key={`ellipsis-${idx}`}
                                                                    className="px-2 py-2 text-xs md:text-sm text-muted"
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
                                                                className={`min-w-[2rem] md:min-w-[2.5rem] rounded-theme-md border px-2 md:px-3 py-2 text-xs md:text-sm font-medium transition-colors ${
                                                                    isActive
                                                                        ? "bg-primary text-primary-contrast"
                                                                        : "border-theme bg-surface text-muted hover:bg-surface-2"
                                                                }`}
                                                                style={isActive ? {} : { color: "var(--muted)" }}
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
                                                className="rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                style={{ color: "var(--text)" }}
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
                        {/* Filters - Mobile: vertical, Desktop: horizontal */}
                        <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
                            <input
                                type="text"
                                placeholder="חיפוש לפי אימייל..."
                                value={logsEmailSearch}
                                onChange={(e) => setLogsEmailSearch(e.target.value)}
                                className="input-theme flex-1 w-full px-4 py-2 text-sm placeholder:text-muted focus-theme"
                                style={{ color: "var(--text)" }}
                            />

                            <select
                                value={logsOpenedBy}
                                onChange={(e) => {
                                    setLogsOpenedBy(e.target.value as OpenedByFilter);
                                    setLogsPage(1);
                                }}
                                className="input-theme px-4 py-2 text-sm focus-theme w-full sm:w-auto"
                                style={{ color: "var(--text)" }}
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
                                className="input-theme px-4 py-2 text-sm focus-theme w-full sm:w-auto"
                                style={{ color: "var(--text)" }}
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
                                <div className="text-lg text-muted">טוען...</div>
                            </div>
                        ) : error && error.includes("הרשאה") ? (
                            <div className="rounded-theme-md border p-4" style={{ backgroundColor: "var(--danger)", borderColor: "var(--danger)", opacity: 0.1 }}>
                                <p style={{ color: "var(--danger)" }}>{error}</p>
                            </div>
                        ) : logsData ? (
                            <>
                                {/* Mobile: Cards View */}
                                <div className="md:hidden space-y-3">
                                    {logsData.items.length === 0 ? (
                                        <div className="rounded-theme-md border p-4 text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                                            <p className="text-sm text-muted">אין לוגים להצגה</p>
                                        </div>
                                    ) : (
                                        logsData.items.map((log) => (
                                            <div
                                                key={log.id}
                                                className="rounded-theme-md border p-4 space-y-2"
                                                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-xs text-muted">{new Date(log.createdAt).toLocaleString("he-IL")}</p>
                                                        <p className="text-sm font-semibold mt-1" style={{ color: "var(--text)" }}>
                                                            {log.email || "-"}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs px-2 py-1 rounded-theme-sm" style={{
                                                        backgroundColor: log.openedBy === "user" ? "var(--primary)" : "var(--warning)",
                                                        color: "var(--primary-contrast)",
                                                        opacity: 0.8
                                                    }}>
                                                        {log.openedBy === "user" ? "משתמש" : "אדמין"}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">מזהה מכשיר:</span>
                                                        <span className="font-mono text-muted">
                                                            {log.deviceId ? `${log.deviceId.substring(0, 8)}...` : "-"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">IP:</span>
                                                        <span className="font-mono text-muted">{log.ip || "-"}</span>
                                                    </div>
                                                    {log.userAgent && (
                                                        <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                                                            <span className="text-muted block mb-1">User Agent:</span>
                                                            <span className="text-muted text-xs break-all">{log.userAgent}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Desktop: Table View */}
                                <div className="hidden md:block overflow-hidden rounded-theme-lg bg-surface shadow-theme-md">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y" style={{ borderColor: "var(--table-border)" }}>
                                            <thead className="table-header">
                                                <tr>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        תאריך ושעה
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        נפתח על ידי
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        אימייל
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        מזהה מכשיר
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        IP
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        User Agent
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y bg-surface" style={{ borderColor: "var(--table-border)" }}>
                                                {logsData.items.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-6 py-4 text-center text-sm text-muted"
                                                        >
                                                            אין לוגים להצגה
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    logsData.items.map((log) => (
                                                        <tr
                                                            key={log.id}
                                                            className="table-row"
                                                        >
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                                                                {new Date(log.createdAt).toLocaleString("he-IL")}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm" style={{ color: "var(--text)" }}>
                                                                {log.openedBy === "user"
                                                                    ? "משתמש"
                                                                    : "אדמין (דלת אחורית)"}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm" style={{ color: "var(--text)" }}>
                                                                {log.email || "-"}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-muted">
                                                                {log.deviceId
                                                                    ? log.deviceId.substring(0, 8) + "..."
                                                                    : "-"}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-muted">
                                                                {log.ip || "-"}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-muted">
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
                                    <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3 rounded-theme-md border border-theme bg-surface px-4 py-3">
                                        <div className="text-xs md:text-sm font-medium text-center md:text-right" style={{ color: "var(--text)" }}>
                                            עמוד {logsData.page} מתוך {logsData.totalPages} ({logsData.total} לוגים)
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap justify-center">
                                            <button
                                                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                                                disabled={logsData.page === 1}
                                                className="rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                style={{ color: "var(--text)" }}
                                            >
                                                הקודם
                                            </button>
                                            <div className="flex gap-1 flex-wrap justify-center">
                                                {getPageNumbers(logsData.page, logsData.totalPages).map(
                                                    (page, idx) => {
                                                        if (page === "ellipsis") {
                                                            return (
                                                                <span
                                                                    key={`ellipsis-${idx}`}
                                                                    className="px-2 py-2 text-xs md:text-sm text-muted"
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
                                                                className={`min-w-[2rem] md:min-w-[2.5rem] rounded-theme-md border px-2 md:px-3 py-2 text-xs md:text-sm font-medium transition-colors ${
                                                                    isActive
                                                                        ? "bg-primary text-primary-contrast"
                                                                        : "border-theme bg-surface text-muted hover:bg-surface-2"
                                                                }`}
                                                                style={isActive ? {} : { color: "var(--muted)" }}
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
                                                className="rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                style={{ color: "var(--text)" }}
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

                {/* Reject Modal */}
                {rejectModalOpen && selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
                        <div className="card-theme w-full max-w-md p-6 shadow-theme-lg">
                            <h3 className="mb-4 text-lg font-bold" style={{ color: "var(--text)" }}>
                                דחיית משתמש
                            </h3>
                            <p className="mb-4 text-sm text-muted">
                                אנא הזן סיבת דחייה עבור {selectedUser.email}
                            </p>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="סיבת דחייה..."
                                className="input-theme mb-4 w-full px-3 py-2 text-sm focus-theme"
                                style={{ color: "var(--text)" }}
                                rows={4}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setRejectModalOpen(false);
                                        setSelectedUser(null);
                                        setRejectionReason("");
                                    }}
                                    className="flex-1 rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
                                    style={{ color: "var(--text)" }}
                                >
                                    ביטול
                                </button>
                                <button
                                    onClick={handleRejectUser}
                                    className="flex-1 rounded-theme-md px-4 py-2 text-sm font-medium"
                                    style={{
                                        backgroundColor: "var(--danger)",
                                        color: "var(--primary-contrast)",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = "0.9";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = "1";
                                    }}
                                >
                                    דחייה
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editModalOpen && selectedUser && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        style={{
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            backdropFilter: "blur(4px)",
                            WebkitBackdropFilter: "blur(4px)",
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                closeEditModal();
                            }
                        }}
                    >
                        <div
                            className="bg-surface border-t border-b border-theme w-full max-w-md p-6 shadow-theme-lg"
                            style={{ borderRadius: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                                    עריכת משתמש
                                </h3>
                                <button
                                    onClick={closeEditModal}
                                    className="p-1 hover:bg-surface-2 transition-colors"
                                    aria-label="סגור"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        style={{ color: "var(--muted)" }}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                        שם פרטי
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.firstName}
                                        onChange={(e) =>
                                            setEditFormData({ ...editFormData, firstName: e.target.value })
                                        }
                                        className="input-theme mt-1 w-full px-3 py-2 text-sm focus-theme"
                                        style={{ color: "var(--text)" }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                        שם משפחה
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.lastName}
                                        onChange={(e) =>
                                            setEditFormData({ ...editFormData, lastName: e.target.value })
                                        }
                                        className="input-theme mt-1 w-full px-3 py-2 text-sm focus-theme"
                                        style={{ color: "var(--text)" }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                        טלפון
                                    </label>
                                    <div className="mt-1 flex gap-2">
                                        <input
                                            type="tel"
                                            value={editFormData.phoneNumber}
                                            onChange={(e) => {
                                                // Strip non-digits and leading 0
                                                const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                                                setEditFormData({
                                                    ...editFormData,
                                                    phoneNumber: digits,
                                                });
                                            }}
                                            className="input-theme flex-1 px-3 py-2 text-sm focus-theme"
                                            style={{ color: "var(--text)" }}
                                            placeholder="1234567"
                                            maxLength={7}
                                        />
                                        <select
                                            value={editFormData.phonePrefix}
                                            onChange={(e) =>
                                                setEditFormData({
                                                    ...editFormData,
                                                    phonePrefix: e.target.value,
                                                })
                                            }
                                            className="input-theme w-24 px-3 py-2 text-sm focus-theme"
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
                                    {editFormData.phonePrefix &&
                                        editFormData.phoneNumber &&
                                        !validatePhoneNumber(editFormData.phonePrefix, editFormData.phoneNumber) && (
                                            <p className="mt-1 text-sm text-danger">מספר טלפון לא תקין</p>
                                        )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                            מספר דירה
                                        </label>
                                        <input
                                            type="number"
                                            value={editFormData.apartmentNumber}
                                            onChange={(e) =>
                                                setEditFormData({ ...editFormData, apartmentNumber: e.target.value })
                                            }
                                            className="input-theme mt-1 w-full px-3 py-2 text-sm focus-theme"
                                            style={{ color: "var(--text)" }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                            קומה
                                        </label>
                                        <input
                                            type="number"
                                            value={editFormData.floor}
                                            onChange={(e) =>
                                                setEditFormData({ ...editFormData, floor: e.target.value })
                                            }
                                            className="input-theme mt-1 w-full px-3 py-2 text-sm focus-theme"
                                            style={{ color: "var(--text)" }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                        סטטוס
                                    </label>
                                    <select
                                        value={editFormData.status}
                                        onChange={(e) =>
                                            setEditFormData({
                                                ...editFormData,
                                                status: e.target.value as "pending" | "approved" | "rejected" | "archived",
                                            })
                                        }
                                        className="input-theme mt-1 w-full px-3 py-2 text-sm focus-theme"
                                        style={{ color: "var(--text)" }}
                                    >
                                        <option value="pending">ממתין</option>
                                        <option value="approved">מאושר</option>
                                        <option value="rejected">נדחה</option>
                                        <option value="archived">מושבת</option>
                                    </select>
                                </div>
                                {editFormData.status === "rejected" && (
                                    <div>
                                        <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                            סיבת דחייה
                                        </label>
                                        <textarea
                                            value={editFormData.rejectionReason}
                                            onChange={(e) =>
                                                setEditFormData({ ...editFormData, rejectionReason: e.target.value })
                                            }
                                            placeholder="סיבת דחייה..."
                                            className="input-theme mt-1 w-full px-3 py-2 text-sm focus-theme"
                                            style={{ color: "var(--text)" }}
                                            rows={3}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 flex gap-2">
                                <button
                                    onClick={closeEditModal}
                                    className="flex-1 rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
                                    style={{
                                        color: "var(--text)",
                                    }}
                                >
                                    ביטול
                                </button>
                                <button
                                    onClick={handleEditUser}
                                    disabled={!editFormHasChanges}
                                    className="flex-1 rounded-theme-md px-4 py-2 text-sm font-medium transition-colors"
                                    style={{
                                        backgroundColor: editFormHasChanges ? "var(--primary)" : "var(--muted)",
                                        color: "var(--primary-contrast)",
                                        opacity: editFormHasChanges ? 1 : 0.6,
                                        cursor: editFormHasChanges ? "pointer" : "not-allowed",
                                    }}
                                >
                                    עדכן
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal Close Confirmation */}
                {editModalConfirmClose && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center"
                        style={{
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            backdropFilter: "blur(4px)",
                            WebkitBackdropFilter: "blur(4px)",
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                cancelCloseEditModal();
                            }
                        }}
                    >
                        <div
                            className="bg-surface border-t border-b border-theme w-full max-w-md p-6 shadow-theme-lg"
                            style={{ borderRadius: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="mb-4 text-lg font-bold" style={{ color: "var(--text)" }}>
                                שינויים שלא נשמרו
                            </h3>
                            <p className="mb-6 text-sm" style={{ color: "var(--text)" }}>
                                יש לך שינויים שלא נשמרו. האם אתה בטוח שברצונך לסגור?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={cancelCloseEditModal}
                                    className="flex-1 rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
                                    style={{
                                        color: "var(--text)",
                                    }}
                                >
                                    המשך עריכה
                                </button>
                                <button
                                    onClick={confirmCloseEditModal}
                                    className="flex-1 rounded-theme-md px-4 py-2 text-sm font-medium"
                                    style={{
                                        backgroundColor: "var(--danger)",
                                        color: "var(--primary-contrast)",
                                    }}
                                >
                                    סגור ללא שמירה
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

