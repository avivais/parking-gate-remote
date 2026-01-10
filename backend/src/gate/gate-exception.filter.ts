import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GateLog, GateLogDocument } from './schemas/gate-log.schema';
import { ThrottlerException } from '@nestjs/throttler';
import { getClientIp } from '../utils/ip-extractor';

interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role?: string;
        deviceId?: string;
        sid?: string;
    };
}

@Injectable()
@Catch()
export class GateExceptionFilter implements ExceptionFilter {
    constructor(
        @InjectModel(GateLog.name)
        private readonly gateLogModel: Model<GateLogDocument>,
    ) {}

    async catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<AuthenticatedRequest>();

        // Only handle gate/open endpoint
        if (request.path !== '/api/gate/open' || request.method !== 'POST') {
            if (exception instanceof HttpException) {
                response
                    .status(exception.getStatus())
                    .json(exception.getResponse());
            } else {
                response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    message: 'שגיאת שרת',
                });
            }
            return;
        }

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.message
                : 'שגיאת שרת';

        const requestId =
            (request.headers['x-request-id'] as string) ||
            `error-${Date.now()}`;
        const userId = request.user?.userId;
        const deviceId = request.user?.deviceId;
        const sessionId = request.user?.sid;

        // Log rate limit blocks
        if (exception instanceof ThrottlerException) {
            try {
                await this.gateLogModel.create({
                    requestId,
                    userId,
                    deviceId,
                    sessionId,
                    ip: getClientIp(request),
                    userAgent: request.get('user-agent') ?? undefined,
                    openedBy: 'user',
                    status: 'blocked_rate_limit',
                    failureReason: 'יותר מדי בקשות, נסה שוב בעוד רגע',
                    durationMs: 0,
                    mcu: {
                        attempted: false,
                        timeout: false,
                        retries: 0,
                    },
                });
            } catch (logError) {
                // Ignore logging errors
                console.error('Failed to log rate limit block:', logError);
            }
        }

        response.status(status).json({
            statusCode: status,
            message,
        });
    }
}
