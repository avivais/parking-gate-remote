import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { User, UserDocument, USER_STATUS } from '../users/schemas/user.schema';
import { JwtPayload, UserRole } from './auth.types';

export interface AuthTokens {
    accessToken: string;
}

export interface AuthUserResponse {
    user: User;
    tokens: AuthTokens;
    refreshToken: string;
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

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    private buildAccessToken(
        user: UserDocument,
        deviceId: string,
        sid: string,
    ): string {
        const payload: JwtPayload = {
            sub: user._id.toString(),
            role: user.role,
            deviceId,
            sid,
        };

        return this.jwtService.sign(payload);
    }

    private buildRefreshToken(
        userId: string,
        role: UserRole,
        deviceId: string,
        sid: string,
    ): string {
        const refreshSecret =
            this.configService.get<string>('JWT_REFRESH_SECRET') ||
            this.configService.get<string>('JWT_SECRET') + '_refresh';

        const refreshExpiresInConfig =
            this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '365d';

        type ExpiresInType =
            | number
            | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

        const refreshExpiresIn: ExpiresInType =
            refreshExpiresInConfig as ExpiresInType;

        const payload: JwtPayload = {
            sub: userId,
            role,
            deviceId,
            sid,
        };

        return this.jwtService.sign(payload, {
            secret: refreshSecret,
            expiresIn: refreshExpiresIn,
        });
    }

    async register(registerDto: RegisterDto): Promise<User> {
        const existing = await this.usersService.findByEmail(registerDto.email);

        if (existing) {
            throw new BadRequestException('כתובת אימייל זו כבר רשומה במערכת');
        }

        const passwordHash = await bcrypt.hash(registerDto.password, 10);

        const createdUser = await this.usersService.create({
            email: registerDto.email,
            passwordHash,
            firstName: String(registerDto.firstName),
            lastName: String(registerDto.lastName),
            phone: String(registerDto.phone),
            apartmentNumber: Number(registerDto.apartmentNumber),
            floor: Number(registerDto.floor),
            status: USER_STATUS.PENDING,
            rejectionReason: null,
        });

        return createdUser;
    }

    async login(loginDto: LoginDto): Promise<AuthUserResponse> {
        const user = await this.usersService.findByEmailWithPassword(
            loginDto.email,
        );

        if (!user) {
            throw new UnauthorizedException('אימייל או סיסמה שגויים');
        }

        const isValidPassword = await bcrypt.compare(
            loginDto.password,
            user.passwordHash,
        );

        if (!isValidPassword) {
            throw new UnauthorizedException('אימייל או סיסמה שגויים');
        }

        // Check user status
        if (user.status === USER_STATUS.PENDING) {
            throw new ForbiddenException('המשתמש ממתין לאישור אדמין');
        }

        if (user.status === USER_STATUS.REJECTED) {
            const rejectionReason: string | null =
                (user.rejectionReason as string | null | undefined) ?? null;
            throw new ForbiddenException({
                message: 'הבקשה לאישור החשבון נדחתה',
                rejectionReason,
            });
        }

        if (user.status === USER_STATUS.ARCHIVED) {
            throw new ForbiddenException('המשתמש נחסם');
        }

        // Only approved status can login
        if (user.status !== USER_STATUS.APPROVED) {
            throw new ForbiddenException('החשבון לא מאושר');
        }

        // Admins can login from multiple devices, regular users cannot
        if (user.role !== 'admin' && user.activeDeviceId && user.activeDeviceId !== loginDto.deviceId) {
            throw new ConflictException('המשתמש מחובר כבר ממכשיר אחר');
        }

        const userId = user._id.toString();
        const sid = randomUUID();

        const refreshToken = this.buildRefreshToken(
            userId,
            user.role,
            loginDto.deviceId,
            sid,
        );
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        // For regular users, clear all existing sessions (enforce single device)
        // For admins, allow multiple devices
        if (user.role !== 'admin') {
            await this.usersService.clearAllSessions(userId);
        }

        // Create session document (handles both admin and regular users)
        await this.usersService.createSession(
            userId,
            loginDto.deviceId,
            sid,
            refreshTokenHash,
        );

        // Also update user fields for backward compatibility
        await this.usersService.setSession(
            userId,
            loginDto.deviceId,
            sid,
            refreshTokenHash,
        );

        const tokens: AuthTokens = {
            accessToken: this.buildAccessToken(user, loginDto.deviceId, sid),
        };

        return {
            user,
            tokens,
            refreshToken,
        };
    }

