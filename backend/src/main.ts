import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    app.enableCors({
        origin: ['http://localhost:3000'],
        credentials: true,
    });

    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`Backend running on http://localhost:${port}/api`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
