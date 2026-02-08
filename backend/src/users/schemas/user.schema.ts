import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

// Constants for UserStatus values - single source of truth
export const USER_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ARCHIVED: 'archived',
} as const;

// Derive the type from the constants to avoid duplication
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

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

    @Prop({
        required: true,
        enum: [
            USER_STATUS.PENDING,
            USER_STATUS.APPROVED,
            USER_STATUS.REJECTED,
            USER_STATUS.ARCHIVED,
        ],
        default: USER_STATUS.PENDING,
    })
    status: UserStatus;

    @Prop({ type: String, default: null })
    rejectionReason: string | null;

    @Prop()
    approvedAt?: Date;

    @Prop()
    rejectedAt?: Date;

    @Prop()
    approvalEmailSentAt?: Date;

    @Prop()
    activeDeviceId?: string;

    @Prop()
    activeSessionId?: string;

    @Prop({ select: false })
    refreshTokenHash?: string;

    @Prop({ select: false })
    resetPasswordTokenHash?: string;

    @Prop()
    resetPasswordExpiresAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
