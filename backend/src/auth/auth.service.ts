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
import { User, UserDocument } from '../users/schemas/user.schema';
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
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            phone: registerDto.phone,
            apartmentNumber: registerDto.apartmentNumber,
            floor: registerDto.floor,
            status: 'pending',
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
        if (user.status === 'pending') {
            throw new ForbiddenException('המשתמש ממתין לאישור אדמין');
        }

        if (user.status === 'rejected') {
            throw new ForbiddenException({
                message: 'הבקשה נדחתה',
                rejectionReason: user.rejectionReason || null,
            });
        }

        if (user.status === 'archived') {
            throw new ForbiddenException('המשתמש נחסם');
        }

        // Only approved status can login
        if (user.status !== 'approved') {
            throw new ForbiddenException('החשבון לא מאושר');
        }

        if (user.activeDeviceId && user.activeDeviceId !== loginDto.deviceId) {
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

        const sessionData = await this.usersService.getSessionData(payload.sub);

        if (!sessionData) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        if (
            !sessionData.activeSessionId ||
            sessionData.activeSessionId !== payload.sid
        ) {
            throw new UnauthorizedException('Session לא תקין');
        }

        if (
            !sessionData.activeDeviceId ||
            sessionData.activeDeviceId !== payload.deviceId
        ) {
            throw new UnauthorizedException('Device לא תואם');
        }

        if (!sessionData.refreshTokenHash) {
            throw new UnauthorizedException('Refresh token לא נמצא');
        }

        const isValidRefreshToken = await bcrypt.compare(
            refreshToken,
            sessionData.refreshTokenHash,
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
            user as UserDocument,
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

        if (!user.activeDeviceId) {
            throw new ConflictException('המשתמש לא מחובר');
        }

        if (user.activeDeviceId !== deviceId) {
            throw new ConflictException('המשתמש מחובר ממכשיר אחר');
        }

        await this.usersService.clearSession(userId);
    }
}
