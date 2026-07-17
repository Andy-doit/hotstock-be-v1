import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSafeErrorLogMessage,
  getSafeErrorLogStack,
  redactSensitiveLogValue,
} from '../src/common/utils/log-redaction';

test('redactSensitiveLogValue removes email, otp, and long token values', () => {
  const raw =
    'Delivery failed for user@example.com with otp: 123456 and token abcdefghijklmnopqrstuvwxyz123456';

  const redacted = redactSensitiveLogValue(raw);

  assert.equal(redacted.includes('user@example.com'), false);
  assert.equal(redacted.includes('123456'), false);
  assert.equal(redacted.includes('abcdefghijklmnopqrstuvwxyz123456'), false);
  assert.match(redacted, /\[redacted-email\]/);
  assert.match(redacted, /\[redacted-otp\]/);
  assert.match(redacted, /\[redacted-token\]/);
});

test('getSafeErrorLogMessage and getSafeErrorLogStack redact Error values', () => {
  const error = new Error('SMTP rejected admin@example.com with code=654321');
  error.stack = 'Error: token abcdefghijklmnopqrstuvwxyz123456 for admin@example.com';

  const message = getSafeErrorLogMessage(error);
  const stack = getSafeErrorLogStack(error);

  assert.equal(message.includes('admin@example.com'), false);
  assert.equal(message.includes('654321'), false);
  assert.equal(stack?.includes('admin@example.com'), false);
  assert.equal(stack?.includes('abcdefghijklmnopqrstuvwxyz123456'), false);
});
