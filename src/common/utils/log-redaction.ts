const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/g;
const OTP_CONTEXT_PATTERN =
  /\b(otp|code|mã|ma|pin)\b\s*[:=]?\s*["']?\d{4,8}["']?/gi;

const UNKNOWN_LOG_ERROR = 'Unknown error';

export function redactSensitiveLogValue(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(OTP_CONTEXT_PATTERN, '[redacted-otp]')
    .replace(LONG_TOKEN_PATTERN, '[redacted-token]');
}

export function getSafeErrorLogMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveLogValue(error.message);
  }

  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return redactSensitiveLogValue(error.toString());
  }

  try {
    return redactSensitiveLogValue(JSON.stringify(error) ?? UNKNOWN_LOG_ERROR);
  } catch {
    return UNKNOWN_LOG_ERROR;
  }
}

export function getSafeErrorLogStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) {
    return undefined;
  }

  return redactSensitiveLogValue(error.stack);
}
