import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetDailyLimitForTesting, checkDailyLimit } from './daily-limit';

describe('checkDailyLimit', () => {
  beforeEach(() => {
    _resetDailyLimitForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetDailyLimitForTesting();
  });

  it('初回リクエストはallowed: trueを返す', () => {
    const result = checkDailyLimit(Date.UTC(2026, 3, 26, 9, 0));
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(199); // DEFAULT 200 - 1
    expect(result.retryAfterSeconds).toBe(0);
  });

  it('上限に達した次のリクエストはallowed: false + retryAfterSeconds > 0', () => {
    vi.stubEnv('NUXT_DAILY_LIMIT', '3');
    const t0 = Date.UTC(2026, 3, 26, 9, 0);
    expect(checkDailyLimit(t0).allowed).toBe(true);
    expect(checkDailyLimit(t0).allowed).toBe(true);
    expect(checkDailyLimit(t0).allowed).toBe(true);
    const blocked = checkDailyLimit(t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('UTC日付が変わるとカウンタがresetされる', () => {
    vi.stubEnv('NUXT_DAILY_LIMIT', '2');
    const day1 = Date.UTC(2026, 3, 26, 23, 30);
    const day2 = Date.UTC(2026, 3, 27, 0, 30);
    expect(checkDailyLimit(day1).allowed).toBe(true);
    expect(checkDailyLimit(day1).allowed).toBe(true);
    expect(checkDailyLimit(day1).allowed).toBe(false);
    // 翌日にreset
    expect(checkDailyLimit(day2).allowed).toBe(true);
  });

  it('NUXT_DAILY_LIMIT環境変数で上限を上書きできる', () => {
    vi.stubEnv('NUXT_DAILY_LIMIT', '5');
    const t0 = Date.UTC(2026, 3, 26, 9, 0);
    for (let i = 0; i < 5; i++) {
      expect(checkDailyLimit(t0).allowed).toBe(true);
    }
    expect(checkDailyLimit(t0).allowed).toBe(false);
  });

  it('NUXT_DAILY_LIMITが不正値ならデフォルト 200 を使う', () => {
    vi.stubEnv('NUXT_DAILY_LIMIT', 'invalid');
    const result = checkDailyLimit(Date.UTC(2026, 3, 26, 9, 0));
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(199);
  });

  it('retryAfterSecondsは最低でも 1 を返す (切り上げ)', () => {
    vi.stubEnv('NUXT_DAILY_LIMIT', '1');
    const justBeforeMidnight = Date.UTC(2026, 3, 26, 23, 59, 59, 999);
    expect(checkDailyLimit(justBeforeMidnight).allowed).toBe(true);
    const blocked = checkDailyLimit(justBeforeMidnight);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
