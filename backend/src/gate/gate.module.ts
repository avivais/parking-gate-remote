import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule, InjectConnection } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER } from '@nestjs/core';
import { Connection } from 'mongoose';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { GateDeviceService } from './gate-device.service';
import { GateExceptionFilter } from './gate-exception.filter';
import { GateLog, GateLogSchema } from './schemas/gate-log.schema';
import { GateRequest, GateRequestSchema } from './schemas/gate-request.schema';

@Module({
    imports: [
        ConfigModule,
        AuthModule,
        UsersModule,
        ThrottlerModule,
        MongooseModule.forFeature([
            { name: GateLog.name, schema: GateLogSchema },
            { name: GateRequest.name, schema: GateRequestSchema },
        ]),
    ],
    controllers: [GateController],
    providers: [
        GateService,
        GateDeviceService,
        {
            provide: APP_FILTER,
            useClass: GateExceptionFilter,
        },
    ],
    exports: [GateService],
})
export class GateModule implements OnModuleInit {
    constructor(
        private readonly configService: ConfigService,
        @InjectConnection() private readonly connection: Connection,
    ) {}

    async onModuleInit() {
        // TTL index is set in the schema with default 30 seconds
        // To change it, update GATE_REQUEST_TTL_SECONDS in .env and restart the app
        // The index will be recreated on next app start
        const ttlSeconds = this.configService.get<number>(
            'GATE_REQUEST_TTL_SECONDS',
            30,
        );

        // Update TTL index after connection is established
        try {
            if (this.connection.readyState === 1) {
                // Connection is ready
                const collection = this.connection.collection('gaterequests');
                // Drop existing index if it exists
                try {
                    await collection.dropIndex('createdAt_1');
                } catch {
                    // Index might not exist, ignore
                }
                // Create new index with configured TTL
                await collection.createIndex(
                    { createdAt: 1 },
                    { expireAfterSeconds: ttlSeconds },
                );
            }
        } catch (error) {
            // Ignore errors - index will use schema default
            console.warn('Could not update TTL index, using default:', error);
        }
    }
}
