import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { ApprovedGuard } from '../auth/approved.guard';
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
    ) {
        const deviceId = (deviceIdHeader || deviceIdQuery || '').trim();
        const token = (tokenHeader || '').trim();

        this.deviceCommands.assertDeviceAuth(deviceId, token);
        return await this.deviceCommands.consumePending(deviceId);
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
    @UseGuards(AuthGuard('jwt'), ApprovedGuard, AdminGuard)
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

    @UseGuards(AuthGuard('jwt'), ApprovedGuard, AdminGuard)
    @Delete('admin/:deviceId/pending-command')
    async clearPendingCommand(@Param('deviceId') deviceId: string) {
        return await this.deviceCommands.setPending(deviceId, 'none');
    }
}

