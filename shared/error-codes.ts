/**
 * /api/summaryが返すエラーコードunionとUI表示文言マップ。
 *
 * SDKやNuxt内部の生messageをUIに流さず、codeのみ返却する設計に統一する。
 *
 * `shared/` 配下はNuxt 4 の規約でserver / client両方からauto-import / 明示
 * importで参照可能。
 */
export type SummaryErrorCode =
  | 'access_required'
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
  access_required: 'AI要約を生成するにはアクセスキーが必要です。',
  rate_limit: '短時間に多くのリクエストがありました。しばらく時間を置いてから再度お試しください。',
  invalid_input: '入力内容に問題があります。',
  article_not_found: '指定された記事が見つかりません。',
  upstream_unavailable: 'AIサービスとの通信に失敗しました。時間を置いて再度お試しください。',
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
