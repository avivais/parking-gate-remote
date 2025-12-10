import {
    Body,
    Controller,
    Get,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService, AuthUserResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/schemas/user.schema';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
    user: {
        userId: string;
        role: string;
    };
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

    @UseGuards(AuthGuard('jwt'))
    @Get('me')
    me(@Request() req: AuthenticatedRequest): Promise<User | null> {
        return this.authService.getProfile(req.user.userId);
    }
}
