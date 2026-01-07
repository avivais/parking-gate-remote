import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { GateLog, GateLogDocument } from './schemas/gate-log.schema';
import {
    GateRequest,
    GateRequestDocument,
} from './schemas/gate-request.schema';
import {
    GetLogsQueryDto,
    OpenedByFilter,
} from '../admin/dto/get-logs-query.dto';
import { IGateDeviceService } from './gate-device.interface';
import { GateLogStatus, GateLogMcuMetadata } from './schemas/gate-log.schema';

@Injectable()
export class GateService {
    constructor(
        @InjectModel(GateLog.name)
        private readonly gateLogModel: Model<GateLogDocument>,
        @InjectModel(GateRequest.name)
        private readonly gateRequestModel: Model<GateRequestDocument>,
        @Inject('IGateDeviceService')
        private readonly gateDeviceService: IGateDeviceService,
    ) {}

    async checkAndRegisterRequestId(
        requestId: string,
        userId: string,
    ): Promise<void> {
        try {
            await this.gateRequestModel.create({
                requestId,
                userId,
                createdAt: new Date(),
            });
        } catch (error: unknown) {
            if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 11000
            ) {
                // Duplicate key error
                throw new ConflictException('בקשה כפולה זוהתה');
            }
            throw error;
        }
    }

    async openByUser(params: {
        requestId: string;
        userId: string;
        email: string;
        deviceId: string;
        sessionId?: string;
        ip?: string;
        userAgent?: string;
    }): Promise<{ success: true }> {
        const startTime = Date.now();

        let status: GateLogStatus = 'failed';
        let failureReason: string | undefined;
        let mcuMetadata: GateLogMcuMetadata = {
            attempted: false,
            timeout: false,
            retries: 0,
        };

        try {
            // Check for replay
            await this.checkAndRegisterRequestId(
                params.requestId,
                params.userId,
            );

            // Call MCU service
            const mcuResult = await this.gateDeviceService.openGate(
                params.requestId,
                params.userId,
            );
            mcuMetadata = mcuResult.metadata;

            status = 'success';
        } catch (error: unknown) {
            if (error instanceof ConflictException) {
                status = 'blocked_replay';
                failureReason = error.message;
            } else {
                status = 'failed';
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : 'שגיאה לא ידועה בפתיחת השער';
                failureReason = errorMessage;
                mcuMetadata = {
                    attempted: true,
                    timeout:
                        error instanceof Error &&
                        error.name === 'GatewayTimeoutException',
                    retries: 0,
                };
            }
            throw error;
        } finally {
            const durationMs = Date.now() - startTime;

            // Log the attempt
            await this.gateLogModel.create({
                requestId: params.requestId,
                userId: params.userId,
                email: params.email,
                deviceId: params.deviceId,
                sessionId: params.sessionId,
                ip: params.ip,
                userAgent: params.userAgent,
                openedBy: 'user',
                status,
                failureReason,
                durationMs,
                mcu: mcuMetadata,
            });
        }

        return { success: true };
    }

    async openByAdminBackdoor(params: {
        requestId?: string;
        ip?: string;
        userAgent?: string;
    }): Promise<{ success: true }> {
        const startTime = Date.now();
        // Use UUID format to match firmware buffer size (36 chars + null terminator)
        const requestId = params.requestId || randomUUID();

        let status: GateLogStatus = 'failed';
        let failureReason: string | undefined;
        let mcuMetadata: GateLogMcuMetadata = {
            attempted: false,
            timeout: false,
            retries: 0,
        };

        try {
            // Call MCU service (admin backdoor doesn't need replay protection)
            const mcuResult = await this.gateDeviceService.openGate(
                requestId,
                'admin-backdoor',
            );
            mcuMetadata = mcuResult.metadata;

            status = 'success';
        } catch (error: unknown) {
            status = 'failed';
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'שגיאה לא ידועה בפתיחת השער';
            failureReason = errorMessage;
            mcuMetadata = {
                attempted: true,
                timeout:
                    error instanceof Error &&
                    error.name === 'GatewayTimeoutException',
                retries: 0,
            };
            throw error;
        } finally {
            const durationMs = Date.now() - startTime;

            await this.gateLogModel.create({
                requestId,
                ip: params.ip,
                userAgent: params.userAgent,
                openedBy: 'admin-backdoor',
                status,
                failureReason,
                durationMs,
                mcu: mcuMetadata,
            });
        }

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
        const {
            email,
            openedBy = OpenedByFilter.ALL,
            page = 1,
            limit = 50,
        } = query;

        // Build filter
        const filter: {
            email?: { $regex: string; $options: string };
            openedBy?: string;
        } = {};

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
        const items = logs.map((log) => {
            const logWithTimestamps = log as typeof log & {
                createdAt?: Date | string;
                updatedAt?: Date | string;
            };
            const createdAt = logWithTimestamps.createdAt
                ? new Date(logWithTimestamps.createdAt).toISOString()
                : new Date().toISOString();

            return {
                id: log._id.toString(),
                openedBy: log.openedBy,
                email: log.email,
                deviceId: log.deviceId,
                ip: log.ip,
                userAgent: log.userAgent,
                createdAt,
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
}
