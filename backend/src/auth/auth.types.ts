export type UserRole = 'user' | 'admin';

export interface JwtPayload {
    sub: string;
    role: UserRole;
    deviceId: string;
}
