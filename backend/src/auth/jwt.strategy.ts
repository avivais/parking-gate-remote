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
        const sessionData = await this.usersService.getSessionData(payload.sub);

        if (!sessionData) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        if (
            !sessionData.activeSessionId ||
            sessionData.activeSessionId !== payload.sid
        ) {
            throw new UnauthorizedException('Session לא תקין');
        }

        if (
            !sessionData.activeDeviceId ||
            sessionData.activeDeviceId !== payload.deviceId
        ) {
            throw new UnauthorizedException('Device לא תואם');
        }

        return {
            userId: payload.sub,
            role: payload.role,
            deviceId: payload.deviceId,
            sid: payload.sid,
        };
    }
}
