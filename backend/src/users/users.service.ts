import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, USER_STATUS, UserStatus } from './schemas/user.schema';
import { Session, SessionDocument } from './schemas/session.schema';

export interface CreateUserParams {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string;
    apartmentNumber: number;
    floor: number;
    status?: UserStatus;
    rejectionReason?: string | null;
}

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Session.name)
        private readonly sessionModel: Model<SessionDocument>,
    ) {}

    async create(params: CreateUserParams): Promise<User> {
        const created = new this.userModel({
            email: params.email,
            passwordHash: params.passwordHash,
            firstName: params.firstName,
            lastName: params.lastName,
            phone: params.phone,
            apartmentNumber: params.apartmentNumber,
            floor: params.floor,
            status: params.status || USER_STATUS.PENDING,
            rejectionReason: params.rejectionReason ?? null,
        });

        return created.save();
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userModel.findOne({ email }).exec();
    }

    async findWithValidResetToken(): Promise<UserDocument[]> {
        const now = new Date();
        return this.userModel
            .find({
                resetPasswordExpiresAt: { $exists: true, $gt: now },
                resetPasswordTokenHash: { $exists: true, $ne: null },
            })
            .select('+resetPasswordTokenHash')
            .exec();
    }

    async clearPasswordResetAndSetPassword(
        userId: string,
        passwordHash: string,
    ): Promise<void> {
        await this.userModel
            .findByIdAndUpdate(userId, {
                passwordHash,
                $unset: {
                    resetPasswordTokenHash: 1,
                    resetPasswordExpiresAt: 1,
                },
            })
            .exec();
    }

    async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email }).select('+passwordHash').exec();
    }

    async findById(id: string): Promise<UserDocument | null> {
        return this.userModel.findById(id).exec();
    }

    async findAll(): Promise<User[]> {
        return this.userModel.find().exec();
    }

    async setActiveDevice(userId: string, deviceId: string): Promise<void> {
        await this.userModel
            .findByIdAndUpdate(userId, { activeDeviceId: deviceId })
            .exec();
    }

    async clearActiveDevice(userId: string): Promise<void> {
        await this.userModel
            .findByIdAndUpdate(userId, { $unset: { activeDeviceId: 1 } })
            .exec();
    }

    async updateUser(
        userId: string,
        updateData: Partial<User>,
    ): Promise<UserDocument | null> {
        return this.userModel
            .findByIdAndUpdate(userId, updateData, { new: true })
            .exec();
    }

    async setSession(
        userId: string,
        deviceId: string,
        sid: string,
        refreshTokenHash: string,
    ): Promise<void> {
        // Keep backward compatibility - update user fields for non-admin users
        // For admins, we'll use sessions collection primarily
        await this.userModel
            .findByIdAndUpdate(userId, {
                activeDeviceId: deviceId,
                activeSessionId: sid,
                refreshTokenHash,
            })
            .exec();

        // Also create/update session document
        await this.createSession(userId, deviceId, sid, refreshTokenHash);
    }

    // Session management methods
    async createSession(
        userId: string,
        deviceId: string,
        sessionId: string,
        refreshTokenHash: string,
    ): Promise<Session> {
        // Use upsert to create or update existing session for this device
        return this.sessionModel
            .findOneAndUpdate(
                { userId, deviceId },
                {
                    userId,
                    deviceId,
                    sessionId,
                    refreshTokenHash,
                    lastActiveAt: new Date(),
                },
                { upsert: true, new: true },
            )
            .exec();
    }

    async getAllSessions(userId: string): Promise<Session[]> {
        return this.sessionModel.find({ userId }).exec();
    }

    async getSessionBySessionId(sessionId: string): Promise<Session | null> {
        return this.sessionModel.findOne({ sessionId }).select('+refreshTokenHash').exec();
    }

    async deleteSession(userId: string, deviceId?: string): Promise<void> {
        const filter: any = { userId };
        if (deviceId) {
            filter.deviceId = deviceId;
        }
        await this.sessionModel.deleteMany(filter).exec();
    }

    async clearAllSessions(userId: string): Promise<void> {
        await this.sessionModel.deleteMany({ userId }).exec();
    }

    async updateSessionLastActive(sessionId: string): Promise<void> {
        await this.sessionModel
            .findOneAndUpdate(
                { sessionId },
                { lastActiveAt: new Date() },
            )
            .exec();
    }

    async clearSession(userId: string): Promise<void> {
        await this.userModel
            .findByIdAndUpdate(userId, {
                $unset: {
                    activeDeviceId: 1,
                    activeSessionId: 1,
                    refreshTokenHash: 1,
                },
            })
            .exec();
    }

    async getSessionData(userId: string): Promise<{
        activeSessionId: string | null;
        activeDeviceId: string | null;
        refreshTokenHash: string | null;
    } | null> {
        const user = await this.userModel
            .findById(userId)
            .select('+refreshTokenHash')
            .exec();

        if (!user) {
            return null;
        }

        return {
            activeSessionId: user.activeSessionId ?? null,
            activeDeviceId: user.activeDeviceId ?? null,
            refreshTokenHash: user.refreshTokenHash ?? null,
        };
    }

    async countUsers(filter: any): Promise<number> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return this.userModel.countDocuments(filter).exec();
    }

    async findUsersPaginated(
        filter: any,
        skip: number,
        limit: number,
        sort: any = { createdAt: -1 },
    ): Promise<UserDocument[]> {
        return (
            this.userModel
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                .find(filter)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec()
        );
    }
}
