import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

type ReplyBody = {
  statusCode: number;
  code: string;
  message: string;
  error: string;
  timestamp: string;
  path: string;
};

function createHost() {
  const reply: {
    statusCode?: number;
    body?: ReplyBody;
    status: (statusCode: number) => typeof reply;
    send: (body: ReplyBody) => typeof reply;
  } = {
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    send(body: ReplyBody) {
      this.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ method: 'GET', url: '/boom' }),
    }),
  };

  return { host, reply };
}

function createFilter(): HttpExceptionFilter {
  const filter = new HttpExceptionFilter();
  Object.assign(filter, {
    logger: {
      error: () => undefined,
      warn: () => undefined,
    },
  });
  return filter;
}

test('unexpected errors return stable code and generic 5xx message', () => {
  const filter = createFilter();
  const { host, reply } = createHost();

  filter.catch(new Error('database password leaked'), host as never);

  assert.equal(reply.statusCode, 500);
  assert.equal(reply.body?.code, 'INTERNAL_ERROR');
  assert.equal(reply.body?.message, 'Internal Server Error');
  assert.equal(reply.body?.path, '/boom');
});

test('http exceptions preserve stable explicit error code', () => {
  const filter = createFilter();
  const { host, reply } = createHost();

  filter.catch(
    new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dữ liệu không hợp lệ',
    }),
    host as never,
  );

  assert.equal(reply.statusCode, 400);
  assert.equal(reply.body?.code, 'VALIDATION_FAILED');
  assert.equal(reply.body?.message, 'Dữ liệu không hợp lệ');
});
