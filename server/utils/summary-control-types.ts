export interface SummaryCachePayload {
  slug: string;
  summary: string;
  model: string;
  generatedAt: string;
}

export interface SummaryCacheInspectInput {
  cacheKey: string;
  now: number;
}

export type SummaryCacheInspectResult =
  | { status: 'hit'; value: SummaryCachePayload }
  | { status: 'pending'; retryAfterSeconds: number }
  | { status: 'miss' };

export interface SummaryCacheClaimInput {
  cacheKey: string;
  now: number;
  pendingTtlMs: number;
}

export type SummaryCacheClaimResult =
  | { status: 'hit'; value: SummaryCachePayload }
  | { status: 'pending'; retryAfterSeconds: number }
  | { status: 'claimed' };

export interface SummaryCacheWaitInput {
  cacheKey: string;
  now: number;
  maxWaitMs: number;
}

export type SummaryCacheWaitResult =
  | { status: 'hit'; value: SummaryCachePayload }
  | { status: 'timeout' };

export interface SummaryCacheStoreInput {
  cacheKey: string;
  value: SummaryCachePayload;
  now: number;
  ttlMs: number;
}

export interface SummaryCacheReleaseInput {
  cacheKey: string;
}

export interface DailyGenerationReserveInput {
  date: string;
  limit: number;
  now: number;
}

export type DailyGenerationReserveResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterSeconds: number };

export interface DailyGenerationMarkInput {
  date: string;
}

export interface SummaryCacheStub {
  inspect(input: SummaryCacheInspectInput): Promise<SummaryCacheInspectResult>;
  claim(input: SummaryCacheClaimInput): Promise<SummaryCacheClaimResult>;
  wait(input: SummaryCacheWaitInput): Promise<SummaryCacheWaitResult>;
  store(input: SummaryCacheStoreInput): Promise<void>;
  release(input: SummaryCacheReleaseInput): Promise<void>;
}

export interface SummaryQuotaStub {
  reserveDailyGeneration(input: DailyGenerationReserveInput): Promise<DailyGenerationReserveResult>;
  markGenerationSucceeded(input: DailyGenerationMarkInput): Promise<void>;
  markGenerationFailedAfterUpstreamCall(input: DailyGenerationMarkInput): Promise<void>;
}

export interface DurableObjectIdLike {
  readonly name?: string;
}

export interface DurableObjectNamespaceLike<TStub> {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): TStub;
}
