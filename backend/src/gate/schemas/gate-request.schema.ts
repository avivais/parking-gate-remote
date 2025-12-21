import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GateRequestDocument = HydratedDocument<GateRequest>;

@Schema({ timestamps: true })
export class GateRequest {
    @Prop({ required: true, unique: true, index: true })
    requestId: string;

    @Prop({ required: true })
    userId: string;

    @Prop({ required: true })
    createdAt: Date;
}

export const GateRequestSchema = SchemaFactory.createForClass(GateRequest);

// Create TTL index on createdAt with default 30 seconds
// This will be updated dynamically in GateModule based on config
GateRequestSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: 30 },
);

