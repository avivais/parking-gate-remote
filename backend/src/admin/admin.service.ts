/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GateService } from '../gate/gate.service';
import { GetUsersQueryDto, UserStatusFilter } from './dto/get-users-query.dto';
import { GetLogsQueryDto } from './dto/get-logs-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from '../users/schemas/user.schema';

export interface PaginatedUsersResponse {
    items: Array<{
        id: string;
        email: string;
        role: 'user' | 'admin';
        status: UserStatus;
        rejectionReason: string | null;
        firstName: string;
        lastName: string;
        phone: string;
        apartmentNumber: number;
        floor: number;
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
        const {
            status = UserStatusFilter.PENDING,
            q,
            page = 1,
            limit = 20,
        } = query;

        // Build filter
        const filter: any = {};

        if (status !== UserStatusFilter.ALL) {
            filter.status = status;
        }

        // Build $or search for q across email, phone, firstName, lastName
        if (q) {
            filter.$or = [
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { firstName: { $regex: q, $options: 'i' } },
                { lastName: { $regex: q, $options: 'i' } },
            ];
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        const total = await this.usersService.countUsers(filter);
        const totalPages = Math.ceil(total / limit);

        // Fetch users
        const users = await this.usersService.findUsersPaginated(
            filter,
            skip,
            limit,
        );

        // Transform to response format
        const items = users.map((user) => {
            const userDoc = user as any;
            return {
                id: user._id.toString(),
                email: user.email,
                role: user.role,
                status: user.status,
                rejectionReason: user.rejectionReason || null,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                apartmentNumber: user.apartmentNumber,
                floor: user.floor,
                activeDeviceId: user.activeDeviceId || null,
                createdAt: userDoc.createdAt
                    ? new Date(userDoc.createdAt).toISOString()
                    : new Date().toISOString(),
                updatedAt: userDoc.updatedAt
                    ? new Date(userDoc.updatedAt).toISOString()
                    : new Date().toISOString(),
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

    async updateUser(
        userId: string,
        updateDto: UpdateUserDto,
    ): Promise<{
        id: string;
        email: string;
        role: 'user' | 'admin';
        status: UserStatus;
        rejectionReason: string | null;
        firstName: string;
        lastName: string;
        phone: string;
        apartmentNumber: number;
        floor: number;
        activeDeviceId?: string | null;
        createdAt: string;
        updatedAt: string;
    }> {
        const existingUser = await this.usersService.findById(userId);

        if (!existingUser) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        // Build update data
        const updateData: any = {};

        if (updateDto.firstName !== undefined) {
            updateData.firstName = updateDto.firstName;
        }
        if (updateDto.lastName !== undefined) {
            updateData.lastName = updateDto.lastName;
        }
        if (updateDto.phone !== undefined) {
            updateData.phone = updateDto.phone;
        }
        if (updateDto.apartmentNumber !== undefined) {
            updateData.apartmentNumber = updateDto.apartmentNumber;
        }
        if (updateDto.floor !== undefined) {
            updateData.floor = updateDto.floor;
        }

        // Handle status changes
        if (updateDto.status !== undefined) {
            updateData.status = updateDto.status;

            // If status becomes rejected/archived/pending: clear activeDeviceId (force logout)
            if (
                updateDto.status === 'rejected' ||
                updateDto.status === 'archived' ||
                updateDto.status === 'pending'
            ) {
                updateData.activeDeviceId = null;
                // Also clear session
                await this.usersService.clearSession(userId);
            }

            // Handle rejectionReason based on status
            if (updateDto.status === 'rejected') {
                if (
                    !updateDto.rejectionReason ||
                    updateDto.rejectionReason.trim().length === 0
                ) {
                    throw new BadRequestException(
                        'סיבת דחייה נדרשת כאשר הסטטוס הוא "נדחה"',
                    );
                }
                updateData.rejectionReason = updateDto.rejectionReason;
            } else {
                // If status is not rejected, set rejectionReason to null
                updateData.rejectionReason = null;
            }
        } else if (updateDto.rejectionReason !== undefined) {
            // If only rejectionReason is being updated (without status change)
            if (existingUser.status === 'rejected') {
                if (
                    !updateDto.rejectionReason ||
                    updateDto.rejectionReason.trim().length === 0
                ) {
                    throw new BadRequestException(
                        'סיבת דחייה נדרשת כאשר הסטטוס הוא "נדחה"',
                    );
                }
                updateData.rejectionReason = updateDto.rejectionReason;
            } else {
                updateData.rejectionReason = null;
            }
        }

        // Update user
        const updatedUser = await this.usersService.updateUser(
            userId,
            updateData,
        );

        if (!updatedUser) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        const userDoc = updatedUser as any;
        return {
            id: updatedUser._id.toString(),
            email: updatedUser.email,
            role: updatedUser.role,
            status: updatedUser.status,
            rejectionReason: updatedUser.rejectionReason || null,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            phone: updatedUser.phone,
            apartmentNumber: updatedUser.apartmentNumber,
            floor: updatedUser.floor,
            activeDeviceId: updatedUser.activeDeviceId || null,
            createdAt: userDoc.createdAt
                ? new Date(userDoc.createdAt).toISOString()
                : new Date().toISOString(),
            updatedAt: userDoc.updatedAt
                ? new Date(userDoc.updatedAt).toISOString()
                : new Date().toISOString(),
        };
    }

    async resetUserDevice(userId: string): Promise<{
        id: string;
        email: string;
        role: 'user' | 'admin';
        status: UserStatus;
        rejectionReason: string | null;
        firstName: string;
        lastName: string;
        phone: string;
        apartmentNumber: number;
        floor: number;
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
            status: user.status,
            rejectionReason: user.rejectionReason || null,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            apartmentNumber: user.apartmentNumber,
            floor: user.floor,
            activeDeviceId: null,
            createdAt: userDoc.createdAt
                ? new Date(userDoc.createdAt).toISOString()
                : new Date().toISOString(),
            updatedAt: userDoc.updatedAt
                ? new Date(userDoc.updatedAt).toISOString()
                : new Date().toISOString(),
        };
    }

    async getLogs(query: GetLogsQueryDto): Promise<PaginatedLogsResponse> {
        return this.gateService.getLogsPaginated(query);
    }
}
