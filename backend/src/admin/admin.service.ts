import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GateService } from '../gate/gate.service';
import { GetUsersQueryDto, UserStatusFilter } from './dto/get-users-query.dto';
import { GetLogsQueryDto } from './dto/get-logs-query.dto';

export interface PaginatedUsersResponse {
    items: Array<{
        id: string;
        email: string;
        role: 'user' | 'admin';
        approved: boolean;
        activeDeviceId?: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedLogsResponse {
    items: Array<{
        id: string;
        openedBy: 'user' | 'admin-backdoor';
        email?: string;
        deviceId?: string;
        ip?: string;
        userAgent?: string;
        createdAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

@Injectable()
export class AdminService {
    constructor(
        private readonly usersService: UsersService,
        private readonly gateService: GateService,
    ) {}

    async getUsers(query: GetUsersQueryDto): Promise<PaginatedUsersResponse> {
        const { status = UserStatusFilter.PENDING, q, page = 1, limit = 20 } = query;

        // Build filter
        const filter: any = {};

        if (status === UserStatusFilter.PENDING) {
            filter.approved = false;
        } else if (status === UserStatusFilter.APPROVED) {
            filter.approved = true;
        }
        // If status === 'all', no filter on approved

        if (q) {
            filter.email = { $regex: q, $options: 'i' };
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        const total = await this.usersService.countUsers(filter);
        const totalPages = Math.ceil(total / limit);

        // Fetch users
        const users = await this.usersService.findUsersPaginated(filter, skip, limit);

        // Transform to response format
        const items = users.map((user) => {
            const userDoc = user as any;
            return {
                id: user._id.toString(),
                email: user.email,
                role: user.role,
                approved: user.approved,
                activeDeviceId: user.activeDeviceId || null,
                createdAt: userDoc.createdAt ? new Date(userDoc.createdAt).toISOString() : new Date().toISOString(),
                updatedAt: userDoc.updatedAt ? new Date(userDoc.updatedAt).toISOString() : new Date().toISOString(),
            };
        });

        return {
            items,
            page,
            limit,
            total,
            totalPages,
        };
    }

    async approveUser(userId: string): Promise<{
        id: string;
        email: string;
        role: 'user' | 'admin';
        approved: boolean;
        activeDeviceId?: string | null;
        createdAt: string;
        updatedAt: string;
    }> {
        const user = await this.usersService.approveUser(userId);

        if (!user) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        const userDoc = user as any;
        return {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            approved: user.approved,
            activeDeviceId: user.activeDeviceId || null,
            createdAt: userDoc.createdAt ? new Date(userDoc.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: userDoc.updatedAt ? new Date(userDoc.updatedAt).toISOString() : new Date().toISOString(),
        };
    }

    async resetUserDevice(userId: string): Promise<{
        id: string;
        email: string;
        role: 'user' | 'admin';
        approved: boolean;
        activeDeviceId?: string | null;
        createdAt: string;
        updatedAt: string;
    }> {
        await this.usersService.clearActiveDevice(userId);
        await this.usersService.clearSession(userId);

        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        const userDoc = user as any;
        return {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            approved: user.approved,
            activeDeviceId: null,
            createdAt: userDoc.createdAt ? new Date(userDoc.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: userDoc.updatedAt ? new Date(userDoc.updatedAt).toISOString() : new Date().toISOString(),
        };
    }

    async getLogs(query: GetLogsQueryDto): Promise<PaginatedLogsResponse> {
        return this.gateService.getLogsPaginated(query);
    }
}

