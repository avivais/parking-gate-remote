import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { GateLog, GateLogSchema } from './schemas/gate-log.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        ConfigModule,
        AuthModule,
        MongooseModule.forFeature([
            { name: GateLog.name, schema: GateLogSchema },
        ]),
    ],
    controllers: [GateController],
    providers: [GateService],
})
export class GateModule {}
