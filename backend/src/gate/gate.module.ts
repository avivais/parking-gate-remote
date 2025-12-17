import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { GateLog, GateLogSchema } from './schemas/gate-log.schema';

@Module({
    imports: [
        ConfigModule,
        AuthModule,
        UsersModule,
        MongooseModule.forFeature([
            { name: GateLog.name, schema: GateLogSchema },
        ]),
    ],
    controllers: [GateController],
    providers: [GateService],
    exports: [GateService],
})
export class GateModule {}