    async refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }> {
        const refreshSecret =
            this.configService.get<string>('JWT_REFRESH_SECRET') ||
            this.configService.get<string>('JWT_SECRET') + '_refresh';

        let payload: JwtPayload;
        try {
            payload = this.jwtService.verify<JwtPayload>(refreshToken, {
                secret: refreshSecret,
            });
        } catch {
            throw new UnauthorizedException('Refresh token לא תקין');
        }

        // Check session in sessions collection
        const session = await this.usersService.getSessionBySessionId(payload.sid);

        if (!session) {
            throw new UnauthorizedException('Session לא נמצא');
        }

        if (session.userId !== payload.sub) {
            throw new UnauthorizedException('Session לא תואם למשתמש');
        }

        if (session.deviceId !== payload.deviceId) {
            throw new UnauthorizedException('Device לא תואם');
        }

        const isValidRefreshToken = await bcrypt.compare(
            refreshToken,
            session.refreshTokenHash,
        );

        if (!isValidRefreshToken) {
            throw new UnauthorizedException('Refresh token לא תקין');
        }

        const newSid = randomUUID();
        const newRefreshToken = this.buildRefreshToken(
            payload.sub,
            payload.role,
            payload.deviceId,
            newSid,
        );
        const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

        // Update session document
        await this.usersService.createSession(
            payload.sub,
            payload.deviceId,
            newSid,
            newRefreshTokenHash,
        );

        // Also update user fields for backward compatibility
        await this.usersService.setSession(
            payload.sub,
            payload.deviceId,
            newSid,
            newRefreshTokenHash,
        );

        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        const accessToken = this.buildAccessToken(
            user,
            payload.deviceId,
            newSid,
        );

        return {
            accessToken,
            refreshToken: newRefreshToken,
        };
    }

    async getProfile(userId: string): Promise<User | null> {
        return this.usersService.findById(userId);
    }

    async getMe(
        userId: string,
        token: string | undefined,
    ): Promise<MeResponse> {
        const user = await this.getProfile(userId);

        if (!token) {
            return {
                user,
                token: null,
            };
        }

        const decoded = this.jwtService.decode<JwtPayload & { exp?: number }>(
            token,
        );

        if (!decoded || typeof decoded.exp !== 'number') {
            return {
                user,
                token: null,
            };
        }

        const expiresAtUnix = decoded.exp; // seconds since epoch
        const expiresAtMs = expiresAtUnix * 1000;
        const nowMs = Date.now();
        const remainingMs = Math.max(expiresAtMs - nowMs, 0);
        const remainingSeconds = Math.floor(remainingMs / 1000);

        return {
            user,
            token: {
                expiresAtUnix,
                expiresAtIso: new Date(expiresAtMs).toISOString(),
                remainingMs,
                remainingSeconds,
            },
        };
    }

    async logout(userId: string, deviceId: string): Promise<void> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        // For admins, only delete the specific device session
        // For regular users, validate device matches before clearing
        if (user.role !== 'admin') {
            const sessionData = await this.usersService.getSessionData(userId);
            if (!sessionData || !sessionData.activeDeviceId) {
                throw new ConflictException('המשתמש לא מחובר');
            }
            if (sessionData.activeDeviceId !== deviceId) {
                throw new ConflictException('המשתמש מחובר ממכשיר אחר');
            }
        }

        // Delete session document for this device
        await this.usersService.deleteSession(userId, deviceId);

        // For regular users, also clear user fields
        // For admins, only clear if this was their last session
        const remainingSessions = await this.usersService.getAllSessions(userId);
        if (remainingSessions.length === 0 || user.role !== 'admin') {
            await this.usersService.clearSession(userId);
        }
    }

    async updateMe(userId: string, updateDto: UpdateMeDto): Promise<User> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        // Build update data - only include fields that are provided
        const updateData: Partial<User> = {};

        if (updateDto.firstName !== undefined) {
            updateData.firstName = updateDto.firstName;
        }
        if (updateDto.lastName !== undefined) {
            updateData.lastName = updateDto.lastName;
        }
        if (updateDto.phone !== undefined) {
            updateData.phone = updateDto.phone;
        }
        if (updateDto.apartmentNumber !== undefined) {
            updateData.apartmentNumber = updateDto.apartmentNumber;
        }
        if (updateDto.floor !== undefined) {
            updateData.floor = updateDto.floor;
        }

        const updatedUser = await this.usersService.updateUser(
            userId,
            updateData,
        );

        if (!updatedUser) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        // Return sanitized user (password hash is not selected by default)
        return updatedUser.toObject();
    }
}
