import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GateLog, GateLogDocument } from './schemas/gate-log.schema';
import { GetLogsQueryDto, OpenedByFilter } from '../admin/dto/get-logs-query.dto';

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

    async getLogsPaginated(query: GetLogsQueryDto): Promise<{
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
    }> {
        const { email, openedBy = OpenedByFilter.ALL, page = 1, limit = 50 } = query;

        // Build filter
        const filter: any = {};

        if (email) {
            filter.email = { $regex: email, $options: 'i' };
        }

        if (openedBy !== OpenedByFilter.ALL) {
            filter.openedBy = openedBy;
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        const total = await this.gateLogModel.countDocuments(filter).exec();
        const totalPages = Math.ceil(total / limit);

        // Fetch logs
        const logs = await this.gateLogModel
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec();

        // Transform to response format
        const items = logs.map((log: any) => ({
            id: log._id.toString(),
            openedBy: log.openedBy,
            email: log.email,
            deviceId: log.deviceId,
            ip: log.ip,
            userAgent: log.userAgent,
            createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
        }));

        return {
            items,
            page,
            limit,
            total,
            totalPages,
        };
    }
}
