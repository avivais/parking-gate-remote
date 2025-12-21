import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerLimitDetail } from '@nestjs/throttler';
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
            return `gate-open:user:${userId}`;
        }
        // Fallback to IP (shouldn't happen in our system since route is protected)
        return `gate-open:ip:${req.ip || 'unknown'}`;
    }

    protected async throwThrottlingException(
        _context: ExecutionContext,
        _throttlerLimitDetail: ThrottlerLimitDetail,
    ): Promise<void> {
        throw new ThrottlerException('יותר מדי בקשות, נסה שוב בעוד רגע');
    }
}

