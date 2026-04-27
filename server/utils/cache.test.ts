import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheGet, cacheSet } from './cache';

describe('cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cacheSet で保存した値を cacheGet で取り出せる', () => {
    cacheSet('k1', { id: 1, name: 'foo' }, 1000);
    expect(cacheGet<{ id: number; name: string }>('k1')).toEqual({ id: 1, name: 'foo' });
  });

  it('存在しないキーは null を返す', () => {
    expect(cacheGet('nonexistent-key')).toBeNull();
  });

  it('TTL 経過後は null を返す', () => {
    cacheSet('k2', 'value', 1000);
    vi.advanceTimersByTime(1001);
    expect(cacheGet('k2')).toBeNull();
  });

  it('TTL 内なら値を返す', () => {
    cacheSet('k3', 'value', 1000);
    vi.advanceTimersByTime(999);
    expect(cacheGet('k3')).toBe('value');
  });

  it('同じキーで cacheSet すると上書きされる', () => {
    cacheSet('k4', 'first', 1000);
    cacheSet('k4', 'second', 1000);
    expect(cacheGet('k4')).toBe('second');
  });
});
