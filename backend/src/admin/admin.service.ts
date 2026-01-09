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
import { EmailService } from '../email/email.service';
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
        approvedAt?: string;
        rejectedAt?: string;
        approvalEmailSentAt?: string;
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
        private readonly emailService: EmailService,
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

        // Build $or search for q across email, phone, firstName, lastName
        if (q) {
            filter.$or = [
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { firstName: { $regex: q, $options: 'i' } },
                { lastName: { $regex: q, $options: 'i' } },
            ];
        }

        // Apply status filter - must be combined with $or if it exists
        if (status !== UserStatusFilter.ALL) {
            if (filter.$or) {
                // When both status and $or exist, use $and to combine them properly
                filter.$and = [
                    { status },
                    { $or: filter.$or },
                ];
                delete filter.$or;
            } else {
                filter.status = status;
            }
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
                    approvedAt: (user as any).approvedAt
                        ? new Date((user as any).approvedAt).toISOString()
                        : undefined,
                    rejectedAt: (user as any).rejectedAt
                        ? new Date((user as any).rejectedAt).toISOString()
                        : undefined,
                    approvalEmailSentAt: (user as any).approvalEmailSentAt
                        ? new Date((user as any).approvalEmailSentAt).toISOString()
                        : undefined,
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
        approvedAt?: string;
        rejectedAt?: string;
        approvalEmailSentAt?: string;
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
            const previousStatus = existingUser.status;
            updateData.status = updateDto.status;

            // Set timestamps based on status change
            if (updateDto.status === USER_STATUS.APPROVED && previousStatus !== USER_STATUS.APPROVED) {
                updateData.approvedAt = new Date();
                updateData.rejectedAt = null; // Clear rejectedAt if approving
            } else if (updateDto.status === USER_STATUS.REJECTED && previousStatus !== USER_STATUS.REJECTED) {
                updateData.rejectedAt = new Date();
                updateData.approvedAt = null; // Clear approvedAt if rejecting
            }

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

        // Send approval email if user was just approved and email hasn't been sent yet
        if (
            updateDto.status === USER_STATUS.APPROVED &&
            existingUser.status !== USER_STATUS.APPROVED &&
            !(updatedUser as any).approvalEmailSentAt
        ) {
            try {
                await this.emailService.sendApprovalEmail(
                    updatedUser.email,
                    updatedUser.firstName,
                    updatedUser.lastName,
                );
                // Update approvalEmailSentAt timestamp
                await this.usersService.updateUser(userId, {
                    approvalEmailSentAt: new Date(),
                } as any);
                // Refresh updatedUser to include the new timestamp
                const refreshedUser = await this.usersService.findById(userId);
                if (refreshedUser) {
                    Object.assign(updatedUser, refreshedUser);
                }
            } catch (error) {
                // Log error but don't fail the approval operation
                console.error('Failed to send approval email:', error);
            }
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
            approvedAt: userDoc.approvedAt
                ? new Date(userDoc.approvedAt).toISOString()
                : undefined,
            rejectedAt: userDoc.rejectedAt
                ? new Date(userDoc.rejectedAt).toISOString()
                : undefined,
            approvalEmailSentAt: userDoc.approvalEmailSentAt
                ? new Date(userDoc.approvalEmailSentAt).toISOString()
                : undefined,
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

    async approveAllPendingUsers(): Promise<{ count: number }> {
        // Find all pending users
        const pendingUsers = await this.usersService.findUsersPaginated(
            { status: USER_STATUS.PENDING },
            0,
            10000, // Large limit to get all pending users
        );

        let approvedCount = 0;
        const now = new Date();

        // Approve each user individually and send email
        for (const user of pendingUsers) {
            try {
                // Update user status and set approvedAt timestamp
                await this.usersService.updateUser(user._id.toString(), {
                    status: USER_STATUS.APPROVED,
                    approvedAt: now,
                    rejectedAt: null,
                } as any);

                // Send approval email
                try {
                    await this.emailService.sendApprovalEmail(
                        user.email,
                        user.firstName,
                        user.lastName,
                    );
                    // Update approvalEmailSentAt timestamp
                    await this.usersService.updateUser(user._id.toString(), {
                        approvalEmailSentAt: now,
                    } as any);
                } catch (emailError) {
                    // Log error but continue approving other users
                    console.error(
                        `Failed to send approval email to ${user.email}:`,
                        emailError,
                    );
                }

                // Clear active device if set (force logout)
                await this.usersService.clearSession(user._id.toString());
                await this.usersService.clearActiveDevice(user._id.toString());

                approvedCount++;
            } catch (error) {
                // Log error but continue with other users
                console.error(
                    `Failed to approve user ${user._id.toString()}:`,
                    error,
                );
            }
        }

        return { count: approvedCount };
    }

    async sendApprovalEmail(userId: string): Promise<void> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new NotFoundException('משתמש לא נמצא');
        }

        if (user.status !== USER_STATUS.APPROVED) {
            throw new BadRequestException(
                'לא ניתן לשלוח מייל אישור למשתמש שאינו מאושר',
            );
        }

        // Send email
        await this.emailService.sendApprovalEmail(
            user.email,
            user.firstName,
            user.lastName,
        );

        // Update approvalEmailSentAt timestamp
        await this.usersService.updateUser(userId, {
            approvalEmailSentAt: new Date(),
        } as any);
    }
}
