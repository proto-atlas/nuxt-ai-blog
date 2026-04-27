/**
 * summary-helpers (summaryError / getRequestSignal) の unit テスト。
 *
 * route handler 本体 (server/api/summary.post.ts) の coverage 0% を補強するため、
 * 切り出した純関数を対象に異常系まで含めて検証する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestSignal, summaryError } from './summary-helpers';

describe('summaryError', () => {
  // h3 createError は Nuxt の auto-import で globalThis に注入されるが、Vitest 単体
  // では存在しないので、shape を保つ簡易 stub を入れる。SummaryErrorData / 統一形状の
  // 検証だけなので、createError 本体の挙動 (h3 内部の Error クラス) には依存しない。
  beforeEach(() => {
    vi.stubGlobal(
      'createError',
      vi.fn((arg: { statusCode: number; statusMessage: string; data: unknown }) => {
        const err = new Error(arg.statusMessage) as Error & {
          statusCode: number;
          statusMessage: string;
          data: unknown;
        };
        err.statusCode = arg.statusCode;
        err.statusMessage = arg.statusMessage;
        err.data = arg.data;
        return err;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rate_limit / 429 を data.error に詰める', () => {
    const err = summaryError('rate_limit', 429, 30) as unknown as {
      statusCode: number;
      statusMessage: string;
      data: { error: string; retryAfterSeconds?: number };
    };
    expect(err.statusCode).toBe(429);
    expect(err.statusMessage).toBe('rate_limit');
    expect(err.data).toEqual({ error: 'rate_limit', retryAfterSeconds: 30 });
  });

  it('retryAfterSeconds が未指定なら data に含めない', () => {
    const err = summaryError('invalid_input', 400) as unknown as {
      data: { error: string; retryAfterSeconds?: number };
    };
    expect(err.data).toEqual({ error: 'invalid_input' });
    expect(err.data.retryAfterSeconds).toBeUndefined();
  });

  it('upstream_unavailable / 500 を組み立てる', () => {
    const err = summaryError('upstream_unavailable', 500) as unknown as {
      statusCode: number;
      statusMessage: string;
      data: { error: string };
    };
    expect(err.statusCode).toBe(500);
    expect(err.statusMessage).toBe('upstream_unavailable');
    expect(err.data.error).toBe('upstream_unavailable');
  });
});

describe('getRequestSignal', () => {
  it('event.req.signal (h3 v2 / Web Request) を返す', () => {
    const signal = new AbortController().signal;
    const event = { req: { signal } };
    expect(getRequestSignal(event)).toBe(signal);
  });

  it('event.node.req.signal (h3 v1 互換) を fallback で返す', () => {
    const signal = new AbortController().signal;
    const event = { node: { req: { signal } } };
    expect(getRequestSignal(event)).toBe(signal);
  });

  it('event.req.signal が AbortSignal でなければ無視して node fallback を試す', () => {
    const valid = new AbortController().signal;
    const event = {
      req: { signal: 'not-a-signal' },
      node: { req: { signal: valid } },
    };
    expect(getRequestSignal(event)).toBe(valid);
  });

  it('signal が見つからなければ undefined', () => {
    expect(getRequestSignal({})).toBeUndefined();
    expect(getRequestSignal({ req: {} })).toBeUndefined();
    expect(getRequestSignal({ node: { req: {} } })).toBeUndefined();
  });

  it('null / 文字列 / undefined を渡されても落ちずに undefined', () => {
    expect(getRequestSignal(null)).toBeUndefined();
    expect(getRequestSignal(undefined)).toBeUndefined();
    expect(getRequestSignal('event-string')).toBeUndefined();
    expect(getRequestSignal(123)).toBeUndefined();
  });
});
