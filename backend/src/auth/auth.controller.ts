import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService, MeResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/schemas/user.schema';
import { Request as ExpressRequest } from 'express';
import { ApprovedGuard } from './approved.guard';

interface AuthenticatedRequestUser {
    userId: string;
    role: string;
    deviceId: string;
    sid: string;
}

interface AuthenticatedRequest extends ExpressRequest {
    user: AuthenticatedRequestUser;
}

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() registerDto: RegisterDto): Promise<User> {
        return this.authService.register(registerDto);
    }

    @Post('login')
    async login(
        @Body() loginDto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ user: User; tokens: { accessToken: string } }> {
        const result = await this.authService.login(loginDto);

        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            path: '/api/auth',
            maxAge: 365 * 24 * 60 * 60 * 1000,
        });

        return {
            user: result.user,
            tokens: result.tokens,
        };
    }

    @Post('refresh')
    async refresh(
        @Request() req: ExpressRequest,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ tokens: { accessToken: string } }> {
        const refreshToken =
            req.cookies && typeof req.cookies === 'object'
                ? (req.cookies.refresh_token as string | undefined)
                : undefined;

        if (!refreshToken || typeof refreshToken !== 'string') {
            throw new UnauthorizedException('Refresh token לא נמצא');
        }

        const result = await this.authService.refresh(refreshToken);

        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            path: '/api/auth',
            maxAge: 365 * 24 * 60 * 60 * 1000,
        });

        return {
            tokens: { accessToken: result.accessToken },
        };
    }

    @UseGuards(AuthGuard('jwt'), ApprovedGuard)
    @Get('me')
    me(@Request() req: AuthenticatedRequest): Promise<MeResponse> {
        const rawAuthHeader =
            req.headers.authorization ??
            (req.headers.Authorization as string | undefined);

        let token: string | undefined;

        if (rawAuthHeader && typeof rawAuthHeader === 'string') {
            if (rawAuthHeader.toLowerCase().startsWith('bearer ')) {
                token = rawAuthHeader.slice(7).trim();
            } else {
                token = rawAuthHeader.trim();
            }
        }

        return this.authService.getMe(req.user.userId, token);
    }

    @UseGuards(AuthGuard('jwt'), ApprovedGuard)
    @Post('logout')
    async logout(
        @Request() req: AuthenticatedRequest,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ success: true }> {
        await this.authService.logout(req.user.userId, req.user.deviceId);

        res.clearCookie('refresh_token', { path: '/api/auth' });

        return { success: true };
    }
}
