/**
 * /api/summary が返すエラーコード union と UI 表示文言マップ。
 *
 * SDK や Nuxt 内部の生 message を UI に流さず、code のみ返却する設計に統一する。
 *
 * `shared/` 配下は Nuxt 4 の規約で server / client 両方から auto-import / 明示
 * import で参照可能。
 */
export type SummaryErrorCode =
  | 'rate_limit'
  | 'invalid_input'
  | 'article_not_found'
  | 'upstream_unavailable'
  | 'server_misconfigured'
  | 'unknown';

export interface SummaryErrorData {
  error: SummaryErrorCode;
  retryAfterSeconds?: number;
}

export const SUMMARY_ERROR_LABELS: Record<SummaryErrorCode, string> = {
  rate_limit: '短時間に多くのリクエストがありました。しばらく時間を置いてから再度お試しください。',
  invalid_input: '入力内容に問題があります。',
  article_not_found: '指定された記事が見つかりません。',
  upstream_unavailable: 'AI サービスとの通信に失敗しました。時間を置いて再度お試しください。',
  server_misconfigured: 'サーバー設定エラーが発生しました。デモ管理者にお問い合わせください。',
  unknown: '予期しないエラーが発生しました。',
};

const KNOWN_CODES = new Set<string>(Object.keys(SUMMARY_ERROR_LABELS));

export function labelForSummaryError(code: string | undefined | null): string {
  if (!code || !KNOWN_CODES.has(code)) {
    return SUMMARY_ERROR_LABELS.unknown;
  }
  return SUMMARY_ERROR_LABELS[code as SummaryErrorCode];
}
