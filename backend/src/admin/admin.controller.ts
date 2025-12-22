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
import { AdminService } from './admin.service';
import { ApprovedGuard } from '../auth/approved.guard';
import { AdminGuard } from '../auth/admin.guard';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetLogsQueryDto } from './dto/get-logs-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), ApprovedGuard, AdminGuard)
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

    @Post('users/:id/reset-device')
    async resetUserDevice(@Param('id') id: string) {
        return this.adminService.resetUserDevice(id);
    }

    @Get('logs')
    async getLogs(@Query() query: GetLogsQueryDto) {
        return this.adminService.getLogs(query);
    }
}
