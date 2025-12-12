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
            throw new UnauthorizedException('המשתמש לא מאומת');
        }

        if (request.user.role !== 'admin') {
            throw new ForbiddenException('גישה מוגבלת לאדמין בלבד');
        }

        return true;
    }
}
