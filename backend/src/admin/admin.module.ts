import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { GateModule } from '../gate/gate.module';
import { EmailModule } from '../email/email.module';
import { TerminalModule } from './terminal/terminal.module';
import { DeviceStatus, DeviceStatusSchema } from '../gate/schemas/device-status.schema';

@Module({
    imports: [
        UsersModule,
        GateModule,
        EmailModule,
        TerminalModule,
        MongooseModule.forFeature([
            { name: DeviceStatus.name, schema: DeviceStatusSchema },
        ]),
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
