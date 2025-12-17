import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { ApprovedGuard } from '../auth/approved.guard';
import { AdminGuard } from '../auth/admin.guard';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetLogsQueryDto } from './dto/get-logs-query.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), ApprovedGuard, AdminGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('users')
    async getUsers(@Query() query: GetUsersQueryDto) {
        return this.adminService.getUsers(query);
    }

    @Post('users/:id/approve')
    async approveUser(@Param('id') id: string) {
        return this.adminService.approveUser(id);
    }

    @Post('users/:id/reset-device')
    async resetUserDevice(@Param('id') id: string) {
        return this.adminService.resetUserDevice(id);
    }

    @Get('logs')
    async getLogs(@Query() query: GetLogsQueryDto) {
        return this.adminService.getLogs(query);
    }
}

