/**
 * Global daily API call limit (in-memory, per-isolate).
 *
 * 公開 AI API (`/api/summary`) のコスト保護として、IP に依存しない全体の日次上限を
 * 設ける。デモの UX 摩擦を抑えながら過剰利用を止めるため、global daily limit を
 * 採用する。
 *
 * 既存の per-IP sliding window (`rate-limit.ts`、10 req/60s) と組み合わせて多層防御:
 * 1. per-IP で 1 ユーザーの連投を抑制
 * 2. global daily limit で IP rotation 攻撃や全体消費を抑制
 * 3. Anthropic Spend Limit ($5〜$10/月) を最終防衛
 *
 * 本番スケール時の制約:
 * - in-memory なので Cloudflare Workers の複数 isolate 環境では isolate 単位で
 * カウンタが独立する (最悪 N × DAILY_LIMIT まで通る)
 * - 本格運用では Cloudflare Rate Limiting binding (env.RATE_LIMITER.limit({ key }))
 * または Durable Objects で全 isolate を跨いでカウンタを共有することを推奨
 * (README "Dependencies and Known Constraints" に明示)
 */

// 1 日あたりの /api/summary 全体上限。
// 算出根拠: Anthropic Haiku 4.5 の入力 ~150 字 + 出力 ~150 字を 1 リクエストとすると
// $0.0008 前後 (実測平均)。月間予算 $5 以内に収めるため 200 req/日 × 30 日 ≈ $4.8。
// 上限は環境変数 NUXT_DAILY_LIMIT で上書き可能 (本番運用で必要なら拡張)。
const DEFAULT_DAILY_LIMIT = 200;
const MS_PER_DAY = 86_400_000;

interface DailyBucket {
  date: string; // 'YYYY-MM-DD' (UTC)
  count: number;
}

let bucket: DailyBucket = { date: '', count: 0 };

export interface DailyLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function getUtcDateString(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function getDailyLimit(): number {
  const env = process.env.NUXT_DAILY_LIMIT;
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_DAILY_LIMIT;
}

export function checkDailyLimit(now: number = Date.now()): DailyLimitResult {
  const today = getUtcDateString(now);
  const limit = getDailyLimit();

  if (bucket.date !== today) {
    // 日付変わったら reset (UTC 0:00 切替)
    bucket = { date: today, count: 0 };
  }

  if (bucket.count >= limit) {
    // 翌 0:00 UTC までの残り秒数
    const tomorrowMs = new Date(`${today}T00:00:00Z`).getTime() + MS_PER_DAY;
    const retryAfterSeconds = Math.max(1, Math.ceil((tomorrowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** テスト専用: bucket をリセットして isolate 状態を初期化する */
export function _resetDailyLimitForTesting(): void {
  bucket = { date: '', count: 0 };
}
