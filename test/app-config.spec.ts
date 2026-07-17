import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSmtpSecure } from '../src/config/app.config';

test('resolveSmtpSecure enables implicit TLS for SMTP 465 by default', () => {
  assert.equal(resolveSmtpSecure(465), true);
});

test('resolveSmtpSecure keeps STARTTLS ports non-secure by default', () => {
  assert.equal(resolveSmtpSecure(587), false);
  assert.equal(resolveSmtpSecure(2525), false);
});

test('resolveSmtpSecure honors explicit env override', () => {
  assert.equal(resolveSmtpSecure(587, 'true'), true);
  assert.equal(resolveSmtpSecure(465, 'false'), false);
  assert.equal(resolveSmtpSecure(587, '1'), true);
  assert.equal(resolveSmtpSecure(465, '0'), false);
});
