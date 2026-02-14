import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeviceDiagnosticLogDocument =
    HydratedDocument<DeviceDiagnosticLog>;

@Schema({ _id: false })
export class DiagnosticLogEntry {
    @Prop({ required: true })
    ts: number;

    @Prop({ required: true })
    level: string;

    @Prop({ required: true })
    event: string;

    @Prop({ required: false })
    message?: string;
}

const DiagnosticLogEntrySchema =
    SchemaFactory.createForClass(DiagnosticLogEntry);

@Schema({ timestamps: true })
export class DeviceDiagnosticLog {
    @Prop({ required: true, index: true })
    deviceId: string;

    @Prop({ required: true, default: () => new Date() })
    receivedAt: Date;

    @Prop({ required: false })
    sessionId?: string;

    @Prop({ required: false })
    fwVersion?: string;

    @Prop({ type: [DiagnosticLogEntrySchema], required: true, default: [] })
    entries: DiagnosticLogEntry[];
}

export const DeviceDiagnosticLogSchema =
    SchemaFactory.createForClass(DeviceDiagnosticLog);

DeviceDiagnosticLogSchema.index({ deviceId: 1, receivedAt: -1 });
