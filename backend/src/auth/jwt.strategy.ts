import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from './auth.types';
import { UsersService } from '../users/users.service';

function extractJwtFromRequest(req: Request): string | null {
    const authorization =
        req.headers.authorization ??
        (req.headers.Authorization as string | undefined);

    if (!authorization || typeof authorization !== 'string') {
        return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
        return null;
    }

    return token;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }

        const options: StrategyOptions = {
            jwtFromRequest: extractJwtFromRequest,
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        };

        super(options);
    }

    async validate(payload: JwtPayload) {
        // Check if user exists
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        // Check session in sessions collection
        const session = await this.usersService.getSessionBySessionId(payload.sid);

        // Admins can have multiple active devices/sessions, so skip session check for them
        if (payload.role !== 'admin') {
            if (!session) {
                throw new UnauthorizedException('Session לא תקין');
            }

            if (session.userId !== payload.sub) {
                throw new UnauthorizedException('Session לא תואם למשתמש');
            }

            if (session.deviceId !== payload.deviceId) {
                throw new UnauthorizedException('Device לא תואם');
            }

            // Update last active timestamp
            await this.usersService.updateSessionLastActive(payload.sid);
        }

        return {
            userId: payload.sub,
            role: payload.role,
            deviceId: payload.deviceId,
            sid: payload.sid,
        };
    }
}
