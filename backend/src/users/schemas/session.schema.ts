import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true })
export class Session {
    @Prop({ required: true, index: true })
    userId: string;

    @Prop({ required: true })
    deviceId: string;

    @Prop({ required: true, unique: true, index: true })
    sessionId: string; // sid

    @Prop({ required: true, select: false })
    refreshTokenHash: string;

    @Prop({ default: Date.now })
    lastActiveAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Compound index for userId + deviceId lookups
SessionSchema.index({ userId: 1, deviceId: 1 });

