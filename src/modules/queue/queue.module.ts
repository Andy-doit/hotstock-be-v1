import { Module, NestModule, MiddlewareConsumer, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { EmailProcessor } from './processors/email.processor';
// Removed express adapter import as we use fastify
import { FastifyAdapter } from '@bull-board/fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [EmailProcessor],
  exports: [BullModule], // Export BullModule so other modules (e.g. AuthModule) can inject the queue
})
export class QueueModule {
  constructor(private readonly configService: ConfigService) {}

  // We export a method to setup Bull Board on the main Fastify instance
  // Since we are using Fastify, standard MiddlewareConsumer isn't perfectly mapped for bull-board
  // We'll expose a setup function to be called in main.ts
  static setupBullBoard(app: any, queue: Queue, configService: ConfigService) {
    // Bull Board is a debugging tool — never mount it outside local development,
    // including staging (staging deployments run with NODE_ENV=staging, not
    // 'production', so checking only for 'production' left it exposed there).
    if (configService.get('app.nodeEnv') !== 'development') {
      return;
    }

    const user = configService.get<string>('BULL_BOARD_USER');
    const pass = configService.get<string>('BULL_BOARD_PASS');

    // Fail closed: if credentials aren't configured, don't mount the dashboard
    // at all rather than serving it without auth.
    if (!user || !pass) {
      new Logger(QueueModule.name).warn(
        'BULL_BOARD_USER/BULL_BOARD_PASS not set — Bull Board dashboard disabled.',
      );
      return;
    }

    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(queue)],
      serverAdapter,
    });

    // Basic auth
    app.register(async (fastify: any) => {
      fastify.addHook('onRequest', async (request: any, reply: any) => {
        const b64auth = (request.headers.authorization || '').split(' ')[1] || '';
        const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

        const loginBuf = Buffer.from(login ?? '');
        const userBuf = Buffer.from(user);
        const passwordBuf = Buffer.from(password ?? '');
        const passBuf = Buffer.from(pass);

        const loginMatches =
          loginBuf.length === userBuf.length && timingSafeEqual(loginBuf, userBuf);
        const passwordMatches =
          passwordBuf.length === passBuf.length && timingSafeEqual(passwordBuf, passBuf);

        if (loginMatches && passwordMatches) {
          return;
        }

        reply.header('WWW-Authenticate', 'Basic realm="401"');
        reply.code(401).send('Access denied');
      });

      fastify.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues', basePath: '/admin/queues' });
    });
  }
}
