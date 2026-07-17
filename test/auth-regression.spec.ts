import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';

const refreshUser = {
  id: 42,
  email: 'user@example.com',
  username: 'user',
  role: 'user',
  blocked: false,
  plan: null,
};

function createAuthService(options: {
  prisma: object;
  redis?: object;
  jwtService?: object;
  configService?: object;
  emailQueue?: object;
}): AuthService {
  return new AuthService(
    options.prisma as never,
    (options.jwtService ?? { sign: () => 'signed-token' }) as never,
    (options.configService ?? { get: () => '7d' }) as never,
    (options.redis ?? {}) as never,
    (options.emailQueue ?? { add: async () => undefined }) as never,
  );
}

test('concurrent refresh simulation rotates only one token', async () => {
  let consumed = false;
  let revokedActiveSessions = 0;
  const storedToken = {
    id: 100,
    userId: refreshUser.id,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: refreshUser,
  };
  const tx = {
    refreshToken: {
      updateMany: async () => {
        if (consumed) {
          return { count: 0 };
        }
        consumed = true;
        return { count: 1 };
      },
      create: async () => ({ id: 101 }),
    },
  };
  const prisma = {
    refreshToken: {
      findFirst: async () => storedToken,
      findUnique: async () => ({ revokedAt: new Date() }),
      updateMany: async () => {
        revokedActiveSessions += 1;
        return { count: 1 };
      },
    },
    $transaction: async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
  };
  let signCount = 0;
  const jwtService = {
    sign: () => {
      signCount += 1;
      return `access-token-${signCount}`;
    },
  };
  const service = createAuthService({ prisma, jwtService });

  const results = await Promise.allSettled([
    service.refresh('refresh-token', '127.0.0.1', 'test-agent'),
    service.refresh('refresh-token', '127.0.0.1', 'test-agent'),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected);
  assert.ok(
    rejected.status === 'rejected' && rejected.reason instanceof UnauthorizedException,
  );
  assert.equal(revokedActiveSessions, 1);
});

test('expired OTP deletes attempts key instead of leaving it without TTL', async () => {
  const deletedKeys: string[][] = [];
  const redis = {
    pipeline: () => ({
      get: () => redis.pipeline(),
      ttl: () => redis.pipeline(),
      exec: async () => [
        [null, '0'],
        [null, null],
        [null, -2],
      ],
    }),
    del: async (...keys: string[]) => {
      deletedKeys.push(keys);
      return keys.length;
    },
  };
  const service = createAuthService({ prisma: {}, redis });

  await assert.rejects(
    () => service.verifyOtp('user@example.com', '123456'),
    BadRequestException,
  );
  assert.deepEqual(deletedKeys, [['otp_attempts:user@example.com']]);
});

test('mismatched OTP increments attempts and preserves a TTL', async () => {
  const expireCalls: Array<{ key: string; seconds: number }> = [];
  let pipelineCall = 0;
  const redis = {
    pipeline: () => {
      pipelineCall += 1;
      if (pipelineCall === 1) {
        return {
          get: () => redis.pipeline(),
          ttl: () => redis.pipeline(),
          exec: async () => [
            [null, '0'],
            [null, '123456'],
            [null, 42],
          ],
        };
      }

      return {
        incr: () => redis.pipeline(),
        expire: (key: string, seconds: number) => {
          expireCalls.push({ key, seconds });
          return redis.pipeline();
        },
        exec: async () => [
          [null, 1],
          [null, 1],
        ],
      };
    },
  };
  const service = createAuthService({ prisma: {}, redis });

  await assert.rejects(
    () => service.verifyOtp('user@example.com', '000000'),
    BadRequestException,
  );
  assert.deepEqual(expireCalls, [
    { key: 'otp_attempts:user@example.com', seconds: 42 },
  ]);
});

test('successful OTP verification deletes OTP and attempts keys', async () => {
  const deletedKeys: string[][] = [];
  let pipelineCall = 0;
  const redis = {
    pipeline: () => {
      pipelineCall += 1;
      if (pipelineCall === 1) {
        return {
          get: () => redis.pipeline(),
          ttl: () => redis.pipeline(),
          exec: async () => [
            [null, '0'],
            [null, '123456'],
            [null, 60],
          ],
        };
      }

      return {
        incr: () => redis.pipeline(),
        expire: () => redis.pipeline(),
        exec: async () => [
          [null, 1],
          [null, 1],
        ],
      };
    },
    del: async (...keys: string[]) => {
      deletedKeys.push(keys);
      return keys.length;
    },
  };
  const prisma = {
    user: {
      findUnique: async () => ({ id: refreshUser.id }),
    },
  };
  const service = createAuthService({
    prisma,
    redis,
    jwtService: { sign: () => 'reset-token' },
  });

  const response = await service.verifyOtp('user@example.com', '123456');

  assert.deepEqual(response, { reset_token: 'reset-token' });
  assert.deepEqual(deletedKeys, [
    ['otp:user@example.com', 'otp_attempts:user@example.com'],
  ]);
});
