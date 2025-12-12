import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService, AuthUserResponse, MeResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/schemas/user.schema';
import { Request as ExpressRequest } from 'express';
import { ApprovedGuard } from './approved.guard';

interface AuthenticatedRequestUser {
    userId: string;
    role: string;
    deviceId: string;
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
    login(@Body() loginDto: LoginDto): Promise<AuthUserResponse> {
        return this.authService.login(loginDto);
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

    @UseGuards(AuthGuard('jwt'))
    @Post('logout')
    async logout(
        @Request() req: AuthenticatedRequest,
    ): Promise<{ success: true }> {
        await this.authService.logout(req.user.userId, req.user.deviceId);
        return { success: true };
    }
}
