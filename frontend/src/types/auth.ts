/* TypeScript types for auth and gate */
export interface User {
    _id: string;
    email: string;
    role: "user" | "admin";
    approved: boolean;
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
