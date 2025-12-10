import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from './auth.types';

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
    constructor(configService: ConfigService) {
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

    validate(payload: JwtPayload) {
        return {
            userId: payload.sub,
            role: payload.role,
            deviceId: payload.deviceId,
        };
    }
}
