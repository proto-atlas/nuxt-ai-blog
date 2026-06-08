import { cacheGet, cacheSet } from './cache';
import { checkDailyLimit, getDailyLimit } from './daily-limit';
import { getCloudflareEnv } from './cloudflare-env';
import type {
  DailyGenerationReserveResult,
  SummaryCacheClaimResult,
  SummaryCacheInspectResult,
  SummaryCachePayload,
  SummaryCacheStub,
  SummaryCacheWaitResult,
  SummaryQuotaStub,
} from './summary-control-types';

const CACHE_KEY_VERSION = 'v1';
const ARTICLE_HASH_ALGORITHM = 'SHA-256';
const QUOTA_OBJECT_NAME = 'summary-global-quota-v1';
const CACHE_OBJECT_NAME = 'summary-cache-v1';
const HEX_BYTE_PAD = 2;
const UTC_DATE_LENGTH = 10;
const MS_PER_DAY = 86_400_000;

interface MemoryPending {
  expiresAt: number;
  promise: Promise<void>;
  resolve: () => void;
}

const memoryPending = new Map<string, MemoryPending>();

export interface SummaryControl {
  kind: 'durable' | 'memory';
  quota?: SummaryQuotaStub;
  cache?: SummaryCacheStub;
}

export interface SummaryControlResolution {
  control: SummaryControl;
  missingBindings: string[];
}

export interface SummaryCacheKeyInput {
  slug: string;
  model: string;
  sourceText: string;
}

export async function buildSummaryCacheKey(input: SummaryCacheKeyInput): Promise<string> {
  const articleHash = await sha256Hex(input.sourceText);
  return `summary:${CACHE_KEY_VERSION}:${input.model}:${input.slug}:${articleHash}`;
}

