import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { EmailProcessor } from './processors/email.processor';
import { FastifyAdapter } from '@bull-board/fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

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
  exports: [BullModule],
})
export class QueueModule {
  constructor(private readonly configService: ConfigService) {}

  static setupBullBoard(
    app: FastifyInstance,
    queue: Queue<unknown, unknown, string>,
    configService: ConfigService,
  ): void {
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

    const bullBoardPlugin: FastifyPluginCallback = (
      fastify,
      _options,
      done,
    ) => {
      fastify.addHook('onRequest', (request, reply, hookDone) => {
        const authorization = request.headers.authorization ?? '';
        const b64auth = authorization.split(' ')[1] ?? '';
        const [login, password] = Buffer.from(b64auth, 'base64')
          .toString()
          .split(':');

        const loginBuf = Buffer.from(login ?? '');
        const userBuf = Buffer.from(user);
        const passwordBuf = Buffer.from(password ?? '');
        const passBuf = Buffer.from(pass);

        const loginMatches =
          loginBuf.length === userBuf.length &&
          timingSafeEqual(loginBuf, userBuf);
        const passwordMatches =
          passwordBuf.length === passBuf.length &&
          timingSafeEqual(passwordBuf, passBuf);

        if (loginMatches && passwordMatches) {
          hookDone();
          return;
        }

        reply.header('WWW-Authenticate', 'Basic realm="401"');
        reply.code(401).send('Access denied');
        return;
      });

      fastify.register(serverAdapter.registerPlugin(), {
        prefix: '/admin/queues',
      });
      done();
    };

    app.register(bullBoardPlugin);
  }
}
