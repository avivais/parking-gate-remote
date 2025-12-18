import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'archived';

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true, select: false })
    passwordHash: string;

    @Prop({ required: true, enum: ['user', 'admin'], default: 'user' })
    role: 'user' | 'admin';

    @Prop({ required: true })
    firstName: string;

    @Prop({ required: true })
    lastName: string;

    @Prop({ required: true })
    phone: string;

    @Prop({ required: true })
    apartmentNumber: number;

    @Prop({ required: true })
    floor: number;

    @Prop({ required: true, enum: ['pending', 'approved', 'rejected', 'archived'], default: 'pending' })
    status: UserStatus;

    @Prop({ type: String, default: null })
    rejectionReason: string | null;

    @Prop()
    activeDeviceId?: string;

    @Prop()
    activeSessionId?: string;

    @Prop({ select: false })
    refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
