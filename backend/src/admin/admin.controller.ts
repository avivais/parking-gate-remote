import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { ApprovedGuard } from '../auth/approved.guard';
import { AdminGuard } from '../auth/admin.guard';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetLogsQueryDto } from './dto/get-logs-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetDeviceDto } from './dto/reset-device.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), ApprovedGuard, AdminGuard)
@SkipThrottle()
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('users')
    async getUsers(@Query() query: GetUsersQueryDto) {
        return this.adminService.getUsers(query);
    }

    @Patch('users/:id')
    async updateUser(
        @Param('id') id: string,
        @Body() updateDto: UpdateUserDto,
    ) {
        return this.adminService.updateUser(id, updateDto);
    }

    @Patch('users/:id/role')
    async updateUserRole(
        @Param('id') id: string,
        @Body() updateRoleDto: UpdateUserRoleDto,
    ) {
        return this.adminService.updateUserRole(id, updateRoleDto.role);
    }

    @Patch('users/:id/password')
    async resetPassword(
        @Param('id') id: string,
        @Body() resetPasswordDto: ResetPasswordDto,
    ) {
        return this.adminService.resetPassword(id, resetPasswordDto);
    }

    @Post('users/:id/reset-device')
    async resetUserDevice(
        @Param('id') id: string,
        @Body() resetDeviceDto?: ResetDeviceDto,
    ) {
        return this.adminService.resetUserDevice(id, resetDeviceDto?.deviceId);
    }

    @Get('logs')
    async getLogs(@Query() query: GetLogsQueryDto) {
        return this.adminService.getLogs(query);
    }

    @SkipThrottle()
    @Get('device-status')
    async getDeviceStatus() {
        return this.adminService.getDeviceStatuses();
    }
}
