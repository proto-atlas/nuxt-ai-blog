/**
 * /api/summary の入力 / 出力に関する純関数。
 *
 * route ハンドラから切り出して単体テストしやすくする目的。Nuxt の
 * `defineEventHandler` / `#imports` に依存しないため Vitest から
 * 直接 import 可能。
 */
import type { SummaryErrorCode } from '#shared/error-codes';

const MAX_SLUG_LENGTH = 128;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,126}$/;

export type ParseSummaryRequestResult =
  | { ok: true; slug: string }
  | { ok: false; error: SummaryErrorCode };

/**
 * /api/summary のリクエストボディを runtime で narrow する純関数。
 * SSRF / path traversal 対策として slug は英小文字数字ハイフン (先頭は英数字) のみ許可。
 */
export function parseSummaryRequest(input: unknown): ParseSummaryRequestResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'invalid_input' };
  }
  const obj = input as Record<string, unknown>;
  const slug = typeof obj.slug === 'string' ? obj.slug.trim() : '';
  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: 'invalid_input' };
  }
  return { ok: true, slug };
}

/**
 * Anthropic messages.create レスポンスの最初の content block から text を取り出す。
 * type === 'text' && typeof text === 'string' の二段で narrow、外部 API 形式
 * 変更にも空文字 fallback で耐える (生 first.text への直接アクセスを避ける)。
 */
export function extractFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return '';
  const first = content[0] as { type?: unknown; text?: unknown } | undefined;
  if (!first || first.type !== 'text' || typeof first.text !== 'string') return '';
  return first.text;
}

export const SUMMARY_PARSE_LIMITS = {
  MAX_SLUG_LENGTH,
  SLUG_PATTERN,
};
