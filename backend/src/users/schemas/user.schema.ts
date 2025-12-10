import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    BLOCKED = 'blocked',
}

export enum UserRole {
    USER = 'user',
    ADMIN = 'admin',
}

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true, unique: true, lowercase: true, index: true })
    email: string;

    @Prop({ select: false })
    passwordHash?: string;

    @Prop({ enum: ['google', 'facebook', 'local'], default: 'local' })
    authProvider: string;

    @Prop({ enum: UserStatus, default: UserStatus.PENDING })
    status: UserStatus;

    @Prop({ enum: UserRole, default: UserRole.USER })
    role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
