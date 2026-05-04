import type {
  DailyGenerationMarkInput,
  DailyGenerationReserveInput,
  DailyGenerationReserveResult,
  SummaryCacheClaimInput,
  SummaryCacheClaimResult,
  SummaryCacheInspectInput,
  SummaryCacheInspectResult,
  SummaryCachePayload,
  SummaryCacheReleaseInput,
  SummaryCacheStoreInput,
  SummaryCacheWaitInput,
  SummaryCacheWaitResult,
} from './summary-control-types';

interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

interface StoredSummary {
  value: SummaryCachePayload;
  expiresAt: number;
}

interface StoredPending {
  expiresAt: number;
}

interface StoredQuota {
  reserved: number;
  succeeded: number;
  failedAfterUpstreamCall: number;
}

interface PendingSignal {
  promise: Promise<void>;
  resolve: () => void;
}

const MS_PER_DAY = 86_400_000;
const MIN_RETRY_AFTER_SECONDS = 1;

function cacheStorageKey(cacheKey: string): string {
  return `summary-cache:${cacheKey}`;
}

function pendingStorageKey(cacheKey: string): string {
  return `summary-pending:${cacheKey}`;
}

function quotaStorageKey(date: string): string {
  return `summary-quota:${date}`;
}

function secondsUntilNextUtcDay(date: string, now: number): number {
  const tomorrowMs = new Date(`${date}T00:00:00Z`).getTime() + MS_PER_DAY;
  return Math.max(MIN_RETRY_AFTER_SECONDS, Math.ceil((tomorrowMs - now) / 1000));
}

function secondsUntil(expiresAt: number, now: number): number {
  return Math.max(MIN_RETRY_AFTER_SECONDS, Math.ceil((expiresAt - now) / 1000));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * AI 要約の cache と in-flight 状態を Durable Object Storage に保存する。
 *
 * in-memory の pending signal は同一 Object lifetime 内の待機効率化だけに使い、
 * eviction / restart 後も判断できる pending marker と summary は storage 側に置く。
 */
export class SummaryCacheDO {
  private readonly pendingSignals = new Map<string, PendingSignal>();

  constructor(private readonly ctx: DurableObjectStateLike) {}

  async inspect(input: SummaryCacheInspectInput): Promise<SummaryCacheInspectResult> {
    const cached = await this.getFreshSummary(input.cacheKey, input.now);
    if (cached) return { status: 'hit', value: cached };

    const pending = await this.getFreshPending(input.cacheKey, input.now);
    if (pending) {
      return {
        status: 'pending',
        retryAfterSeconds: secondsUntil(pending.expiresAt, input.now),
      };
    }

    return { status: 'miss' };
  }

  async claim(input: SummaryCacheClaimInput): Promise<SummaryCacheClaimResult> {
    // 同時 request が先に cache を埋めた可能性があるため、claim 直前にも再確認する。
    const inspected = await this.inspect(input);
    if (inspected.status !== 'miss') return inspected;

    await this.ctx.storage.put<StoredPending>(pendingStorageKey(input.cacheKey), {
      expiresAt: input.now + input.pendingTtlMs,
    });
    this.getOrCreatePendingSignal(input.cacheKey);
    return { status: 'claimed' };
  }

  async wait(input: SummaryCacheWaitInput): Promise<SummaryCacheWaitResult> {
    const cached = await this.getFreshSummary(input.cacheKey, input.now);
    if (cached) return { status: 'hit', value: cached };

    const pending = await this.getFreshPending(input.cacheKey, input.now);
    if (!pending) return { status: 'timeout' };

    const signal = this.getOrCreatePendingSignal(input.cacheKey);
    const waitMs = Math.max(0, Math.min(input.maxWaitMs, pending.expiresAt - input.now));
    await Promise.race([signal.promise, sleep(waitMs)]);

    const afterWait = await this.getFreshSummary(input.cacheKey, Date.now());
    if (afterWait) return { status: 'hit', value: afterWait };
    return { status: 'timeout' };
  }

  async store(input: SummaryCacheStoreInput): Promise<void> {
    await this.ctx.storage.put<StoredSummary>(cacheStorageKey(input.cacheKey), {
      value: input.value,
      expiresAt: input.now + input.ttlMs,
    });
    await this.release({ cacheKey: input.cacheKey });
  }

  async release(input: SummaryCacheReleaseInput): Promise<void> {
    await this.ctx.storage.delete(pendingStorageKey(input.cacheKey));
    const signal = this.pendingSignals.get(input.cacheKey);
    if (signal) {
      signal.resolve();
      this.pendingSignals.delete(input.cacheKey);
    }
  }

  private getOrCreatePendingSignal(cacheKey: string): PendingSignal {
    const existing = this.pendingSignals.get(cacheKey);
    if (existing) return existing;

    let resolveSignal: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
      resolveSignal = resolve;
    });
    const signal: PendingSignal = { promise, resolve: resolveSignal };
    this.pendingSignals.set(cacheKey, signal);
    return signal;
  }

  private async getFreshSummary(
    cacheKey: string,
    now: number,
  ): Promise<SummaryCachePayload | null> {
    const entry = await this.ctx.storage.get<StoredSummary>(cacheStorageKey(cacheKey));
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      await this.ctx.storage.delete(cacheStorageKey(cacheKey));
      return null;
    }
    return entry.value;
  }

  private async getFreshPending(cacheKey: string, now: number): Promise<StoredPending | null> {
    const entry = await this.ctx.storage.get<StoredPending>(pendingStorageKey(cacheKey));
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      await this.ctx.storage.delete(pendingStorageKey(cacheKey));
      this.pendingSignals.delete(cacheKey);
      return null;
    }
    return entry;
  }
}

/**
 * 日次 live AI 生成 quota を固定名 Durable Object に集約する。
 *
 * quota は「live AI API call を開始する権利」として reserve するため、
 * upstream call 開始後の失敗も cost exposure として reserved count に含める。
 */
export class GlobalSummaryQuotaDO {
  constructor(private readonly ctx: DurableObjectStateLike) {}

  async reserveDailyGeneration(
    input: DailyGenerationReserveInput,
  ): Promise<DailyGenerationReserveResult> {
    const key = quotaStorageKey(input.date);
    const current = (await this.ctx.storage.get<StoredQuota>(key)) ?? {
      reserved: 0,
      succeeded: 0,
      failedAfterUpstreamCall: 0,
    };

    if (current.reserved >= input.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: secondsUntilNextUtcDay(input.date, input.now),
      };
    }

    const next: StoredQuota = {
      ...current,
      reserved: current.reserved + 1,
    };
    await this.ctx.storage.put<StoredQuota>(key, next);
    return { allowed: true, remaining: input.limit - next.reserved };
  }

  async markGenerationSucceeded(input: DailyGenerationMarkInput): Promise<void> {
    await this.updateQuota(input.date, (current) => ({
      ...current,
      succeeded: current.succeeded + 1,
    }));
  }

  async markGenerationFailedAfterUpstreamCall(input: DailyGenerationMarkInput): Promise<void> {
    await this.updateQuota(input.date, (current) => ({
      ...current,
      failedAfterUpstreamCall: current.failedAfterUpstreamCall + 1,
    }));
  }

  private async updateQuota(
    date: string,
    update: (current: StoredQuota) => StoredQuota,
  ): Promise<void> {
    const key = quotaStorageKey(date);
    const current = (await this.ctx.storage.get<StoredQuota>(key)) ?? {
      reserved: 0,
      succeeded: 0,
      failedAfterUpstreamCall: 0,
    };
    await this.ctx.storage.put<StoredQuota>(key, update(current));
  }
}
