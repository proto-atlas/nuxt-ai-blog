/**
 * summary-helpers (summaryError / getRequestSignal) のunitテスト。
 *
 * route handler本体 (server/api/summary.post.ts) のcoverage 0% を補強するため、
 * 切り出した純関数を対象に異常系まで含めて検証する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestSignal, summaryError } from './summary-helpers';

describe('summaryError', () => {
  // h3 createErrorはNuxtのauto-importでglobalThisに注入されるが、Vitest単体
  // では存在しないので、shapeを保つ簡易stubを入れる。SummaryErrorData / 統一形状の
  // 検証だけなので、createError本体の挙動 (h3 内部のErrorクラス) には依存しない。
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

  it('rate_limit / 429 をdata.errorに詰める', () => {
    const err = summaryError('rate_limit', 429, 30) as unknown as {
      statusCode: number;
      statusMessage: string;
      data: { error: string; retryAfterSeconds?: number };
    };
    expect(err.statusCode).toBe(429);
    expect(err.statusMessage).toBe('rate_limit');
    expect(err.data).toEqual({ error: 'rate_limit', retryAfterSeconds: 30 });
  });

  it('retryAfterSecondsが未指定ならdataに含めない', () => {
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

  it('event.node.req.signal (h3 v1 互換) をfallbackで返す', () => {
    const signal = new AbortController().signal;
    const event = { node: { req: { signal } } };
    expect(getRequestSignal(event)).toBe(signal);
  });

  it('event.req.signalがAbortSignalでなければ無視してnode fallbackを試す', () => {
    const valid = new AbortController().signal;
    const event = {
      req: { signal: 'not-a-signal' },
      node: { req: { signal: valid } },
    };
    expect(getRequestSignal(event)).toBe(valid);
  });

  it('signalが見つからなければundefined', () => {
    expect(getRequestSignal({})).toBeUndefined();
    expect(getRequestSignal({ req: {} })).toBeUndefined();
    expect(getRequestSignal({ node: { req: {} } })).toBeUndefined();
  });

  it('null / 文字列 / undefinedを渡されても落ちずにundefined', () => {
    expect(getRequestSignal(null)).toBeUndefined();
    expect(getRequestSignal(undefined)).toBeUndefined();
    expect(getRequestSignal('event-string')).toBeUndefined();
    expect(getRequestSignal(123)).toBeUndefined();
  });
});
