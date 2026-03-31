import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    DevicePendingCommand,
    DevicePendingCommandDocument,
} from './schemas/device-pending-command.schema';

export type DeviceCommandAction = 'none' | 'reboot' | 'rebuild_ppp';

@Injectable()
export class DeviceCommandsService {
    constructor(
        private readonly configService: ConfigService,
        @InjectModel(DevicePendingCommand.name)
        private readonly pendingModel: Model<DevicePendingCommandDocument>,
    ) {}

    private getDeviceToken(deviceId: string): string | null {
        const raw = this.configService.get<string>('DEVICE_TOKENS_JSON');
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Record<string, string>;
            return parsed[deviceId] ?? null;
        } catch {
            throw new BadRequestException('DEVICE_TOKENS_JSON is not valid JSON');
        }
    }

    private getOtaManifest(deviceId: string): unknown | null {
        const raw = this.configService.get<string>('OTA_MANIFEST_JSON');
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return parsed[deviceId] ?? null;
        } catch {
            throw new BadRequestException('OTA_MANIFEST_JSON is not valid JSON');
        }
    }

    assertDeviceAuth(deviceId: string, token: string) {
        const expected = this.getDeviceToken(deviceId);
        if (!expected || expected.length < 8) {
            throw new UnauthorizedException('Device auth not configured');
        }
        if (token !== expected) {
            throw new UnauthorizedException('Invalid device token');
        }
    }

    async setPending(
        deviceId: string,
        action: DeviceCommandAction,
        reason?: string,
        ttlSeconds?: number,
    ) {
        // Clear command if action=none
        if (action === 'none') {
            await this.pendingModel.deleteMany({ deviceId }).exec();
            return { deviceId, action: 'none' as const };
        }

        const expiresAt =
            ttlSeconds && ttlSeconds > 0
                ? new Date(Date.now() + ttlSeconds * 1000)
                : undefined;

        const doc = await this.pendingModel.create({
            deviceId,
            action,
            reason,
            expiresAt,
        });
        return {
            id: doc._id.toString(),
            deviceId,
            action,
            reason: reason ?? null,
            expiresAt: expiresAt?.toISOString() ?? null,
        };
    }

    async consumePending(deviceId: string) {
        const now = new Date();
        const doc = await this.pendingModel
            .findOne({
                deviceId,
                consumedAt: { $exists: false },
                $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
            })
            .sort({ createdAt: -1 })
            .exec();

        if (!doc) {
            return { deviceId, action: 'none' as const };
        }

        doc.consumedAt = now;
        await doc.save();

        return {
            deviceId,
            action: doc.action as DeviceCommandAction,
            reason: doc.reason ?? null,
            createdAt: (doc as any).createdAt
                ? new Date((doc as any).createdAt).toISOString()
                : null,
        };
    }

    async getLatestPending(deviceId: string) {
        const now = new Date();
        const doc = await this.pendingModel
            .findOne({
                deviceId,
                consumedAt: { $exists: false },
                $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
            })
            .sort({ createdAt: -1 })
            .exec();

        if (!doc) {
            return { deviceId, action: 'none' as const, reason: null, expiresAt: null, createdAt: null };
        }

        return {
            deviceId,
            action: doc.action as DeviceCommandAction,
            reason: doc.reason ?? null,
            expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
            createdAt: (doc as any).createdAt
                ? new Date((doc as any).createdAt).toISOString()
                : null,
        };
    }

    async getOta(deviceId: string) {
        const manifest = this.getOtaManifest(deviceId);
        if (!manifest) return { deviceId, ota: null };
        return { deviceId, ota: manifest };
    }
}

