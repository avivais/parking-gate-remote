import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { JwtStrategy } from './jwt.strategy';
import { ApprovedGuard } from './approved.guard';
import { AdminGuard } from './admin.guard';
import { ForgotPasswordThrottlerGuard } from './forgot-password-throttler.guard';

type ExpiresInType =
    | number
    | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

@Module({
    imports: [
        ConfigModule,
        UsersModule,
        EmailModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const expiresInConfig =
                    configService.get<string>('JWT_EXPIRES_IN') ?? '15m';

                const expiresIn: ExpiresInType =
                    expiresInConfig as ExpiresInType;

                return {
                    secret: configService.get<string>('JWT_SECRET') ?? '',
                    signOptions: {
                        expiresIn,
                    },
                };
            },
        }),
    ],
    providers: [
        AuthService,
        JwtStrategy,
        ApprovedGuard,
        AdminGuard,
        ForgotPasswordThrottlerGuard,
    ],
    controllers: [AuthController],
    exports: [AuthService, ApprovedGuard, AdminGuard],
})
export class AuthModule {}
