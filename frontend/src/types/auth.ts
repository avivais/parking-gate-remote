/* TypeScript types for auth and gate */
export type UserStatus = "pending" | "approved" | "rejected" | "archived";

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

