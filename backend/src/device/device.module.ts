import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { DeviceController } from './device.controller';
import { DeviceCommandsService } from './device-commands.service';
import {
    DevicePendingCommand,
    DevicePendingCommandSchema,
} from './schemas/device-pending-command.schema';

@Module({
    imports: [
        AuthModule,
        MongooseModule.forFeature([
            { name: DevicePendingCommand.name, schema: DevicePendingCommandSchema },
        ]),
    ],
    controllers: [DeviceController],
    providers: [DeviceCommandsService],
    exports: [DeviceCommandsService],
})
export class DeviceModule {}

