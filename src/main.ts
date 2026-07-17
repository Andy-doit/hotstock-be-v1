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
import { Queue } from 'bullmq';

import { AppModule } from './app.module';
import { QueueModule } from './modules/queue/queue.module';
import { getQueueToken } from '@nestjs/bullmq';

interface SwaggerMediaType {
  schema?: Record<string, unknown>;
}

interface SwaggerResponse {
  content?: Record<string, unknown>;
}

interface SwaggerOperation {
  responses: Record<string, unknown>;
}

interface SwaggerDocumentWithPaths {
  paths?: object;
}

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
]);

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      maxParamLength: 512,
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
  await app.register(helmet);
  const corsOrigins = configService.get<string[]>('app.corsOrigins') || '*';
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });
  const globalPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  const normalizedGlobalPrefix = globalPrefix.replace(/^\/+|\/+$/g, '');

  app.setGlobalPrefix(normalizedGlobalPrefix);
  if (configService.get('app.nodeEnv') !== 'production') {
    const { DocumentBuilder, SwaggerModule, getSchemaPath } =
      await import('@nestjs/swagger');
    const { ApiSuccessEnvelopeDto } =
      await import('./common/dto/api-success-envelope.dto');
    const config = new DocumentBuilder()
      .setTitle('API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [ApiSuccessEnvelopeDto],
    });
    applySuccessEnvelopeToSwaggerDocument(
      document,
      getSchemaPath(ApiSuccessEnvelopeDto),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  const emailQueue = app.get<Queue<unknown, unknown, string>>(
    getQueueToken('email'),
  );
  QueueModule.setupBullBoard(
    app.getHttpAdapter().getInstance(),
    emailQueue,
    configService,
  );
  app.useLogger(new Logger());
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      void (async () => {
        logger.log(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        process.exit(0);
      })();
    });
  });

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(
    `Application is running on: http://0.0.0.0:${port}/${normalizedGlobalPrefix}`,
  );
}
void bootstrap();

function applySuccessEnvelopeToSwaggerDocument(
  document: SwaggerDocumentWithPaths,
  envelopeSchemaPath: string,
): void {
  const pathItems: unknown[] = Object.values(document.paths ?? {});

  pathItems.forEach((pathItem) => {
    if (!isRecord(pathItem)) {
      return;
    }

    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!HTTP_METHODS.has(method) || !isSwaggerOperation(operation)) {
        return;
      }

      Object.entries(operation.responses).forEach(([statusCode, response]) => {
        const status = Number(statusCode);
        if (status < 200 || status >= 300) {
          return;
        }

        if (!isSwaggerResponse(response)) {
          return;
        }

        const jsonContent = response.content?.['application/json'];
        if (!isSwaggerMediaType(jsonContent)) {
          return;
        }

        const originalSchema = jsonContent?.schema;
        if (!originalSchema) {
          return;
        }

        jsonContent.schema = {
          allOf: [
            { $ref: envelopeSchemaPath },
            {
              properties: {
                data: originalSchema,
              },
            },
          ],
        };
      });
    });
  });
}

function isSwaggerOperation(value: unknown): value is SwaggerOperation {
  return isRecord(value) && isRecord(value.responses);
}

function isSwaggerResponse(value: unknown): value is SwaggerResponse {
  if (!isRecord(value)) {
    return false;
  }

  return value.content === undefined || isRecord(value.content);
}

function isSwaggerMediaType(value: unknown): value is SwaggerMediaType {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
