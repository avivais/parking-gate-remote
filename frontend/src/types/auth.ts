/* TypeScript types for auth and gate */

// Constants for UserStatus values - single source of truth
export const USER_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    ARCHIVED: "archived",
} as const;

// Derive the type from the constants to avoid duplication
export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];

export interface User {
    _id: string;
    email: string;
    role: "user" | "admin";
    status: UserStatus;
    rejectionReason: string | null;
    firstName: string;
    lastName: string;
    phone: string;
    apartmentNumber: number;
    floor: number;
}

export interface AuthTokens {
    accessToken: string;
}

export interface AuthUserResponse {
    user: User;
    tokens: AuthTokens;
}

export interface MeTokenInfo {
    expiresAtUnix: number;
    expiresAtIso: string;
    remainingMs: number;
    remainingSeconds: number;
}

export interface MeResponse {
    user: User | null;
    token: MeTokenInfo | null;
}

export interface RefreshResponse {
    tokens: AuthTokens;
}

export interface GateLog {
    _id: string;
    userId?: string;
    email?: string;
    deviceId?: string;
    ip?: string;
    userAgent?: string;
    openedBy: "user" | "admin-backdoor";
    createdAt: string;
}

export interface AdminUser {
    id: string;
    email: string;
    role: "user" | "admin";
    status: UserStatus;
    rejectionReason: string | null;
    firstName: string;
    lastName: string;
    phone: string;
    apartmentNumber: number;
    floor: number;
    activeDeviceId?: string | null;
    activeDevices?: Array<{
        deviceId: string;
        sessionId: string;
        lastActiveAt: string;
    }>;
    approvedAt?: string;
    rejectedAt?: string;
    approvalEmailSentAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PaginatedUsersResponse {
    items: AdminUser[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedLogsResponse {
    items: Array<{
        id: string;
        openedBy: "user" | "admin-backdoor";
        email?: string;
        deviceId?: string;
        ip?: string;
        userAgent?: string;
        createdAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface DeviceStatus {
    deviceId: string;
    online: boolean;
    updatedAt: number;
    lastSeenAt: string;
    rssi?: number;
    fwVersion?: string;
}

export interface DeviceStatusResponse {
    items: DeviceStatus[];
    total: number;
}

export interface DiagnosticLogEntry {
    ts: number;
    level: string;
    event: string;
    message?: string;
}

export interface DeviceDiagnosticDoc {
    receivedAt: string;
    sessionId?: string;
    fwVersion?: string;
    entries: DiagnosticLogEntry[];
}

export interface DeviceDiagnosticsResponse {
    deviceId: string;
    diagnostics: DeviceDiagnosticDoc[];
}

