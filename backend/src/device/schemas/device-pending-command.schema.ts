import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DevicePendingCommandDocument = HydratedDocument<DevicePendingCommand>;

@Schema({ timestamps: true })
export class DevicePendingCommand {
    @Prop({ required: true, index: true })
    deviceId: string;

    @Prop({ required: true })
    action: string;

    @Prop({ required: false })
    reason?: string;

    @Prop({ required: false })
    expiresAt?: Date;

    @Prop({ required: false })
    consumedAt?: Date;
}

export const DevicePendingCommandSchema =
    SchemaFactory.createForClass(DevicePendingCommand);

DevicePendingCommandSchema.index({ deviceId: 1, createdAt: -1 });

