import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';
import { getClientIp } from '../utils/ip-extractor';

/**
 * Throttles POST /auth/forgot-password at 3 requests per 15 minutes per IP
 * to limit abuse (e.g. email enumeration or spam).
 */
@Injectable()
export class ForgotPasswordThrottlerGuard extends ThrottlerGuard {
    async getTracker(req: Request): Promise<string> {
        const ip = getClientIp(req);
        return Promise.resolve(`forgot-password:ip:${ip}`);
    }

    protected async throwThrottlingException(): Promise<void> {
        return Promise.reject(
            new ThrottlerException(
                'יותר מדי בקשות לאיפוס סיסמה. נסה שוב בעוד כ־15 דקות.',
            ),
        );
    }
}
