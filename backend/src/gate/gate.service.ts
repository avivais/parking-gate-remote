import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GateLog, GateLogDocument } from './schemas/gate-log.schema';

@Injectable()
export class GateService {
    constructor(
        @InjectModel(GateLog.name)
        private readonly gateLogModel: Model<GateLogDocument>,
    ) {}

    async openByUser(params: {
        userId: string;
        email: string;
        deviceId: string;
        ip?: string;
        userAgent?: string;
    }): Promise<{ success: true }> {
        await this.gateLogModel.create({
            userId: params.userId,
            email: params.email,
            deviceId: params.deviceId,
            ip: params.ip,
            userAgent: params.userAgent,
            openedBy: 'user',
        });

        return { success: true };
    }

    async openByAdminBackdoor(params: {
        ip?: string;
        userAgent?: string;
    }): Promise<{ success: true }> {
        await this.gateLogModel.create({
            ip: params.ip,
            userAgent: params.userAgent,
            openedBy: 'admin-backdoor',
        });

        return { success: true };
    }

    async getLatest(limit = 50): Promise<GateLog[]> {
        return this.gateLogModel
            .find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .exec();
    }
}
