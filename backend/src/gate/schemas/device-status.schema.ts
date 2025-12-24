import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeviceStatusDocument = HydratedDocument<DeviceStatus>;

@Schema({ timestamps: true })
export class DeviceStatus {
    @Prop({ required: true, unique: true, index: true })
    deviceId: string;

    @Prop({ required: true })
    online: boolean;

    @Prop({ required: true })
    updatedAt: number;

    @Prop({ required: true })
    lastSeenAt: Date;

    @Prop({ required: false })
    rssi?: number;

    @Prop({ required: false })
    fwVersion?: string;

    @Prop({ type: Object, required: false })
    raw?: Record<string, unknown>;
}

export const DeviceStatusSchema = SchemaFactory.createForClass(DeviceStatus);

