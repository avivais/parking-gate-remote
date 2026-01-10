"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, ApiError, AUTH_FORBIDDEN } from "@/lib/api";
import { ISRAEL_PHONE_PREFIXES, parsePhone, validatePhoneNumber } from "@/lib/phone";
import { formatRelativeTime } from "@/lib/time";
import type {
    PaginatedUsersResponse,
    PaginatedLogsResponse,
    AdminUser,
    DeviceStatusResponse,
} from "@/types/auth";
import toast from "react-hot-toast";
import { Terminal } from "@/components/Terminal";

type Tab = "users" | "logs" | "devices" | "terminal";

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

interface AdminPageContentProps {
    defaultTab: Tab;
}

export default function AdminPageContent({ defaultTab }: AdminPageContentProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Detect active tab from pathname
    const getTabFromPath = useCallback((): Tab => {
        if (pathname.endsWith("/users")) return "users";
        if (pathname.endsWith("/logs")) return "logs";
        if (pathname.endsWith("/devices")) return "devices";
        if (pathname.endsWith("/terminal")) return "terminal";
        return defaultTab;
    }, [pathname, defaultTab]);

    const activeTab = getTabFromPath();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track if we're initializing from URL to prevent URL updates during initialization
    const isInitialMount = useRef(true);
    useEffect(() => {
        isInitialMount.current = false;
    }, []);

    // Helper function to update URL search params
    const updateURLParams = useCallback((updates: Record<string, string | number | null | undefined>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined || value === "") {
                params.delete(key);
            } else {
                params.set(key, String(value));
            }
        });
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    // Users state - initialize from URL params
    const [usersData, setUsersData] = useState<PaginatedUsersResponse | null>(null);
    const [usersStatusFilter, setUsersStatusFilter] = useState<UserStatusFilter>(() => {
        const status = searchParams.get("status") as UserStatusFilter | null;
        return status && ["pending", "approved", "rejected", "archived", "all"].includes(status)
            ? status
            : "pending";
    });
    const [usersSearchQuery, setUsersSearchQuery] = useState(() => searchParams.get("q") || "");
    const [usersSearchDebounced, setUsersSearchDebounced] = useState(() => searchParams.get("q") || "");
    const [usersPage, setUsersPage] = useState(() => {
        const page = searchParams.get("page");
        return page ? parseInt(page, 10) || 1 : 1;
    });
    const [usersLimit, setUsersLimit] = useState(() => {
        const limit = searchParams.get("limit");
        return limit ? parseInt(limit, 10) || 20 : 20;
    });
    const [usersSortField, setUsersSortField] = useState<"name" | "apartmentNumber" | "createdAt" | "approvalDate">(() => {
        const field = searchParams.get("sortField");
        return field && ["name", "apartmentNumber", "createdAt", "approvalDate"].includes(field)
            ? field as "name" | "apartmentNumber" | "createdAt" | "approvalDate"
            : "createdAt";
    });
    const [usersSortOrder, setUsersSortOrder] = useState<"asc" | "desc">(() => {
        const order = searchParams.get("sortOrder");
        return order === "asc" || order === "desc" ? order : "desc";
    });

    // Modal state
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editModalConfirmClose, setEditModalConfirmClose] = useState(false);
    const [approveAllModalOpen, setApproveAllModalOpen] = useState(false);
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
        role: "user" as "user" | "admin",
    });
    const [passwordFormData, setPasswordFormData] = useState({
        newPassword: "",
        confirmPassword: "",
    });
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    // Logs state - initialize from URL params
    const [logsData, setLogsData] = useState<PaginatedLogsResponse | null>(null);
    const [logsEmailSearch, setLogsEmailSearch] = useState(() => searchParams.get("email") || "");
    const [logsEmailDebounced, setLogsEmailDebounced] = useState(() => searchParams.get("email") || "");
    const [logsOpenedBy, setLogsOpenedBy] = useState<OpenedByFilter>(() => {
        const openedBy = searchParams.get("openedBy") as OpenedByFilter | null;
        return openedBy && ["all", "user", "admin-backdoor"].includes(openedBy) ? openedBy : "all";
    });
    const [logsPage, setLogsPage] = useState(() => {
        const page = searchParams.get("page");
        return page ? parseInt(page, 10) || 1 : 1;
    });
    const [logsLimit, setLogsLimit] = useState(() => {
        const limit = searchParams.get("limit");
        return limit ? parseInt(limit, 10) || 50 : 50;
    });
    const [selectedLog, setSelectedLog] = useState<PaginatedLogsResponse['items'][0] | null>(null);
    const [logModalOpen, setLogModalOpen] = useState(false);

    // Device status state
    const [deviceStatusData, setDeviceStatusData] = useState<DeviceStatusResponse | null>(null);

    // Debounce users search and update URL (skip on initial mount)
    useEffect(() => {
        const timer = setTimeout(() => {
            setUsersSearchDebounced(usersSearchQuery);
            if (!isInitialMount.current && activeTab === "users") {
                updateURLParams({ q: usersSearchQuery || null, page: 1 });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [usersSearchQuery, activeTab, updateURLParams]);

    // Update users page in URL (skip on initial mount)
    useEffect(() => {
        if (isInitialMount.current || activeTab !== "users") return;
        updateURLParams({ page: usersPage });
    }, [usersPage, activeTab, updateURLParams]);

    // Update users limit in URL (skip on initial mount)
    useEffect(() => {
        if (isInitialMount.current || activeTab !== "users") return;
        updateURLParams({ limit: usersLimit });
    }, [usersLimit, activeTab, updateURLParams]);

    // Update users status filter in URL (skip on initial mount)
    useEffect(() => {
        if (isInitialMount.current || activeTab !== "users") return;
        updateURLParams({ status: usersStatusFilter });
    }, [usersStatusFilter, activeTab, updateURLParams]);

    // Update users sort in URL (skip on initial mount)
    useEffect(() => {
        if (isInitialMount.current || activeTab !== "users") return;
        updateURLParams({ sortField: usersSortField, sortOrder: usersSortOrder });
    }, [usersSortField, usersSortOrder, activeTab, updateURLParams]);

    // Debounce logs email search and update URL (skip on initial mount)
    useEffect(() => {
        const timer = setTimeout(() => {
            setLogsEmailDebounced(logsEmailSearch);
            if (!isInitialMount.current && activeTab === "logs") {
                updateURLParams({ email: logsEmailSearch || null, page: 1 });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [logsEmailSearch, activeTab, updateURLParams]);

    // Update logs page in URL (skip on initial mount)
    useEffect(() => {
        if (isInitialMount.current || activeTab !== "logs") return;
        updateURLParams({ page: logsPage });
    }, [logsPage, activeTab, updateURLParams]);

    // Update logs limit in URL (skip on initial mount)
    useEffect(() => {
        if (isInitialMount.current || activeTab !== "logs") return;
        updateURLParams({ limit: logsLimit });
    }, [logsLimit, activeTab, updateURLParams]);

    // Update logs openedBy in URL (skip on initial mount)
    useEffect(() => {
        if (isInitialMount.current || activeTab !== "logs") return;
        updateURLParams({ openedBy: logsOpenedBy === "all" ? null : logsOpenedBy });
    }, [logsOpenedBy, activeTab, updateURLParams]);

    // Sync state from URL params when pathname changes (tab switching) or on mount
    // Use a ref to track previous pathname to only sync on actual tab changes
    const prevPathnameRef = useRef(pathname);
    useEffect(() => {
        const prevPathname = prevPathnameRef.current;
        prevPathnameRef.current = pathname;

        // Only sync if pathname actually changed (tab switch) or on initial mount
        if (pathname === prevPathname && !isInitialMount.current) return;

        const currentTab = getTabFromPath();

        if (currentTab === "users") {
            // Read users params from URL
            const status = searchParams.get("status") as UserStatusFilter | null;
            const newStatus = status && ["pending", "approved", "rejected", "archived", "all"].includes(status)
                ? status
                : "pending";
            if (newStatus !== usersStatusFilter) {
                setUsersStatusFilter(newStatus);
            }

            const page = searchParams.get("page");
            const parsedPage = page ? parseInt(page, 10) : 1;
            if (parsedPage !== usersPage) {
                setUsersPage(parsedPage);
            }

            const limit = searchParams.get("limit");
            const parsedLimit = limit ? parseInt(limit, 10) : 20;
            if (parsedLimit !== usersLimit) {
                setUsersLimit(parsedLimit);
            }

            const q = searchParams.get("q") || "";
            if (q !== usersSearchQuery) {
                setUsersSearchQuery(q);
                setUsersSearchDebounced(q);
            }

            const sortField = searchParams.get("sortField");
            const newSortField = sortField && ["name", "apartmentNumber", "createdAt", "approvalDate"].includes(sortField)
                ? sortField as "name" | "apartmentNumber" | "createdAt" | "approvalDate"
                : "createdAt";
            if (newSortField !== usersSortField) {
                setUsersSortField(newSortField);
            }

            const sortOrder = searchParams.get("sortOrder");
            const newSortOrder = sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";
            if (newSortOrder !== usersSortOrder) {
                setUsersSortOrder(newSortOrder);
            }
        } else if (currentTab === "logs") {
            // Read logs params from URL
            const page = searchParams.get("page");
            const parsedPage = page ? parseInt(page, 10) : 1;
            if (parsedPage !== logsPage) {
                setLogsPage(parsedPage);
            }

            const limit = searchParams.get("limit");
            const parsedLimit = limit ? parseInt(limit, 10) : 50;
            if (parsedLimit !== logsLimit) {
                setLogsLimit(parsedLimit);
            }

            const email = searchParams.get("email") || "";
            if (email !== logsEmailSearch) {
                setLogsEmailSearch(email);
                setLogsEmailDebounced(email);
            }

            const openedBy = searchParams.get("openedBy") as OpenedByFilter | null;
            const newOpenedBy = openedBy && ["all", "user", "admin-backdoor"].includes(openedBy) ? openedBy : "all";
            if (newOpenedBy !== logsOpenedBy) {
                setLogsOpenedBy(newOpenedBy);
            }
        }
    }, [pathname, searchParams, getTabFromPath, usersStatusFilter, usersPage, usersLimit, usersSearchQuery, usersSortField, usersSortOrder, logsPage, logsLimit, logsEmailSearch, logsOpenedBy]);

    // Load users
    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                status: usersStatusFilter,
                page: usersPage.toString(),
                limit: usersLimit.toString(),
                sortField: usersSortField,
                sortOrder: usersSortOrder,
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
    }, [usersStatusFilter, usersSearchDebounced, usersPage, usersLimit, usersSortField, usersSortOrder]);

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

    // Load device status with staleness check
    const loadDeviceStatus = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
            setError(null);
        }
        try {
            const data = await apiRequest<DeviceStatusResponse>("/admin/device-status");
            // Apply staleness check - device must be marked online AND seen within last 60 seconds
            const now = Date.now();
            const STALE_THRESHOLD_MS = 60000; // 60 seconds
            const processedData: DeviceStatusResponse = {
                ...data,
                items: data.items.map(device => {
                    const lastSeen = new Date(device.lastSeenAt).getTime();
                    const isActuallyOnline = device.online && (now - lastSeen) < STALE_THRESHOLD_MS;
                    return {
                        ...device,
                        online: isActuallyOnline
                    };
                })
            };
            setDeviceStatusData(processedData);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.message === AUTH_FORBIDDEN || err.status === 403) {
                    setError("אין לך הרשאה לצפות בסטטוס מכשירים");
                } else {
                    setError(err.message || "שגיאה בטעינת סטטוס מכשירים");
                }
            } else {
                setError("שגיאה בטעינת סטטוס מכשירים");
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    // Load data when tab or filters change
    useEffect(() => {
        if (activeTab === "users") {
            loadUsers();
        } else if (activeTab === "logs") {
            loadLogs();
        } else if (activeTab === "devices") {
            loadDeviceStatus();
            // Refresh device status every 5 seconds (silent refresh)
            const interval = setInterval(() => loadDeviceStatus(true), 5000);
            return () => clearInterval(interval);
        }
    }, [activeTab, loadUsers, loadLogs, loadDeviceStatus]);

    // Reload users when status filter changes
    useEffect(() => {
        if (activeTab === "users") {
            loadUsers();
        }
    }, [usersStatusFilter, activeTab, loadUsers]);

    // Handle approve user
    const handleApproveUser = async (userId: string) => {
        try {
            await apiRequest(`/admin/users/${userId}`, {
                method: "PATCH",
                body: { status: "approved" },
            });
            toast.success("המשתמש אושר בהצלחה");
            // Refresh the current view - ensure we reload with current filter
            // Reset to page 1 if needed to avoid showing empty pages
            if (usersPage !== 1) {
                setUsersPage(1);
            }
            await loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה באישור המשתמש");
            } else {
                toast.error("שגיאה באישור המשתמש");
            }
        }
    };

    // Handle approve all pending users
    const handleApproveAll = async () => {
        try {
            setApproveAllModalOpen(false);
            const response = await apiRequest<{ count: number }>("/admin/users/approve-all", {
                method: "POST",
            });
            toast.success(`${response.count} משתמשים אושרו בהצלחה`);
            // Reset to page 1 and reload
            setUsersPage(1);
            await loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה באישור כל המשתמשים");
            } else {
                toast.error("שגיאה באישור כל המשתמשים");
            }
        }
    };

    // Handle send approval email
    const handleSendApprovalEmail = async (userId: string) => {
        try {
            await apiRequest(`/admin/users/${userId}/send-approval-email`, {
                method: "POST",
            });
            toast.success("מייל אישור נשלח בהצלחה");
            await loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה בשליחת מייל אישור");
            } else {
                toast.error("שגיאה בשליחת מייל אישור");
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
            // Update user data
            await apiRequest(`/admin/users/${selectedUser.id}`, {
                method: "PATCH",
                body: updateData,
            });

            // Update role if changed
            if (editFormData.role !== selectedUser.role) {
                await apiRequest(`/admin/users/${selectedUser.id}/role`, {
                    method: "PATCH",
                    body: { role: editFormData.role },
                });
            }

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

    // Handle role update
    const handleUpdateRole = async (userId: string, role: "user" | "admin") => {
        try {
            await apiRequest(`/admin/users/${userId}/role`, {
                method: "PATCH",
                body: { role },
            });
            toast.success(`התפקיד עודכן ל-${role === "admin" ? "אדמין" : "משתמש"}`);
            loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה בעדכון התפקיד");
            } else {
                toast.error("שגיאה בעדכון התפקיד");
            }
        }
    };

    // Handle password reset
    const handleResetPassword = async () => {
        if (!selectedUser) return;

        if (!passwordFormData.newPassword || !passwordFormData.confirmPassword) {
            toast.error("יש להזין סיסמה ואישור סיסמה");
            return;
        }

        if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
            toast.error("סיסמה ואישור סיסמה אינם תואמים");
            return;
        }

        if (passwordFormData.newPassword.length < 6) {
            toast.error("סיסמה חייבת להכיל לפחות 6 תווים");
            return;
        }

        try {
            await apiRequest(`/admin/users/${selectedUser.id}/password`, {
                method: "PATCH",
                body: {
                    newPassword: passwordFormData.newPassword,
                    confirmPassword: passwordFormData.confirmPassword,
                },
            });
            toast.success("סיסמה עודכנה והכל המכשירים התנתקו");
            setPasswordFormData({
                newPassword: "",
                confirmPassword: "",
            });
            setIsResettingPassword(false);
            loadUsers();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message || "שגיאה בעדכון הסיסמה");
            } else {
                toast.error("שגיאה בעדכון הסיסמה");
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
            role: user.role,
        });
        setPasswordFormData({
            newPassword: "",
            confirmPassword: "",
        });
        setIsResettingPassword(false);
        setEditModalOpen(true);
        setEditModalConfirmClose(false);
    };

    // Handle column sort
    const handleSort = (field: "name" | "apartmentNumber" | "createdAt" | "approvalDate") => {
        if (usersSortField === field) {
            // Toggle sort order if clicking the same field
            setUsersSortOrder(usersSortOrder === "asc" ? "desc" : "asc");
        } else {
            // Set new field and default to descending (except for createdAt which should default to desc for newest first)
            setUsersSortField(field);
            setUsersSortOrder(field === "createdAt" ? "desc" : "asc");
        }
        setUsersPage(1); // Reset to first page when sorting changes
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
            editFormData.role !== selectedUser.role ||
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

    // ESC key handler for modals
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (rejectModalOpen) {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                } else if (approveAllModalOpen) {
                    setApproveAllModalOpen(false);
                } else if (editModalOpen) {
                    if (editFormHasChanges || isResettingPassword) {
                        if (!editModalConfirmClose) {
                            setEditModalConfirmClose(true);
                            return;
                        }
                    }
                    // Close modal logic (similar to closeEditModal but defined inline)
                    setEditModalOpen(false);
                    setSelectedUser(null);
                    setEditModalConfirmClose(false);
                    setPasswordFormData({ newPassword: "", confirmPassword: "" });
                    setIsResettingPassword(false);
                } else if (logModalOpen) {
                    setLogModalOpen(false);
                    setSelectedLog(null);
                }
            }
        };

        if (rejectModalOpen || approveAllModalOpen || editModalOpen || logModalOpen) {
            document.addEventListener("keydown", handleEscapeKey);
            return () => {
                document.removeEventListener("keydown", handleEscapeKey);
            };
        }
    }, [rejectModalOpen, approveAllModalOpen, editModalOpen, logModalOpen, editFormHasChanges, isResettingPassword, editModalConfirmClose]);

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
    const handleResetDevice = async (userId: string, deviceId?: string) => {
        try {
            await apiRequest(`/admin/users/${userId}/reset-device`, {
                method: "POST",
                body: deviceId ? { deviceId } : {},
            });
            toast.success(deviceId ? "המכשיר נותק בהצלחה" : "כל המכשירים נותקו בהצלחה");
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
                            onClick={activeTab === "users" ? undefined : () => router.push("/admin/users")}
                            disabled={activeTab === "users"}
                            className={`border-b-2 px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap -mb-px ${
                                activeTab === "users"
                                    ? "border-primary text-primary nav-item-active"
                                    : "border-transparent text-muted nav-item-inactive"
                            }`}
                            style={activeTab === "users" ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}
                        >
                            משתמשים
                        </button>
                        <button
                            onClick={activeTab === "logs" ? undefined : () => router.push("/admin/logs")}
                            disabled={activeTab === "logs"}
                            className={`border-b-2 px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap -mb-px ${
                                activeTab === "logs"
                                    ? "border-primary text-primary nav-item-active"
                                    : "border-transparent text-muted nav-item-inactive"
                            }`}
                            style={activeTab === "logs" ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}
                        >
                            לוגים
                        </button>
                        <button
                            onClick={activeTab === "devices" ? undefined : () => router.push("/admin/devices")}
                            disabled={activeTab === "devices"}
                            className={`border-b-2 px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap -mb-px ${
                                activeTab === "devices"
                                    ? "border-primary text-primary nav-item-active"
                                    : "border-transparent text-muted nav-item-inactive"
                            }`}
                            style={activeTab === "devices" ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}
                        >
                            מכשירים
                        </button>
                        <button
                            onClick={activeTab === "terminal" ? undefined : () => router.push("/admin/terminal")}
                            disabled={activeTab === "terminal"}
                            className={`border-b-2 px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap -mb-px ${
                                activeTab === "terminal"
                                    ? "border-primary text-primary nav-item-active"
                                    : "border-transparent text-muted nav-item-inactive"
                            }`}
                            style={activeTab === "terminal" ? { borderColor: "var(--primary)", color: "var(--primary)" } : {}}
                        >
                            מסוף
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
                                    onClick={
                                        usersStatusFilter === "pending"
                                            ? undefined
                                            : () => {
                                                  setUsersStatusFilter("pending");
                                                  setUsersPage(1);
                                              }
                                    }
                                    disabled={usersStatusFilter === "pending"}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "pending"
                                            ? "bg-primary text-primary-contrast nav-item-active"
                                            : "bg-surface-2 text-muted nav-item-inactive"
                                    }`}
                                    style={usersStatusFilter === "pending" ? {} : { color: "var(--muted)" }}
                                >
                                    ממתינים
                                </button>
                                <button
                                    onClick={
                                        usersStatusFilter === "approved"
                                            ? undefined
                                            : () => {
                                                  setUsersStatusFilter("approved");
                                                  setUsersPage(1);
                                              }
                                    }
                                    disabled={usersStatusFilter === "approved"}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "approved"
                                            ? "bg-primary text-primary-contrast nav-item-active"
                                            : "bg-surface-2 text-muted nav-item-inactive"
                                    }`}
                                    style={usersStatusFilter === "approved" ? {} : { color: "var(--muted)" }}
                                >
                                    מאושרים
                                </button>
                                <button
                                    onClick={
                                        usersStatusFilter === "rejected"
                                            ? undefined
                                            : () => {
                                                  setUsersStatusFilter("rejected");
                                                  setUsersPage(1);
                                              }
                                    }
                                    disabled={usersStatusFilter === "rejected"}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "rejected"
                                            ? "bg-primary text-primary-contrast nav-item-active"
                                            : "bg-surface-2 text-muted nav-item-inactive"
                                    }`}
                                    style={usersStatusFilter === "rejected" ? {} : { color: "var(--muted)" }}
                                >
                                    נדחו
                                </button>
                                <button
                                    onClick={
                                        usersStatusFilter === "archived"
                                            ? undefined
                                            : () => {
                                                  setUsersStatusFilter("archived");
                                                  setUsersPage(1);
                                              }
                                    }
                                    disabled={usersStatusFilter === "archived"}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "archived"
                                            ? "bg-primary text-primary-contrast nav-item-active"
                                            : "bg-surface-2 text-muted nav-item-inactive"
                                    }`}
                                    style={usersStatusFilter === "archived" ? {} : { color: "var(--muted)" }}
                                >
                                    מושבתים
                                </button>
                                <button
                                    onClick={
                                        usersStatusFilter === "all"
                                            ? undefined
                                            : () => {
                                                  setUsersStatusFilter("all");
                                                  setUsersPage(1);
                                              }
                                    }
                                    disabled={usersStatusFilter === "all"}
                                    className={`rounded-theme-md px-3 py-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                                        usersStatusFilter === "all"
                                            ? "bg-primary text-primary-contrast nav-item-active"
                                            : "bg-surface-2 text-muted nav-item-inactive"
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

                        {/* Approve All Button - Only show when filter is pending */}
                        {usersStatusFilter === "pending" && !loading && usersData && usersData.total > 0 && (
                            <div className="mb-4">
                                <button
                                    onClick={() => setApproveAllModalOpen(true)}
                                    className="btn-success rounded-theme-md px-4 py-2 text-sm font-medium"
                                    style={{
                                        backgroundColor: "var(--success)",
                                        color: "var(--primary-contrast)",
                                    }}
                                >
                                    אישור כל המשתמשים הממתינים ({usersData.total})
                                </button>
                            </div>
                        )}

                        {/* Users Table */}
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-lg text-muted">טוען...</div>
                            </div>
                        ) : error ? (
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
                                                className="rounded-theme-md border p-4 space-y-3 cursor-pointer hover:bg-surface-2 transition-colors"
                                                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                                                onClick={() => openEditModal(user)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                                                            {user.firstName} {user.lastName}
                                                        </h3>
                                                        <p className="text-xs text-muted mt-1">{user.email}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
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
                                                        {user.role === "admin" && (
                                                            <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}>
                                                                אדמין
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
                                                    <div>
                                                        <div className="mb-1">
                                                            <span className="text-muted">מכשירים פעילים:</span>
                                                        </div>
                                                        {(() => {
                                                            const devices = (user.activeDevices && user.activeDevices.length > 0) ? user.activeDevices :
                                                                (user.activeDeviceId ? [{ deviceId: user.activeDeviceId, sessionId: 'legacy', lastActiveAt: user.updatedAt || user.createdAt }] : []);
                                                            return devices.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {devices.map((device) => (
                                                                    <div key={device.deviceId} className="flex items-center justify-between">
                                                                        <span className="text-success font-mono text-xs">
                                                                            {device.deviceId.substring(0, 12)}...
                                                                        </span>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleResetDevice(user.id, device.deviceId); }}
                                                                            className="rounded-theme-sm px-2 py-0.5 text-xs font-medium"
                                                                            style={{
                                                                                backgroundColor: "var(--warning)",
                                                                                color: "var(--primary-contrast)",
                                                                            }}
                                                                            title="נתק מכשיר"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted text-xs">אין</span>
                                                        );
                                                        })()}
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">תאריך יצירה:</span>
                                                        <span className="text-muted">{new Date(user.createdAt).toLocaleString("he-IL")}</span>
                                                    </div>
                                                    {user.approvedAt && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted">תאריך אישור/דחייה:</span>
                                                            <span style={{ color: "var(--success)" }}>{new Date(user.approvedAt).toLocaleString("he-IL")}</span>
                                                        </div>
                                                    )}
                                                    {user.rejectedAt && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted">תאריך אישור/דחייה:</span>
                                                            <span style={{ color: "var(--danger)" }}>{new Date(user.rejectedAt).toLocaleString("he-IL")}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                                                    {user.status === "pending" && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleApproveUser(user.id); }}
                                                                className="rounded-theme-sm px-3 py-1.5 text-xs font-medium flex-1"
                                                                style={{
                                                                    backgroundColor: "var(--success)",
                                                                    color: "var(--primary-contrast)",
                                                                }}
                                                            >
                                                                אישור
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openRejectModal(user); }}
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
                                                    {user.status === "approved" && !user.approvalEmailSentAt && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSendApprovalEmail(user.id); }}
                                                            className="rounded-theme-sm px-3 py-1.5 text-xs font-medium flex-1"
                                                            style={{
                                                                backgroundColor: "var(--primary)",
                                                                color: "var(--primary-contrast)",
                                                            }}
                                                        >
                                                            שלח מייל אישור
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
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
                                                            onClick={(e) => { e.stopPropagation(); handleArchiveUser(user.id); }}
                                                            className="rounded-theme-sm px-3 py-1.5 text-xs font-medium"
                                                            style={{
                                                                backgroundColor: "var(--muted)",
                                                                color: "var(--primary-contrast)",
                                                            }}
                                                        >
                                                            השבתה
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
                                                    <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)", textAlign: "right" }}>
                                                        אימייל
                                                    </th>
                                                    <th
                                                        className="th-sortable px-3 py-3 text-xs font-medium uppercase tracking-wider select-none"
                                                        style={{ color: "var(--table-header-text)", textAlign: "right" }}
                                                        onClick={() => handleSort("name")}
                                                    >
                                                        <span style={{ display: "inline-block" }}>
                                                            שם
                                                            <span className="text-xs" style={{ marginRight: "4px" }}>
                                                                {usersSortField === "name" ? (
                                                                    usersSortOrder === "asc" ? "↑" : "↓"
                                                                ) : (
                                                                    "↕"
                                                                )}
                                                            </span>
                                                        </span>
                                                    </th>
                                                    <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)", textAlign: "right" }}>
                                                        טלפון
                                                    </th>
                                                    <th
                                                        className="th-sortable px-2 py-3 text-xs font-medium uppercase tracking-wider select-none"
                                                        style={{ color: "var(--table-header-text)", textAlign: "right" }}
                                                        onClick={() => handleSort("apartmentNumber")}
                                                    >
                                                        <span style={{ display: "inline-block" }}>
                                                            דירה/קומה
                                                            <span className="text-xs" style={{ marginRight: "4px" }}>
                                                                {usersSortField === "apartmentNumber" ? (
                                                                    usersSortOrder === "asc" ? "↑" : "↓"
                                                                ) : (
                                                                    "↕"
                                                                )}
                                                            </span>
                                                        </span>
                                                    </th>
                                                    <th className="px-2 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)", textAlign: "right" }}>
                                                        סטטוס
                                                    </th>
                                                    <th className="px-2 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)", textAlign: "right" }}>
                                                        מכשיר
                                                    </th>
                                                    <th
                                                        className="th-sortable px-2 py-3 text-xs font-medium uppercase tracking-wider select-none"
                                                        style={{ color: "var(--table-header-text)", textAlign: "right" }}
                                                        onClick={() => handleSort("createdAt")}
                                                    >
                                                        <span style={{ display: "inline-block" }}>
                                                            תאריך יצירה
                                                            <span className="text-xs" style={{ marginRight: "4px" }}>
                                                                {usersSortField === "createdAt" ? (
                                                                    usersSortOrder === "asc" ? "↑" : "↓"
                                                                ) : (
                                                                    "↕"
                                                                )}
                                                            </span>
                                                        </span>
                                                    </th>
                                                    <th
                                                        className="th-sortable px-2 py-3 text-xs font-medium uppercase tracking-wider select-none"
                                                        style={{ color: "var(--table-header-text)", textAlign: "right" }}
                                                        onClick={() => handleSort("approvalDate")}
                                                    >
                                                        <span style={{ display: "inline-block" }}>
                                                            אישור/דחייה
                                                            <span className="text-xs" style={{ marginRight: "4px" }}>
                                                                {usersSortField === "approvalDate" ? (
                                                                    usersSortOrder === "asc" ? "↑" : "↓"
                                                                ) : (
                                                                    "↕"
                                                                )}
                                                            </span>
                                                        </span>
                                                    </th>
                                                    <th className="px-2 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)", textAlign: "right" }}>
                                                        פעולות
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y bg-surface" style={{ borderColor: "var(--table-border)" }}>
                                                {usersData.items.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={9}
                                                            className="px-3 py-3 text-center text-sm text-muted"
                                                        >
                                                            אין משתמשים להצגה
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    usersData.items.flatMap((user) => {
                                                        const devices = (user.activeDevices && user.activeDevices.length > 0) ? user.activeDevices :
                                                            (user.activeDeviceId ? [{ deviceId: user.activeDeviceId, sessionId: 'legacy', lastActiveAt: user.updatedAt || user.createdAt }] : []);
                                                        const hasDevices = devices.length > 0;
                                                        const numRows = Math.max(devices.length, 1); // At least 1 row

                                                        // First row with user info + first device (or "אין" if no devices)
                                                        const rows = [
                                                            <tr key={`${user.id}-main`} className="table-row cursor-pointer" onClick={() => openEditModal(user)}>
                                                                <td rowSpan={numRows} className="px-3 py-4 text-sm align-middle" style={{ color: "var(--text)" }}>
                                                                    <div className="truncate max-w-[150px]">{user.email}</div>
                                                                </td>
                                                                <td rowSpan={numRows} className="px-3 py-4 text-sm align-middle" style={{ color: "var(--text)" }}>
                                                                    {user.firstName} {user.lastName}
                                                                </td>
                                                                <td rowSpan={numRows} className="px-3 py-4 text-sm align-middle" style={{ color: "var(--text)" }}>
                                                                    {user.phone}
                                                                </td>
                                                                <td rowSpan={numRows} className="px-2 py-4 text-sm align-middle" style={{ color: "var(--text)" }}>
                                                                    {user.apartmentNumber}/{user.floor}
                                                                </td>
                                                                <td rowSpan={numRows} className="px-2 py-4 text-sm align-middle">
                                                                    <div className="flex items-center gap-1 flex-wrap">
                                                                        {user.status === "approved" ? (
                                                                            <span className="badge-success inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
                                                                                מאושר
                                                                            </span>
                                                                        ) : user.status === "pending" ? (
                                                                            <span className="badge-warning inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
                                                                                ממתין
                                                                            </span>
                                                                        ) : user.status === "rejected" ? (
                                                                            <span className="badge-danger inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
                                                                                נדחה
                                                                            </span>
                                                                        ) : (
                                                                            <span className="badge-muted inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
                                                                                מושבת
                                                                            </span>
                                                                        )}
                                                                        {user.role === "admin" && (
                                                                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}>
                                                                                אדמין
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-2 py-4 text-sm font-mono">
                                                                    {hasDevices ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-success text-xs">
                                                                                {devices[0].deviceId.substring(0, 10)}...
                                                                            </span>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleResetDevice(user.id, devices[0].deviceId); }}
                                                                                className="btn-danger rounded-theme-sm px-1.5 py-0.5 text-xs font-medium"
                                                                                style={{
                                                                                    backgroundColor: "var(--warning)",
                                                                                    color: "var(--primary-contrast)",
                                                                                }}
                                                                                title="נתק מכשיר"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted text-xs">אין</span>
                                                                    )}
                                                                </td>
                                                                <td rowSpan={numRows} className="px-2 py-4 text-xs text-muted align-middle">
                                                                    {new Date(user.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                                                                </td>
                                                                <td rowSpan={numRows} className="px-2 py-4 text-xs align-middle">
                                                                    {user.approvedAt && (
                                                                        <span style={{ color: "var(--success)" }}>{new Date(user.approvedAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</span>
                                                                    )}
                                                                    {user.rejectedAt && (
                                                                        <span style={{ color: "var(--danger)" }}>{new Date(user.rejectedAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</span>
                                                                    )}
                                                                    {!user.approvedAt && !user.rejectedAt && (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td rowSpan={numRows} className="px-2 py-4 text-sm align-middle">
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {user.status === "pending" && (
                                                                            <>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleApproveUser(user.id); }}
                                                                                    className="btn-success rounded-theme-sm px-2 py-0.5 text-xs font-medium"
                                                                                    style={{
                                                                                        backgroundColor: "var(--success)",
                                                                                        color: "var(--primary-contrast)",
                                                                                    }}
                                                                                >
                                                                                    אישור
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); openRejectModal(user); }}
                                                                                    className="btn-danger rounded-theme-sm px-2 py-0.5 text-xs font-medium"
                                                                                    style={{
                                                                                        backgroundColor: "var(--danger)",
                                                                                        color: "var(--primary-contrast)",
                                                                                    }}
                                                                                >
                                                                                    דחייה
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {user.status === "approved" && !user.approvalEmailSentAt && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleSendApprovalEmail(user.id); }}
                                                                                className="btn-primary rounded-theme-sm px-2 py-0.5 text-xs font-medium"
                                                                                style={{
                                                                                    backgroundColor: "var(--primary)",
                                                                                    color: "var(--primary-contrast)",
                                                                                }}
                                                                            >
                                                                                שלח מייל
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                                                                            className="btn-primary rounded-theme-sm px-2 py-0.5 text-xs font-medium"
                                                                            style={{
                                                                                backgroundColor: "var(--primary)",
                                                                                color: "var(--primary-contrast)",
                                                                            }}
                                                                        >
                                                                            עריכה
                                                                        </button>
                                                                        {user.status !== "archived" && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleArchiveUser(user.id); }}
                                                                                className="btn-danger rounded-theme-sm px-2 py-0.5 text-xs font-medium"
                                                                                style={{
                                                                                    backgroundColor: "var(--muted)",
                                                                                    color: "var(--primary-contrast)",
                                                                                }}
                                                                            >
                                                                                השבתה
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>,
                                                            // Additional rows for extra devices
                                                            ...devices.slice(1).map((device, idx) => (
                                                                <tr key={`${user.id}-device-${device.deviceId}`} className="table-row">
                                                                    <td className="px-2 py-4 text-sm font-mono">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-success text-xs">
                                                                                {device.deviceId.substring(0, 10)}...
                                                                            </span>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleResetDevice(user.id, device.deviceId); }}
                                                                                className="btn-danger rounded-theme-sm px-1.5 py-0.5 text-xs font-medium"
                                                                                style={{
                                                                                    backgroundColor: "var(--warning)",
                                                                                    color: "var(--primary-contrast)",
                                                                                }}
                                                                                title="נתק מכשיר"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )),
                                                        ];

                                                        return rows;
                                                    })
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
                                                className="pagination-btn btn-outline rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                                        : "pagination-btn btn-outline border-theme bg-surface text-muted"
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
                                                className="pagination-btn btn-outline rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                        ) : error ? (
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
                                                onClick={() => {
                                                    setSelectedLog(log);
                                                    setLogModalOpen(true);
                                                }}
                                                className="rounded-theme-md border p-4 space-y-2 cursor-pointer"
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
                                <div className="hidden md:block rounded-theme-lg bg-surface shadow-theme-md" style={{ overflow: 'hidden' }}>
                                    <div style={{ overflow: 'hidden', width: '100%' }}>
                                        <table className="w-full divide-y" style={{ tableLayout: 'fixed', width: '100%', borderColor: "var(--table-border)" }}>
                                            <colgroup>
                                                <col style={{ width: '140px' }} />
                                                <col style={{ width: '130px' }} />
                                                <col style={{ width: '180px' }} />
                                                <col style={{ width: '110px' }} />
                                                <col style={{ width: '140px' }} />
                                                <col style={{ width: 'auto' }} />
                                            </colgroup>
                                            <thead className="table-header">
                                                <tr>
                                                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        תאריך ושעה
                                                    </th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        נפתח על ידי
                                                    </th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        אימייל
                                                    </th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        מזהה מכשיר
                                                    </th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        IP
                                                    </th>
                                                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        User Agent
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y bg-surface" style={{ borderColor: "var(--table-border)" }}>
                                                {logsData.items.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-3 py-4 text-center text-sm text-muted"
                                                        >
                                                            אין לוגים להצגה
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    logsData.items.map((log) => (
                                                        <tr
                                                            key={log.id}
                                                            onClick={() => {
                                                                setSelectedLog(log);
                                                                setLogModalOpen(true);
                                                            }}
                                                            className="table-row cursor-pointer"
                                                        >
                                                            <td className="px-3 py-4 text-sm text-muted overflow-hidden text-ellipsis" style={{ whiteSpace: 'nowrap' }} title={new Date(log.createdAt).toLocaleString("he-IL")}>
                                                                {new Date(log.createdAt).toLocaleString("he-IL")}
                                                            </td>
                                                            <td className="px-3 py-4 text-sm overflow-hidden text-ellipsis" style={{ whiteSpace: 'nowrap', color: "var(--text)" }}>
                                                                {log.openedBy === "user"
                                                                    ? "משתמש"
                                                                    : "אדמין (דלת אחורית)"}
                                                            </td>
                                                            <td className="px-3 py-4 text-sm overflow-hidden text-ellipsis" style={{ whiteSpace: 'nowrap', color: "var(--text)" }} title={log.email || undefined}>
                                                                {log.email || "-"}
                                                            </td>
                                                            <td className="px-3 py-4 text-sm font-mono text-muted overflow-hidden text-ellipsis" style={{ whiteSpace: 'nowrap' }} title={log.deviceId || undefined}>
                                                                {log.deviceId
                                                                    ? log.deviceId.substring(0, 8) + "..."
                                                                    : "-"}
                                                            </td>
                                                            <td className="px-3 py-4 text-sm font-mono text-muted overflow-hidden text-ellipsis" style={{ whiteSpace: 'nowrap' }} title={log.ip || undefined}>
                                                                {log.ip || "-"}
                                                            </td>
                                                            <td className="px-3 py-4 text-sm text-muted overflow-hidden text-ellipsis" style={{ whiteSpace: 'nowrap' }} title={log.userAgent || undefined}>
                                                                {log.userAgent || "-"}
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
                                                className="pagination-btn rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                className="pagination-btn rounded-theme-md border border-theme bg-surface px-3 py-2 text-xs md:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

                {/* Log Details Modal */}
                {logModalOpen && selectedLog && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        style={{
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            backdropFilter: "blur(4px)",
                            WebkitBackdropFilter: "blur(4px)",
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setLogModalOpen(false);
                                setSelectedLog(null);
                            }
                        }}
                    >
                        <div
                            className="bg-surface modal-border-responsive w-full max-w-2xl p-6 shadow-theme-lg max-h-[90vh] overflow-y-auto"
                            style={{ borderRadius: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                                    פרטי לוג
                                </h3>
                                <button
                                    onClick={() => {
                                        setLogModalOpen(false);
                                        setSelectedLog(null);
                                    }}
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
                                    <label className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">
                                        תאריך ושעה
                                    </label>
                                    <p className="text-sm" style={{ color: "var(--text)" }}>
                                        {new Date(selectedLog.createdAt).toLocaleString("he-IL", {
                                            dateStyle: "long",
                                            timeStyle: "medium",
                                        })}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">
                                        נפתח על ידי
                                    </label>
                                    <p className="text-sm" style={{ color: "var(--text)" }}>
                                        {selectedLog.openedBy === "user"
                                            ? "משתמש"
                                            : "אדמין (דלת אחורית)"}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">
                                        אימייל
                                    </label>
                                    <p className="text-sm font-mono break-all" style={{ color: "var(--text)" }}>
                                        {selectedLog.email || "-"}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">
                                        מזהה מכשיר
                                    </label>
                                    <p className="text-sm font-mono break-all" style={{ color: "var(--text)" }}>
                                        {selectedLog.deviceId || "-"}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">
                                        כתובת IP
                                    </label>
                                    <p className="text-sm font-mono break-all" style={{ color: "var(--text)" }}>
                                        {selectedLog.ip || "-"}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">
                                        User Agent
                                    </label>
                                    <p className="text-sm break-all" style={{ color: "var(--text)" }}>
                                        {selectedLog.userAgent || "-"}
                                    </p>
                                </div>

                                <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                                    <button
                                        onClick={() => {
                                            setLogModalOpen(false);
                                            setSelectedLog(null);
                                        }}
                                        className="btn-primary w-full rounded-theme-md px-4 py-2 text-sm font-medium"
                                    >
                                        סגור
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Devices Tab */}
                {activeTab === "devices" && (
                    <div className="space-y-4">
                        {/* Header with refresh button */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                                סטטוס מכשירים
                            </h2>
                            <button
                                onClick={() => loadDeviceStatus(false)}
                                disabled={loading}
                                className="flex items-center gap-2 rounded-theme-md border border-theme bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ color: "var(--text)" }}
                            >
                                <svg
                                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                רענון
                            </button>
                        </div>
                        {loading && !deviceStatusData ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-lg text-muted">טוען...</div>
                            </div>
                        ) : error ? (
                            <div className="rounded-theme-md border p-4" style={{ backgroundColor: "var(--danger)", borderColor: "var(--danger)", opacity: 0.1 }}>
                                <p style={{ color: "var(--danger)" }}>{error}</p>
                            </div>
                        ) : deviceStatusData ? (
                            <>
                                {/* Mobile: Cards View */}
                                <div className="md:hidden space-y-3">
                                    {deviceStatusData.items.length === 0 ? (
                                        <div className="rounded-theme-md border p-4 text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                                            <p className="text-sm text-muted">אין מכשירים להצגה</p>
                                        </div>
                                    ) : (
                                        deviceStatusData.items.map((device) => (
                                            <div
                                                key={device.deviceId}
                                                className="rounded-theme-md border p-4 space-y-3"
                                                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                                                            {device.deviceId}
                                                        </h3>
                                                    </div>
                                                    <div>
                                                        {(() => {
                                                            const now = Date.now();
                                                            const STALE_THRESHOLD_MS = 60000;
                                                            const lastSeen = new Date(device.lastSeenAt).getTime();
                                                            const isActuallyOnline = device.online && (now - lastSeen) < STALE_THRESHOLD_MS;
                                                            return isActuallyOnline ? (
                                                                <span className="badge-success inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                    מקוון
                                                                </span>
                                                            ) : (
                                                                <span className="badge-danger inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                    לא מקוון
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">נראה לאחרונה:</span>
                                                        <span style={{ color: "var(--text)" }}>{formatRelativeTime(device.lastSeenAt)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted">עודכן:</span>
                                                        <span className="text-muted">{new Date(device.updatedAt).toLocaleString("he-IL")}</span>
                                                    </div>
                                                    {device.rssi !== undefined && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted">RSSI:</span>
                                                            <span style={{ color: "var(--text)" }}>{device.rssi} dBm</span>
                                                        </div>
                                                    )}
                                                    {device.fwVersion && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted">גרסת תוכנה:</span>
                                                            <span style={{ color: "var(--text)" }}>{device.fwVersion}</span>
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
                                                        מזהה מכשיר
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        סטטוס
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        נראה לאחרונה
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        עודכן
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        RSSI
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--table-header-text)" }}>
                                                        גרסת תוכנה
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y bg-surface" style={{ borderColor: "var(--table-border)" }}>
                                                {deviceStatusData.items.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-6 py-4 text-center text-sm text-muted"
                                                        >
                                                            אין מכשירים להצגה
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    deviceStatusData.items.map((device) => (
                                                        <tr
                                                            key={device.deviceId}
                                                            className="table-row"
                                                        >
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono" style={{ color: "var(--text)" }}>
                                                                {device.deviceId}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                                {(() => {
                                                                    const now = Date.now();
                                                                    const STALE_THRESHOLD_MS = 60000;
                                                                    const lastSeen = new Date(device.lastSeenAt).getTime();
                                                                    const isActuallyOnline = device.online && (now - lastSeen) < STALE_THRESHOLD_MS;
                                                                    return isActuallyOnline ? (
                                                                        <span className="badge-success inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                            מקוון
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge-danger inline-flex rounded-full px-2 py-1 text-xs font-medium">
                                                                            לא מקוון
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm" style={{ color: "var(--text)" }}>
                                                                {formatRelativeTime(device.lastSeenAt)}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                                                                {new Date(device.updatedAt).toLocaleString("he-IL")}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                                                                {device.rssi !== undefined ? `${device.rssi} dBm` : "-"}
                                                            </td>
                                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-muted">
                                                                {device.fwVersion || "-"}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}

                {/* Terminal Tab */}
                {activeTab === "terminal" && (
                    <div className="h-[600px] w-full rounded-theme-md bg-surface p-4 shadow-theme-md">
                        <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text)" }}>
                            מסוף שרת
                        </h2>
                        <Terminal className="h-full" />
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
                                    className="btn-outline flex-1 rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium"
                                    style={{ color: "var(--text)" }}
                                >
                                    ביטול
                                </button>
                                <button
                                    onClick={handleRejectUser}
                                    className="btn-danger flex-1 rounded-theme-md px-4 py-2 text-sm font-medium"
                                    style={{
                                        backgroundColor: "var(--danger)",
                                        color: "var(--primary-contrast)",
                                    }}
                                >
                                    דחייה
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Approve All Modal */}
                {approveAllModalOpen && usersData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
                        <div className="card-theme w-full max-w-md p-6 shadow-theme-lg">
                            <h3 className="mb-4 text-lg font-bold" style={{ color: "var(--text)" }}>
                                אישור כל המשתמשים הממתינים
                            </h3>
                            <p className="mb-4 text-sm text-muted">
                                האם אתה בטוח שברצונך לאשר את כל {usersData.total} המשתמשים הממתינים?
                                <br />
                                מייל אישור יישלח לכל משתמש בנפרד.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setApproveAllModalOpen(false)}
                                    className="btn-outline flex-1 rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium"
                                    style={{ color: "var(--text)" }}
                                >
                                    ביטול
                                </button>
                                <button
                                    onClick={handleApproveAll}
                                    className="btn-success flex-1 rounded-theme-md px-4 py-2 text-sm font-medium"
                                    style={{
                                        backgroundColor: "var(--success)",
                                        color: "var(--primary-contrast)",
                                    }}
                                >
                                    אישור הכל
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
                            className="bg-surface modal-border-responsive w-full max-w-md p-6 shadow-theme-lg"
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
                                <div>
                                    <label className="block text-sm font-medium" style={{ color: "var(--text)" }}>
                                        תפקיד
                                    </label>
                                    <select
                                        value={editFormData.role}
                                        onChange={(e) =>
                                            setEditFormData({
                                                ...editFormData,
                                                role: e.target.value as "user" | "admin",
                                            })
                                        }
                                        className="input-theme mt-1 w-full px-3 py-2 text-sm focus-theme"
                                        style={{ color: "var(--text)" }}
                                    >
                                        <option value="user">משתמש</option>
                                        <option value="admin">אדמין</option>
                                    </select>
                                </div>
                                <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                                    {!isResettingPassword ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsResettingPassword(true);
                                                setPasswordFormData({ newPassword: "", confirmPassword: "" });
                                            }}
                                            className="btn-outline w-full rounded-theme-md border px-4 py-2.5 text-sm font-medium"
                                            style={{
                                                borderColor: "var(--border)",
                                                color: "var(--primary)",
                                                backgroundColor: "transparent",
                                            }}
                                        >
                                            🔒 שנה סיסמה
                                        </button>
                                    ) : (
                                        <div className="space-y-3 rounded-theme-md border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                                                    שנה סיסמה
                                                </h4>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsResettingPassword(false);
                                                        setPasswordFormData({ newPassword: "", confirmPassword: "" });
                                                    }}
                                                    className="text-xs font-medium"
                                                    style={{ color: "var(--muted-text)" }}
                                                >
                                                    ✕ ביטול
                                                </button>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>
                                                    סיסמה חדשה
                                                </label>
                                                <input
                                                    type="password"
                                                    value={passwordFormData.newPassword}
                                                    onChange={(e) =>
                                                        setPasswordFormData({
                                                            ...passwordFormData,
                                                            newPassword: e.target.value,
                                                        })
                                                    }
                                                    className="input-theme w-full px-3 py-2 text-sm focus-theme"
                                                    style={{ color: "var(--text)" }}
                                                    placeholder="הכנס סיסמה חדשה"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>
                                                    אישור סיסמה
                                                </label>
                                                <input
                                                    type="password"
                                                    value={passwordFormData.confirmPassword}
                                                    onChange={(e) =>
                                                        setPasswordFormData({
                                                            ...passwordFormData,
                                                            confirmPassword: e.target.value,
                                                        })
                                                    }
                                                    className="input-theme w-full px-3 py-2 text-sm focus-theme"
                                                    style={{ color: "var(--text)" }}
                                                    placeholder="הכנס שוב את הסיסמה"
                                                />
                                            </div>
                                            {passwordFormData.newPassword &&
                                                passwordFormData.confirmPassword &&
                                                passwordFormData.newPassword !== passwordFormData.confirmPassword && (
                                                    <p className="text-xs text-danger">סיסמה ואישור סיסמה אינם תואמים</p>
                                                )}
                                            <button
                                                type="button"
                                                onClick={handleResetPassword}
                                                disabled={
                                                    !passwordFormData.newPassword ||
                                                    !passwordFormData.confirmPassword ||
                                                    passwordFormData.newPassword !== passwordFormData.confirmPassword ||
                                                    passwordFormData.newPassword.length < 6
                                                }
                                                className="btn-primary w-full rounded-theme-md px-4 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                                                style={{
                                                    backgroundColor:
                                                        passwordFormData.newPassword &&
                                                        passwordFormData.confirmPassword &&
                                                        passwordFormData.newPassword === passwordFormData.confirmPassword &&
                                                        passwordFormData.newPassword.length >= 6
                                                            ? "var(--primary)"
                                                            : "var(--muted)",
                                                    color: "var(--primary-contrast)",
                                                }}
                                            >
                                                עדכן סיסמה
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 flex gap-2">
                                <button
                                    onClick={closeEditModal}
                                    className="btn-outline modal-outline-btn flex-1 rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium"
                                    style={{
                                        color: "var(--text)",
                                    }}
                                >
                                    ביטול
                                </button>
                                <button
                                    onClick={handleEditUser}
                                    disabled={!editFormHasChanges}
                                    className="btn-primary flex-1 rounded-theme-md px-4 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                                    style={{
                                        backgroundColor: editFormHasChanges ? "var(--primary)" : "var(--muted)",
                                        color: "var(--primary-contrast)",
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
                            className="bg-surface modal-border-responsive w-full max-w-md p-6 shadow-theme-lg"
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
                                    className="btn-outline modal-outline-btn flex-1 rounded-theme-md border border-theme bg-surface px-4 py-2 text-sm font-medium"
                                    style={{
                                        color: "var(--text)",
                                    }}
                                >
                                    המשך עריכה
                                </button>
                                <button
                                    onClick={confirmCloseEditModal}
                                    className="btn-danger flex-1 rounded-theme-md px-4 py-2 text-sm font-medium"
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

