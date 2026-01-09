/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { GateService } from '../gate/gate.service';
import { GetUsersQueryDto, UserStatusFilter } from './dto/get-users-query.dto';
import { GetLogsQueryDto } from './dto/get-logs-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserStatus, USER_STATUS } from '../users/schemas/user.schema';
import {
    DeviceStatus,
    DeviceStatusDocument,
} from '../gate/schemas/device-status.schema';

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
        activeDevices: Array<{
            deviceId: string;
            sessionId: string;
            lastActiveAt: string;
        }>;
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

export interface DeviceStatusResponse {
    items: Array<{
        deviceId: string;
        online: boolean;
        updatedAt: number;
        lastSeenAt: string;
        rssi?: number;
        fwVersion?: string;
    }>;
    total: number;
}

@Injectable()
export class AdminService {
    constructor(
        private readonly usersService: UsersService,
        private readonly gateService: GateService,
        @InjectModel(DeviceStatus.name)
        private readonly deviceStatusModel: Model<DeviceStatusDocument>,
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

        // Transform to response format with active devices
        const items = await Promise.all(
            users.map(async (user) => {
                const userDoc = user as any;
                // Get all active sessions for this user
                const sessions = await this.usersService.getAllSessions(user._id.toString());
                let activeDevices = sessions.map((session) => {
                    const sessionDoc = session as any;
                    return {
                        deviceId: session.deviceId,
                        sessionId: session.sessionId,
                        lastActiveAt: sessionDoc.lastActiveAt
                            ? new Date(session.lastActiveAt).toISOString()
                            : sessionDoc.createdAt
                              ? new Date(sessionDoc.createdAt).toISOString()
                              : new Date().toISOString(),
                    };
                });

                // Migration: If user has activeDeviceId but no sessions, create a session entry
                // This handles users who logged in before sessions collection was added
                if (user.activeDeviceId && activeDevices.length === 0) {
                    activeDevices = [
                        {
                            deviceId: user.activeDeviceId,
                            sessionId: user.activeSessionId || 'legacy',
                            lastActiveAt: userDoc.updatedAt
                                ? new Date(userDoc.updatedAt).toISOString()
                                : new Date().toISOString(),
                        },
                    ];
                }

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
                    activeDevices,
                    createdAt: userDoc.createdAt
                        ? new Date(userDoc.createdAt).toISOString()
                        : new Date().toISOString(),
                    updatedAt: userDoc.updatedAt
                        ? new Date(userDoc.updatedAt).toISOString()
                        : new Date().toISOString(),
                };
            }),
        );

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
                updateDto.status === USER_STATUS.REJECTED ||
                updateDto.status === USER_STATUS.ARCHIVED ||
                updateDto.status === USER_STATUS.PENDING
            ) {
                updateData.activeDeviceId = null;
                // Also clear session
                await this.usersService.clearSession(userId);
            }

            // Handle rejectionReason based on status
            if (updateDto.status === USER_STATUS.REJECTED) {
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
            if (existingUser.status === USER_STATUS.REJECTED) {
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

    async updateUserRole(
        userId: string,
        role: 'user' | 'admin',
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
        createdAt: string;
        updatedAt: string;
    }> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        const updatedUser = await this.usersService.updateUser(userId, { role });

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
            createdAt: userDoc.createdAt
                ? new Date(userDoc.createdAt).toISOString()
                : new Date().toISOString(),
            updatedAt: userDoc.updatedAt
                ? new Date(userDoc.updatedAt).toISOString()
                : new Date().toISOString(),
        };
    }

    async resetPassword(
        userId: string,
        resetPasswordDto: ResetPasswordDto,
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
        createdAt: string;
        updatedAt: string;
    }> {
        if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
            throw new BadRequestException('סיסמה ואישור סיסמה אינם תואמים');
        }

        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(resetPasswordDto.newPassword, 10);

        // Update password
        const updatedUser = await this.usersService.updateUser(userId, {
            passwordHash,
        });

        if (!updatedUser) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        // Clear all sessions (disconnect all devices)
        await this.usersService.clearAllSessions(userId);
        await this.usersService.clearSession(userId);

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
            createdAt: userDoc.createdAt
                ? new Date(userDoc.createdAt).toISOString()
                : new Date().toISOString(),
            updatedAt: userDoc.updatedAt
                ? new Date(userDoc.updatedAt).toISOString()
                : new Date().toISOString(),
        };
    }

    async resetUserDevice(
        userId: string,
        deviceId?: string,
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
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        if (deviceId) {
            // Delete specific device session
            await this.usersService.deleteSession(userId, deviceId);
        } else {
            // Clear all sessions
            await this.usersService.clearAllSessions(userId);
            await this.usersService.clearSession(userId);
            await this.usersService.clearActiveDevice(userId);
        }

        // Check if user still has any sessions left
        const remainingSessions = await this.usersService.getAllSessions(userId);
        if (remainingSessions.length === 0) {
            await this.usersService.clearSession(userId);
            await this.usersService.clearActiveDevice(userId);
        }

        const updatedUser = await this.usersService.findById(userId);
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

    async getLogs(query: GetLogsQueryDto): Promise<PaginatedLogsResponse> {
        return this.gateService.getLogsPaginated(query);
    }

    async getDeviceStatuses(): Promise<DeviceStatusResponse> {
        const devices = await this.deviceStatusModel
            .find({})
            .sort({ lastSeenAt: -1 })
            .lean();

        const items = devices.map((device) => {
            const deviceDoc = device as any;
            return {
                deviceId: device.deviceId,
                online: device.online,
                updatedAt: device.updatedAt,
                lastSeenAt: deviceDoc.lastSeenAt
                    ? new Date(device.lastSeenAt).toISOString()
                    : new Date().toISOString(),
                rssi: device.rssi,
                fwVersion: device.fwVersion,
            };
        });

        return {
            items,
            total: items.length,
        };
    }
}
