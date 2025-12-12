import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

interface AuthRequestUser {
    userId: string;
    role: string;
    deviceId: string;
}

interface AuthRequest extends Request {
    user?: AuthRequestUser;
}

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<AuthRequest>();

        if (!request.user) {
            throw new UnauthorizedException('User is not authenticated');
        }

        if (request.user.role !== 'admin') {
            throw new ForbiddenException('Admin only');
        }

        return true;
    }
}
