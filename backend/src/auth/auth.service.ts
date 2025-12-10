import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import { JwtPayload } from './auth.types';

export interface AuthTokens {
    accessToken: string;
}

export interface AuthUserResponse {
    user: User;
    tokens: AuthTokens;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) {}

    private buildAccessToken(user: UserDocument): string {
        const payload: JwtPayload = {
            sub: String(user.id),
            role: String(user.role),
        };

        return this.jwtService.sign(payload);
    }

    async register(registerDto: RegisterDto): Promise<User> {
        const existing = await this.usersService.findByEmail(registerDto.email);
        if (existing) {
            throw new BadRequestException(
                'User with this email already exists',
            );
        }

        const passwordHash = await bcrypt.hash(registerDto.password, 10);

        const user = await this.usersService.createLocalUser(
            registerDto.name,
            registerDto.email,
            passwordHash,
        );

        return user;
    }

    async login(loginDto: LoginDto): Promise<AuthUserResponse> {
        const userWithPassword =
            await this.usersService.findByEmailWithPassword(loginDto.email);

        if (!userWithPassword || !userWithPassword.passwordHash) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (userWithPassword.status === UserStatus.BLOCKED) {
            throw new UnauthorizedException('User is blocked');
        }

        const passwordValid = await bcrypt.compare(
            loginDto.password,
            userWithPassword.passwordHash,
        );

        if (!passwordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const accessToken = this.buildAccessToken(userWithPassword);
        const user = userWithPassword.toObject() as User;

        return {
            user,
            tokens: { accessToken },
        };
    }

    async getProfile(userId: string): Promise<User | null> {
        return await this.usersService.findById(userId);
    }
}
