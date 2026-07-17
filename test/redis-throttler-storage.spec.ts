import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import type Redis from 'ioredis';
import { RedisThrottlerStorage } from '../src/common/throttler/redis-throttler-storage';

type RedisValue = {
  value: string;
  expiresAt: number | null;
};

class FakeRedis {
  private readonly values = new Map<string, RedisValue>();
  private now = 0;

  failNextEval = false;

  advance(milliseconds: number): void {
    this.now += milliseconds;
  }

  pttl(key: string): number {
    this.deleteIfExpired(key);
    const record = this.values.get(key);
    if (!record) {
      return -2;
    }
    if (record.expiresAt === null) {
      return -1;
    }

    return Math.max(0, record.expiresAt - this.now);
  }

  async eval(
    _script: string,
    keyCount: number,
    hitKey: string,
    blockKey: string,
    ttlMs: number,
    limit: number,
    blockDurationMs: number,
  ): Promise<[number, number, number, number]> {
    assert.equal(keyCount, 2);

    if (this.failNextEval) {
      this.failNextEval = false;
      throw new Error('Redis unavailable for admin@example.com');
    }

    const blockTtl = this.pttl(blockKey);
    if (blockTtl > 0) {
      return [this.getHits(hitKey, limit + 1), this.safeTtl(hitKey), 1, blockTtl];
    }

    const hits = this.incr(hitKey);
    let hitTtl = this.pttl(hitKey);
    if (hits === 1 || hitTtl < 0) {
      this.pexpire(hitKey, ttlMs);
      hitTtl = ttlMs;
    }

    if (hits > limit) {
      this.psetex(blockKey, blockDurationMs, '1');
      return [hits, hitTtl, 1, blockDurationMs];
    }

    return [hits, hitTtl, 0, 0];
  }

  private deleteIfExpired(key: string): void {
    const record = this.values.get(key);
    if (record?.expiresAt !== null && record?.expiresAt <= this.now) {
      this.values.delete(key);
    }
  }

  private getHits(key: string, fallback: number): number {
    this.deleteIfExpired(key);
    const record = this.values.get(key);
    return record ? Number(record.value) : fallback;
  }

  private incr(key: string): number {
    this.deleteIfExpired(key);
    const current = this.values.get(key);
    const nextValue = this.getHits(key, 0) + 1;
    this.values.set(key, {
      value: String(nextValue),
      expiresAt: current?.expiresAt ?? null,
    });
    return nextValue;
  }

  private pexpire(key: string, ttlMs: number): void {
    const record = this.values.get(key);
    if (record) {
      record.expiresAt = this.now + ttlMs;
    }
  }

  private psetex(key: string, ttlMs: number, value: string): void {
    this.values.set(key, { value, expiresAt: this.now + ttlMs });
  }

  private safeTtl(key: string): number {
    const ttl = this.pttl(key);
    return ttl < 0 ? 0 : ttl;
  }
}

function createStorage(fakeRedis: FakeRedis): RedisThrottlerStorage {
  return new RedisThrottlerStorage(fakeRedis as unknown as Redis);
}

test('RedisThrottlerStorage sets TTL atomically on first hit', async () => {
  const fakeRedis = new FakeRedis();
  const storage = createStorage(fakeRedis);

  const result = await storage.increment('rate:user', 60_000, 2, 30_000, 'default');

  assert.equal(result.totalHits, 1);
  assert.equal(result.timeToExpire, 60);
  assert.equal(result.isBlocked, false);
  assert.equal(fakeRedis.pttl('rate:user') > 0, true);
});

test('RedisThrottlerStorage reuses hit TTL for repeated hits', async () => {
  const fakeRedis = new FakeRedis();
  const storage = createStorage(fakeRedis);

  await storage.increment('rate:user', 60_000, 2, 30_000, 'default');
  fakeRedis.advance(1_250);
  const result = await storage.increment('rate:user', 60_000, 2, 30_000, 'default');

  assert.equal(result.totalHits, 2);
  assert.equal(result.timeToExpire, 59);
  assert.equal(result.isBlocked, false);
});

test('RedisThrottlerStorage blocks after limit and returns block duration', async () => {
  const fakeRedis = new FakeRedis();
  const storage = createStorage(fakeRedis);

  await storage.increment('rate:user', 60_000, 2, 30_000, 'default');
  await storage.increment('rate:user', 60_000, 2, 30_000, 'default');
  const blocked = await storage.increment('rate:user', 60_000, 2, 30_000, 'default');
  fakeRedis.advance(1_000);
  const stillBlocked = await storage.increment(
    'rate:user',
    60_000,
    2,
    30_000,
    'default',
  );

  assert.equal(blocked.totalHits, 3);
  assert.equal(blocked.isBlocked, true);
  assert.equal(blocked.timeToBlockExpire, 30);
  assert.equal(stillBlocked.totalHits, 3);
  assert.equal(stillBlocked.isBlocked, true);
  assert.equal(stillBlocked.timeToBlockExpire, 29);
});

test('RedisThrottlerStorage fails closed when Redis errors', async () => {
  const fakeRedis = new FakeRedis();
  fakeRedis.failNextEval = true;
  const storage = createStorage(fakeRedis);

  await assert.rejects(
    storage.increment('rate:user', 60_000, 2, 30_000, 'default'),
    /Redis unavailable/,
  );
});
