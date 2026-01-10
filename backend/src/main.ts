import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SocketIOAdapter } from './socket-adapter';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Trust proxy - needed to get real client IP from Cloudflare headers
    // Access the underlying Express instance to set trust proxy
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', true);

    // Configure WebSocket adapter for Socket.IO with CORS
    app.useWebSocketAdapter(new SocketIOAdapter(app));

    app.use(cookieParser());

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    app.enableCors({
        origin: [
            'http://localhost:3000',
            'https://app.mitzpe6-8.com',
        ],
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Request-Id'],
        exposedHeaders: ['Content-Type', 'Authorization'],
    });

    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`Backend running on http://localhost:${port}/api`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