export function resolveSummaryControl(event: unknown): SummaryControlResolution {
  const env = getCloudflareEnv(event);
  const missingBindings: string[] = [];
  if (!env.SUMMARY_QUOTA) missingBindings.push('SUMMARY_QUOTA');
  if (!env.SUMMARY_CACHE) missingBindings.push('SUMMARY_CACHE');

  if (env.SUMMARY_QUOTA && env.SUMMARY_CACHE) {
    return {
      control: {
        kind: 'durable',
        quota: env.SUMMARY_QUOTA.get(env.SUMMARY_QUOTA.idFromName(QUOTA_OBJECT_NAME)),
        cache: env.SUMMARY_CACHE.get(env.SUMMARY_CACHE.idFromName(CACHE_OBJECT_NAME)),
      },
      missingBindings: [],
    };
  }

  return { control: { kind: 'memory' }, missingBindings };
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function inspectSummaryCache(
  control: SummaryControl,
  cacheKey: string,
  now: number = Date.now(),
): Promise<SummaryCacheInspectResult> {
  if (control.kind === 'durable' && control.cache) {
    return control.cache.inspect({ cacheKey, now });
  }

  const cached = cacheGet<SummaryCachePayload>(cacheKey);
  if (cached) return { status: 'hit', value: cached };

  const pending = getFreshMemoryPending(cacheKey, now);
  if (pending) {
    return {
      status: 'pending',
      retryAfterSeconds: secondsUntil(pending.expiresAt, now),
    };
  }
  return { status: 'miss' };
}

export async function claimSummaryGeneration(
  control: SummaryControl,
  cacheKey: string,
  pendingTtlMs: number,
  now: number = Date.now(),
): Promise<SummaryCacheClaimResult> {
  if (control.kind === 'durable' && control.cache) {
    return control.cache.claim({ cacheKey, now, pendingTtlMs });
  }

  const inspected = await inspectSummaryCache(control, cacheKey, now);
  if (inspected.status !== 'miss') return inspected;

  memoryPending.set(cacheKey, createMemoryPending(now + pendingTtlMs));
  return { status: 'claimed' };
}

export async function waitForPendingSummary(
  control: SummaryControl,
  cacheKey: string,
  maxWaitMs: number,
  now: number = Date.now(),
): Promise<SummaryCacheWaitResult> {
  if (control.kind === 'durable' && control.cache) {
    return control.cache.wait({ cacheKey, now, maxWaitMs });
  }

  const cached = cacheGet<SummaryCachePayload>(cacheKey);
  if (cached) return { status: 'hit', value: cached };

  const pending = getFreshMemoryPending(cacheKey, now);
  if (!pending) return { status: 'timeout' };

  const waitMs = Math.max(0, Math.min(maxWaitMs, pending.expiresAt - now));
  await Promise.race([pending.promise, sleep(waitMs)]);
  const afterWait = cacheGet<SummaryCachePayload>(cacheKey);
  if (afterWait) return { status: 'hit', value: afterWait };
  return { status: 'timeout' };
}

export async function reserveDailyGeneration(
  control: SummaryControl,
  now: number = Date.now(),
): Promise<DailyGenerationReserveResult> {
  if (control.kind === 'durable' && control.quota) {
    return control.quota.reserveDailyGeneration({
      date: getUtcDateString(now),
      limit: getDailyLimit(),
      now,
    });
  }

  const result = checkDailyLimit(now);
  if (result.allowed) {
    return { allowed: true, remaining: result.remaining };
  }
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

export async function storeSummaryCache(
  control: SummaryControl,
  cacheKey: string,
  value: SummaryCachePayload,
  ttlMs: number,
  now: number = Date.now(),
): Promise<void> {
  if (control.kind === 'durable' && control.cache) {
    await control.cache.store({ cacheKey, value, ttlMs, now });
    return;
  }

  cacheSet(cacheKey, value, ttlMs);
  releaseMemoryPending(cacheKey);
}

export async function releaseSummaryClaim(
  control: SummaryControl,
  cacheKey: string,
): Promise<void> {
  if (control.kind === 'durable' && control.cache) {
    await control.cache.release({ cacheKey });
    return;
  }

  releaseMemoryPending(cacheKey);
}

export async function markGenerationSucceeded(
  control: SummaryControl,
  now: number = Date.now(),
): Promise<void> {
  if (control.kind === 'durable' && control.quota) {
    await control.quota.markGenerationSucceeded({ date: getUtcDateString(now) });
  }
}

export async function markGenerationFailedAfterUpstreamCall(
  control: SummaryControl,
  now: number = Date.now(),
): Promise<void> {
  if (control.kind === 'durable' && control.quota) {
    await control.quota.markGenerationFailedAfterUpstreamCall({ date: getUtcDateString(now) });
  }
}

export function getUtcDateString(now: number): string {
  return new Date(now).toISOString().slice(0, UTC_DATE_LENGTH);
}

export function secondsUntilNextUtcDay(date: string, now: number): number {
  const tomorrowMs = new Date(`${date}T00:00:00Z`).getTime() + MS_PER_DAY;
  return Math.max(1, Math.ceil((tomorrowMs - now) / 1000));
}

export function _resetSummaryControlMemoryForTesting(): void {
  for (const pending of memoryPending.values()) pending.resolve();
  memoryPending.clear();
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest(ARTICLE_HASH_ALGORITHM, bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(HEX_BYTE_PAD, '0'))
    .join('');
}

function getFreshMemoryPending(cacheKey: string, now: number): MemoryPending | null {
  const pending = memoryPending.get(cacheKey);
  if (!pending) return null;
  if (pending.expiresAt <= now) {
    releaseMemoryPending(cacheKey);
    return null;
  }
  return pending;
}

function createMemoryPending(expiresAt: number): MemoryPending {
  let resolveSignal: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolveSignal = resolve;
  });
  return { expiresAt, promise, resolve: resolveSignal };
}

function releaseMemoryPending(cacheKey: string): void {
  const pending = memoryPending.get(cacheKey);
  if (pending) pending.resolve();
  memoryPending.delete(cacheKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function secondsUntil(expiresAt: number, now: number): number {
  return Math.max(1, Math.ceil((expiresAt - now) / 1000));
}
