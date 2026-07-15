import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { AppModule } from './app.module';
import { QueueModule } from './modules/queue/queue.module';
import { getQueueToken } from '@nestjs/bullmq';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: isProduction ? 'info' : 'debug',
        transport: isProduction
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                translateTime: 'SYS:standard',
                singleLine: true,
              },
            },
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.oldPassword',
          'req.body.newPassword',
          'req.body.confirmPassword',
          'req.body.otp',
          'req.body.token',
          'req.body.refreshToken',
          'req.body.resetToken',
        ],
      },
    }),
  );

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers
  await app.register(helmet);

  // CORS
  const corsOrigins = configService.get<string[]>('app.corsOrigins') || '*';
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  // Multipart (file uploads)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  });

  // Global prefix
  const globalPrefix =
    configService.get<string>('app.apiPrefix') || 'api/v1';
  const normalizedGlobalPrefix = globalPrefix.replace(/^\/+|\/+$/g, '');

  // Static file serving for local uploads.
  // Prefix matches the old UploadsController route (/api/v1/uploads/:filename) so
  // that legacy article image URLs stored in the DB continue to resolve after the
  // controller was removed.  fastifyStatic bypasses the NestJS global-prefix, so
  // we set the full path explicitly here.
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: `/${normalizedGlobalPrefix}/uploads/`,
    decorateReply: false,
  });

  app.setGlobalPrefix(normalizedGlobalPrefix);

  // Global pipes, filters (already registered in AppModule)

  // Swagger — only non-production
  if (configService.get('app.nodeEnv') !== 'production') {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Bull Board for Queues
  const emailQueue = app.get(getQueueToken('email'));
  QueueModule.setupBullBoard(app.getHttpAdapter().getInstance(), emailQueue, configService);

  // Pino logging integration
  app.useLogger(new Logger());

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  });

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(
    `Application is running on: http://0.0.0.0:${port}/${normalizedGlobalPrefix}`,
  );
}
bootstrap();
