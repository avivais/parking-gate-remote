import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from '../users/users.service';

interface AuthUser {
    userId: string;
    role: string;
    deviceId: string;
}

interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}

@Injectable()
export class ApprovedGuard implements CanActivate {
    constructor(private readonly usersService: UsersService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const httpContext = context.switchToHttp();
        const req = httpContext.getRequest<AuthenticatedRequest>();

        const authUser = req.user;

        if (!authUser) {
            throw new UnauthorizedException('המשתמש לא מאומת');
        }

        const user = await this.usersService.findById(authUser.userId);

        if (!user) {
            throw new UnauthorizedException('משתמש לא נמצא');
        }

        // אדמין תמיד עובר
        if (authUser.role === 'admin' || user.role === 'admin') {
            return true;
        }

        if (!user.approved) {
            throw new ForbiddenException('החשבון ממתין לאישור אדמין');
        }

        if (!user.activeDeviceId) {
            throw new UnauthorizedException(
                'המשתמש לא מחובר ממכשיר כלשהו',
            );
        }

        if (user.activeDeviceId !== authUser.deviceId) {
            throw new UnauthorizedException(
                'המשתמש מחובר ממכשיר אחר או התנתק',
            );
        }

        return true;
    }
}
