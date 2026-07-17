import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArticlesService } from '../src/modules/articles/articles.service';

const baseArticle = {
  id: 1,
  title: 'HotStock article',
  description: 'Market note',
  slug: 'hotstock-article',
  publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  coverUrl: null,
  contentBlocks: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  category: { id: 1, name: 'News', slug: 'news' },
  tags: [{ id: 1, name: 'Macro', slug: 'macro' }],
  author: {
    id: 7,
    username: 'editor',
    email: 'editor@example.com',
    passwordHash: 'hashed-secret',
  },
  plans: [{ planId: 1, plan: { slug: 'free', level: 0 } }],
};

test('article detail maps author relation to a safe response shape', async () => {
  let capturedQuery: unknown;
  const prisma = {
    article: {
      findFirst: async (query: unknown) => {
        capturedQuery = query;
        return baseArticle;
      },
    },
  };
  const redis = {
    get: async () => null,
    set: async () => 'OK',
  };
  const service = new ArticlesService(prisma as never, redis as never);

  const response = await service.findBySlug(baseArticle.slug, 0);

  assert.deepEqual(response.author, { id: 7, username: 'editor' });
  assert.equal('passwordHash' in response.author!, false);
  assert.equal('email' in response.author!, false);
  assert.deepEqual(
    (capturedQuery as { select: { author: unknown } }).select.author,
    { select: { id: true, username: true } },
  );
});

test('public article cache hit is sanitized before returning', async () => {
  let rewrittenCacheValue: string | null = null;
  const prisma = {
    article: {
      findFirst: async () => {
        throw new Error('DB should not be called on cache hit');
      },
    },
  };
  const redis = {
    get: async () => JSON.stringify(baseArticle),
    set: async (_key: string, value: string) => {
      rewrittenCacheValue = value;
      return 'OK';
    },
  };
  const service = new ArticlesService(prisma as never, redis as never);

  const response = await service.findBySlug(baseArticle.slug, 0);

  assert.deepEqual(response.author, { id: 7, username: 'editor' });
  assert.equal('passwordHash' in response.author!, false);
  assert.equal('email' in response.author!, false);
  assert.ok(rewrittenCacheValue);
  assert.equal(rewrittenCacheValue.includes('passwordHash'), false);
  assert.equal(rewrittenCacheValue.includes('editor@example.com'), false);
});
