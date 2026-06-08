/**
 * /api/summaryの入力 / 出力に関する純関数。
 *
 * routeハンドラから切り出して単体テストしやすくする目的。Nuxtの
 * `defineEventHandler` / `#imports` に依存しないためVitestから
 * 直接import可能。
 */
import type { SummaryErrorCode } from '#shared/error-codes';

const MAX_SLUG_LENGTH = 128;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,126}$/;

export type ParseSummaryRequestResult =
  | { ok: true; slug: string }
  | { ok: false; error: SummaryErrorCode };

/**
 * /api/summaryのリクエストボディをruntimeでnarrowする純関数。
 * SSRF / path traversal対策としてslugは英小文字数字ハイフン (先頭は英数字) のみ許可。
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
 * Anthropic messages.createレスポンスの最初のcontent blockからtextを取り出す。
 * type === 'text' && typeof text === 'string' の二段でnarrow、外部API形式
 * 変更にも空文字fallbackで耐える (生first.textへの直接アクセスを避ける)。
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
