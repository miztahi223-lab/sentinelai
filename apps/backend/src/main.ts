import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Needed so `req.rawBody` is available for Stripe webhook signature
    // verification (BillingController) while every other route still gets
    // the normal parsed `req.body`.
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.use(helmet());

  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:3000',
  );
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = configService.get<string>('PORT', '3001');
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal error during application bootstrap', error);
  process.exit(1);
});
