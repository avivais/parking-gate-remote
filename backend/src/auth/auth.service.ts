import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from './auth.types';

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

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) {}

    private buildAccessToken(user: UserDocument, deviceId: string): string {
        const payload: JwtPayload = {
            sub: user._id.toString(),
            role: user.role,
            deviceId,
        };

        return this.jwtService.sign(payload);
    }

    async register(registerDto: RegisterDto): Promise<User> {
        const existing = await this.usersService.findByEmail(registerDto.email);

        if (existing) {
            throw new BadRequestException(
                'User with this email already exists',
            );
        }

        const passwordHash = await bcrypt.hash(registerDto.password, 10);

        const createdUser = await this.usersService.create({
            email: registerDto.email,
            passwordHash,
        });

        return createdUser;
    }

    async login(loginDto: LoginDto): Promise<AuthUserResponse> {
        const user = await this.usersService.findByEmailWithPassword(
            loginDto.email,
        );

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isValidPassword = await bcrypt.compare(
            loginDto.password,
            user.passwordHash,
        );

        if (!isValidPassword) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.approved) {
            throw new ForbiddenException('User is not approved yet');
        }

        if (user.activeDeviceId && user.activeDeviceId !== loginDto.deviceId) {
            throw new ConflictException(
                'User is already logged in from another device',
            );
        }

        const userId = user._id.toString();

        if (user.activeDeviceId !== loginDto.deviceId) {
            await this.usersService.setActiveDevice(userId, loginDto.deviceId);
            user.activeDeviceId = loginDto.deviceId;
        }

        const tokens: AuthTokens = {
            accessToken: this.buildAccessToken(user, loginDto.deviceId),
        };

        return {
            user,
            tokens,
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
            throw new UnauthorizedException('User not found');
        }

        if (!user.activeDeviceId) {
            throw new ConflictException(
                'User is not logged in from any device',
            );
        }

        if (user.activeDeviceId !== deviceId) {
            throw new ConflictException(
                'User is logged in from a different device',
            );
        }

        await this.usersService.clearActiveDevice(userId);
    }
}
