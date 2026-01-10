import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TerminalService } from './terminal.service';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../../auth/auth.types';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userRole?: string;
}

@WebSocketGateway({
    namespace: '/terminal',
    cors: {
        origin: [
            'http://localhost:3000',
            'https://app.mitzpe6-8.com',
        ],
        credentials: true,
    },
})
export class TerminalGateway
    implements OnGatewayConnection, OnGatewayDisconnect
{
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(TerminalGateway.name);

    constructor(
        private readonly terminalService: TerminalService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {}

    async handleConnection(client: AuthenticatedSocket): Promise<void> {
        try {
            // Extract token from handshake auth or query
            const token =
                client.handshake.auth?.token ||
                client.handshake.query?.token ||
                client.handshake.headers?.authorization?.replace('Bearer ', '');

            if (!token || typeof token !== 'string') {
                this.logger.warn(
                    `Connection rejected: No token provided for socket ${client.id}`,
                );
                client.emit('error', { message: 'Authentication required' });
                client.disconnect();
                return;
            }

            // Verify JWT token
            let payload: JwtPayload;
            try {
                const jwtSecret =
                    this.configService.get<string>('JWT_SECRET');
                if (!jwtSecret) {
                    throw new Error('JWT_SECRET is not defined');
                }
                payload = this.jwtService.verify<JwtPayload>(token, {
                    secret: jwtSecret,
                });
            } catch (error) {
                this.logger.warn(
                    `Connection rejected: Invalid token for socket ${client.id}`,
                );
                client.emit('error', { message: 'Invalid token' });
                client.disconnect();
                return;
            }

            // Check if user exists
            const user = await this.usersService.findById(payload.sub);
            if (!user) {
                this.logger.warn(
                    `Connection rejected: User not found for socket ${client.id}`,
                );
                client.emit('error', { message: 'User not found' });
                client.disconnect();
                return;
            }

            // Check admin role
            if (payload.role !== 'admin' || user.role !== 'admin') {
                this.logger.warn(
                    `Connection rejected: Non-admin user ${payload.sub} attempted terminal access`,
                );
                client.emit('error', {
                    message: 'Admin access required',
                });
                client.disconnect();
                return;
            }

            // Store authenticated user info
            client.userId = payload.sub;
            client.userRole = payload.role;

            this.logger.log(
                `Terminal connection established: socket ${client.id} for admin user ${payload.sub}`,
            );

            // Create terminal session with output handler set up immediately
            this.terminalService.createTerminal(
                client.id,
                payload.sub,
                (data: string) => {
                    client.emit('terminal-output', data);
                },
            );
        } catch (error) {
            this.logger.error(
                `Error handling connection for socket ${client.id}:`,
                error,
            );
            client.emit('error', { message: 'Connection error' });
            client.disconnect();
        }
    }

    handleDisconnect(client: AuthenticatedSocket): void {
        this.logger.log(`Terminal connection disconnected: socket ${client.id}`);
        this.terminalService.destroyTerminal(client.id);
    }

    @SubscribeMessage('terminal-input')
    handleTerminalInput(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { input: string },
    ): void {
        if (!client.userId || !client.userRole) {
            client.emit('error', { message: 'Not authenticated' });
            return;
        }

        if (client.userRole !== 'admin') {
            client.emit('error', { message: 'Admin access required' });
            return;
        }

        if (typeof data.input !== 'string') {
            client.emit('error', { message: 'Invalid input format' });
            return;
        }

        this.terminalService.writeToTerminal(client.id, data.input);
    }

    @SubscribeMessage('terminal-resize')
    handleTerminalResize(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { cols: number; rows: number },
    ): void {
        if (!client.userId || !client.userRole) {
            client.emit('error', { message: 'Not authenticated' });
            return;
        }

        if (client.userRole !== 'admin') {
            client.emit('error', { message: 'Admin access required' });
            return;
        }

        const cols = Number(data.cols);
        const rows = Number(data.rows);

        if (
            !Number.isInteger(cols) ||
            !Number.isInteger(rows) ||
            cols < 1 ||
            rows < 1
        ) {
            client.emit('error', { message: 'Invalid resize dimensions' });
            return;
        }

        this.terminalService.resizeTerminal(client.id, cols, rows);
    }
}
