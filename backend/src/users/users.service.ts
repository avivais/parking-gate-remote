import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
    ) {}

    async create(createUserDto: CreateUserDto): Promise<User> {
        const createdUser = new this.userModel({
            ...createUserDto,
            authProvider: 'local',
        });

        return await createdUser.save();
    }

    async createLocalUser(name: string, email: string, passwordHash: string): Promise<User> {
        const createdUser = new this.userModel({
            name,
            email,
            passwordHash,
            authProvider: 'local',
        });

        return await createdUser.save();
    }

    async findAll(): Promise<User[]> {
        return await this.userModel.find().exec();
    }

    async findByEmail(email: string): Promise<User | null> {
        return await this.userModel.findOne({ email }).exec();
    }

    async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
        return await this.userModel.findOne({ email }).select('+passwordHash').exec();
    }

    async findById(id: string): Promise<User | null> {
        return await this.userModel.findById(id).exec();
    }
}
