import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role?: string;
        deviceId?: string;
    };
}

@Injectable()
export class GateThrottlerGuard extends ThrottlerGuard {
    async getTracker(req: AuthenticatedRequest): Promise<string> {
        // Use userId as primary key, fallback to IP if not authenticated
        const userId = req.user?.userId;
        if (userId) {
            return Promise.resolve(`gate-open:user:${userId}`);
        }
        // Fallback to IP (shouldn't happen in our system since route is protected)
        return Promise.resolve(`gate-open:ip:${req.ip || 'unknown'}`);
    }

    protected async throwThrottlingException(): Promise<void> {
        return Promise.reject(
            new ThrottlerException('יותר מדי בקשות, נסה שוב בעוד רגע'),
        );
    }
}
