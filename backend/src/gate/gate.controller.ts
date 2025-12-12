import {
    BadRequestException,
    Controller,
    Get,
    Post,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { GateService } from './gate.service';
import { ApprovedGuard } from '../auth/approved.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Request as ExpressRequest } from 'express';
import { UsersService } from '../users/users.service';

interface AuthenticatedUser {
    userId: string;
    role: string;
    deviceId: string;
}

interface AuthenticatedRequest extends ExpressRequest {
    user: AuthenticatedUser;
}

@Controller('gate')
export class GateController {
    constructor(
        private readonly gateService: GateService,
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {}

    @UseGuards(AuthGuard('jwt'), ApprovedGuard)
    @Post('open')
    async open(
        @Request() req: AuthenticatedRequest,
    ): Promise<{ success: true }> {
        const user = await this.usersService.findById(req.user.userId);

        // ApprovedGuard כבר בדק user קיים/מאושר/סשן-מכשיר, אז זה בעיקר ביטחון נוסף
        const email = user?.email ?? '';

        return this.gateService.openByUser({
            userId: req.user.userId,
            email,
            deviceId: req.user.deviceId,
            ip: req.ip,
            userAgent: req.get('user-agent') ?? undefined,
        });
    }

    // דלת אחורית: /api/gate/admin-open?key=XXXX
    @Post('admin-open')
    async adminOpen(
        @Request() req: ExpressRequest,
        @Query('key') key?: string,
    ): Promise<{ success: true }> {
        const expectedKey = this.configService.get<string>('ADMIN_OPEN_KEY');

        if (!expectedKey) {
            throw new BadRequestException('ADMIN_OPEN_KEY is not configured');
        }

        if (!key || key !== expectedKey) {
            throw new BadRequestException('Invalid key');
        }

        return this.gateService.openByAdminBackdoor({
            ip: req.ip,
            userAgent: req.get('user-agent') ?? undefined,
        });
    }

    @UseGuards(AuthGuard('jwt'), ApprovedGuard, AdminGuard)
    @Get('logs')
    async logs(@Query('limit') limit?: string) {
        const parsed = limit ? Number(limit) : 50;
        const safeLimit = Number.isFinite(parsed)
            ? Math.min(Math.max(parsed, 1), 200)
            : 50;

        return this.gateService.getLatest(safeLimit);
    }
}
