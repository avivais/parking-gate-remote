import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, USER_STATUS, UserStatus } from './schemas/user.schema';

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
        await this.userModel
            .findByIdAndUpdate(userId, {
                activeDeviceId: deviceId,
                activeSessionId: sid,
                refreshTokenHash,
            })
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
    ): Promise<UserDocument[]> {
        return (
            this.userModel
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec()
        );
    }
}
