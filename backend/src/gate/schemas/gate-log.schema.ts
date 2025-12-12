import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GateLogDocument = HydratedDocument<GateLog>;

export type GateOpenedBy = 'user' | 'admin-backdoor';

@Schema({ timestamps: true })
export class GateLog {
    @Prop({ required: false })
    userId?: string;

    @Prop({ required: false })
    email?: string;

    @Prop({ required: false })
    deviceId?: string;

    @Prop({ required: true, enum: ['user', 'admin-backdoor'] })
    openedBy: GateOpenedBy;
}

export const GateLogSchema = SchemaFactory.createForClass(GateLog);
