import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../src/common/guards/optional-jwt-auth.guard';

function createContext(headers: Record<string, string | undefined>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  };
}

function createGuard(): OptionalJwtAuthGuard {
  const guard = new OptionalJwtAuthGuard();
  Object.assign(guard, {
    logger: {
      error: () => undefined,
    },
  });
  return guard;
}

test('OptionalJwtAuthGuard allows public requests without token', async () => {
  const guard = createGuard();

  const allowed = await guard.canActivate(
    createContext({}) as never,
  );

  assert.equal(allowed, true);
});

test('OptionalJwtAuthGuard treats expected auth failures as anonymous', () => {
  const guard = createGuard();
  const expiredTokenError = new Error('jwt expired');
  expiredTokenError.name = 'TokenExpiredError';

  assert.equal(guard.handleRequest(null, false), null);
  assert.equal(guard.handleRequest(new UnauthorizedException(), false), null);
  assert.equal(guard.handleRequest(expiredTokenError, false), null);
});

test('OptionalJwtAuthGuard preserves authenticated user payloads', () => {
  const guard = createGuard();
  const user = {
    sub: 1,
    email: 'user@example.com',
    username: 'user',
    role: 'user',
    planSlug: null,
    planLevel: 0,
  };

  assert.deepEqual(guard.handleRequest(null, user), user);
});

test('OptionalJwtAuthGuard rethrows unexpected strategy errors', () => {
  const guard = createGuard();
  const databaseError = new Error('database unavailable');

  assert.throws(
    () => guard.handleRequest(databaseError, false),
    /database unavailable/,
  );
});
