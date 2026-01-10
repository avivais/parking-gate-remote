import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class SocketIOAdapter extends IoAdapter {
    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: [
                    'http://localhost:3000',
                    'https://app.mitzpe6-8.com',
                ],
                credentials: true,
                methods: ['GET', 'POST'],
                allowedHeaders: ['Authorization', 'Content-Type'],
            },
            transports: ['websocket', 'polling'],
            allowEIO3: true,
        });
        return server;
    }
}
