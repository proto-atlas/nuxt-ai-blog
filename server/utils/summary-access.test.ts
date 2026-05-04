import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import { checkSummaryAccess, SUMMARY_ACCESS_HEADER } from './summary-access';

function makeEvent(): H3Event {
  return { node: { req: {} } } as unknown as H3Event;
}

describe('checkSummaryAccess', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('設定済みキーとヘッダが一致したら許可する', () => {
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn((_event: unknown, name: string) =>
        name === SUMMARY_ACCESS_HEADER ? 'demo-access-key' : undefined,
      ),
    );

    expect(checkSummaryAccess(makeEvent(), 'demo-access-key', 'production')).toEqual({
      allowed: true,
    });
  });

  it('設定済みキーに対してヘッダが無ければ access_required を返す', () => {
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn(() => undefined),
    );

    expect(checkSummaryAccess(makeEvent(), 'demo-access-key', 'production')).toEqual({
      allowed: false,
      error: 'access_required',
    });
  });

  it('長さが違うキーは拒否する', () => {
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn((_event: unknown, name: string) =>
        name === SUMMARY_ACCESS_HEADER ? 'short' : undefined,
      ),
    );

    expect(checkSummaryAccess(makeEvent(), 'demo-access-key', 'production')).toEqual({
      allowed: false,
      error: 'access_required',
    });
  });

  it('productionで設定キーが空なら server_misconfigured を返す', () => {
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn(() => undefined),
    );

    expect(checkSummaryAccess(makeEvent(), '', 'production')).toEqual({
      allowed: false,
      error: 'server_misconfigured',
    });
  });

  it('test環境で設定キーが空ならローカルテスト用に許可する', () => {
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn(() => undefined),
    );

    expect(checkSummaryAccess(makeEvent(), '', 'test')).toEqual({
      allowed: true,
    });
  });
});
