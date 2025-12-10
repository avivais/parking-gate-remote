import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true, select: false })
    passwordHash: string;

    @Prop({ required: true, enum: ['user', 'admin'], default: 'user' })
    role: 'user' | 'admin';

    @Prop({ default: false })
    approved: boolean;

    @Prop()
    activeDeviceId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
