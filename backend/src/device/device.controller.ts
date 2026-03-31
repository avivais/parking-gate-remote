import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    Post,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard';
import { DeviceCommandsService } from './device-commands.service';
import { SetPendingCommandDto } from './dto/set-pending-command.dto';

@Controller('device')
@SkipThrottle()
export class DeviceController {
    constructor(private readonly deviceCommands: DeviceCommandsService) {}

    /**
     * Device (MCU) polling endpoint.
     *
     * Auth: X-Device-Id + X-Device-Token (static token from env mapping).
     */
    @Get('pending-command')
    async getPendingCommand(
        @Headers('x-device-id') deviceIdHeader?: string,
        @Headers('x-device-token') tokenHeader?: string,
        @Query('deviceId') deviceIdQuery?: string,
        @Res({ passthrough: true }) res?: Response,
    ) {
        const deviceId = (deviceIdHeader || deviceIdQuery || '').trim();
        const token = (tokenHeader || '').trim();

        this.deviceCommands.assertDeviceAuth(deviceId, token);
        const pending = await this.deviceCommands.consumePending(deviceId);
        if (res) {
            // Status-code command channel for modem compatibility:
            // 200=none, 205=reboot, 206=rebuild_ppp.
            if (pending.action === 'reboot') {
                res.status(205);
            } else if (pending.action === 'rebuild_ppp') {
                res.status(206);
            } else {
                res.status(200);
            }
        }
        return pending;
    }

    /**
     * OTA manifest endpoint (phase 1): returns current manifest if configured.
     * Auth is the same as pending-command.
     */
    @Get('ota-manifest')
    async getOtaManifest(
        @Headers('x-device-id') deviceIdHeader?: string,
        @Headers('x-device-token') tokenHeader?: string,
        @Query('deviceId') deviceIdQuery?: string,
    ) {
        const deviceId = (deviceIdHeader || deviceIdQuery || '').trim();
        const token = (tokenHeader || '').trim();
        this.deviceCommands.assertDeviceAuth(deviceId, token);
        return await this.deviceCommands.getOta(deviceId);
    }

    /**
     * Admin sets a pending command which will be consumed by the next device poll.
     */
    @UseGuards(AuthGuard('jwt'), AdminGuard)
    @Post('admin/:deviceId/pending-command')
    async setPendingCommand(
        @Param('deviceId') deviceId: string,
        @Body() body: SetPendingCommandDto,
    ) {
        return await this.deviceCommands.setPending(
            deviceId,
            body.action,
            body.reason,
            body.ttlSeconds,
        );
    }

    @UseGuards(AuthGuard('jwt'), AdminGuard)
    @Get('admin/:deviceId/pending-command')
    async getPendingCommandAdmin(@Param('deviceId') deviceId: string) {
        return await this.deviceCommands.getLatestPending(deviceId);
    }

    @UseGuards(AuthGuard('jwt'), AdminGuard)
    @Delete('admin/:deviceId/pending-command')
    async clearPendingCommand(@Param('deviceId') deviceId: string) {
        return await this.deviceCommands.setPending(deviceId, 'none');
    }
}

