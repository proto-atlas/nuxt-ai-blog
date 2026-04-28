import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './rate-limit';

// 各テストで異なる IP を使い、module-level の buckets が干渉しないようにする。
// 時刻を固定して sliding window の境界を検証する。

describe('checkRateLimit', () => {
  it('初回リクエストは許可され、remainingが9になる', () => {
    const result = checkRateLimit('10.0.0.11', 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it('10回目のリクエストまでは許可される', () => {
    const ip = '10.0.0.12';
    let last;
    for (let i = 0; i < 10; i++) {
      last = checkRateLimit(ip, 1000 + i);
    }
    expect(last?.allowed).toBe(true);
    expect(last?.remaining).toBe(0);
  });

  it('11回目のリクエストはブロックされる', () => {
    const ip = '10.0.0.13';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, 1000 + i);
    }
    const blocked = checkRateLimit(ip, 1000 + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('60秒経過後は古いタイムスタンプが期限切れで、再度許可される', () => {
    const ip = '10.0.0.14';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, 1000);
    }
    const afterWindow = checkRateLimit(ip, 1000 + 60_001);
    expect(afterWindow.allowed).toBe(true);
  });

  it('retryAfterSecondsは最低でも1を返す（切り上げ保証）', () => {
    const ip = '10.0.0.15';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, 1000);
    }
    const blocked = checkRateLimit(ip, 1000 + 59_999);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
