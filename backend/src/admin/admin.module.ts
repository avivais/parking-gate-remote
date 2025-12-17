import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { GateModule } from '../gate/gate.module';

@Module({
    imports: [UsersModule, GateModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}

