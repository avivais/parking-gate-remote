import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GateLogDocument = HydratedDocument<GateLog>;

export type GateOpenedBy = 'user' | 'admin-backdoor';

export type GateLogStatus =
    | 'success'
    | 'failed'
    | 'blocked_rate_limit'
    | 'blocked_replay';

export interface GateLogMcuMetadata {
    attempted: boolean;
    timeout: boolean;
    retries: number;
}

@Schema({ timestamps: true })
export class GateLog {
    @Prop({ required: true })
    requestId: string;

    @Prop({ required: false })
    userId?: string;

    @Prop({ required: false })
    email?: string;

    @Prop({ required: false })
    deviceId?: string;

    @Prop({ required: false })
    sessionId?: string;

    @Prop({ required: false })
    ip?: string;

    @Prop({ required: false })
    userAgent?: string;

    @Prop({ required: true, enum: ['user', 'admin-backdoor'] })
    openedBy: GateOpenedBy;

    @Prop({
        required: true,
        enum: ['success', 'failed', 'blocked_rate_limit', 'blocked_replay'],
    })
    status: GateLogStatus;

    @Prop({ required: false })
    failureReason?: string;

    @Prop({ required: true })
    durationMs: number;

    @Prop({
        type: {
            attempted: Boolean,
            timeout: Boolean,
            retries: Number,
        },
        required: true,
        _id: false,
    })
    mcu: GateLogMcuMetadata;
}

export const GateLogSchema = SchemaFactory.createForClass(GateLog);
