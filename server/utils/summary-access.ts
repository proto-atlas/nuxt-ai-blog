import type { H3Event } from 'h3';
import type { SummaryErrorCode } from '#shared/error-codes';

export const SUMMARY_ACCESS_HEADER = 'x-summary-access-key';

export interface SummaryAccessResult {
  allowed: boolean;
  error?: Extract<SummaryErrorCode, 'access_required' | 'server_misconfigured'>;
}

function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < maxLength; i += 1) {
    const left = i < a.length ? a.charCodeAt(i) : 0;
    const right = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= left ^ right;
  }

  return mismatch === 0;
}

export function checkSummaryAccess(
  event: H3Event,
  configuredKey: unknown,
  env: string | undefined = process.env.NODE_ENV,
): SummaryAccessResult {
  const expected = typeof configuredKey === 'string' ? configuredKey.trim() : '';

  if (!expected) {
    return env === 'production'
      ? { allowed: false, error: 'server_misconfigured' }
      : { allowed: true };
  }

  const provided = getRequestHeader(event, SUMMARY_ACCESS_HEADER)?.trim() ?? '';
  if (!constantTimeEqual(provided, expected)) {
    return { allowed: false, error: 'access_required' };
  }

  return { allowed: true };
}
