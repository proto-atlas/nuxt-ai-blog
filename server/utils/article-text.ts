/**
 * Nuxt Content 3 の MDC AST から平文テキストを抽出する純関数群。
 *
 * title / description だけでなく本文も要約対象に含めるため、Markdown AST を
 * 再帰走査して text node の value だけを連結する。
 *
 * MDC AST のおおまかな形 (Nuxt Content 3):
 * { type: 'root', children: [
 * { type: 'element', tag: 'p', children: [
 * { type: 'text', value: '...' },
 * ] },
 * ...
 * ] }
 *
 * 信用しすぎないため、未知 shape は空文字 fallback で吸収する。
 */

const MAX_BODY_TEXT_LENGTH = 4000;

/**
 * MDC AST node を再帰的に走査し、text node の value を連結して返す。
 * 未知の type / 形 は無視する (型ガード)。
 */
export function extractMdcText(node: unknown): string {
  if (node === null || typeof node !== 'object') return '';
  const obj = node as Record<string, unknown>;
  if (obj.type === 'text' && typeof obj.value === 'string') {
    return obj.value;
  }
  const children = obj.children;
  if (Array.isArray(children)) {
    return children.map((child) => extractMdcText(child)).join('');
  }
  return '';
}

/**
 * 要約元テキストを組み立てる。
 * title + description + 本文 AST の text node を連結し、長すぎる場合は
 * MAX_BODY_TEXT_LENGTH で truncate する (Anthropic 入力 token 増加抑止)。
 *
 * body 抽出に失敗した場合は title + description のみで fallback (要約は
 * 引き続き生成可能)。
 */
export function buildSummarySource(article: {
  title?: unknown;
  description?: unknown;
  body?: unknown;
}): string {
  const title = typeof article.title === 'string' ? article.title : '';
  const description = typeof article.description === 'string' ? article.description : '';
  const rawBodyText = extractMdcText(article.body).trim().replace(/\s+/g, ' ');
  const bodyText =
    rawBodyText.length > MAX_BODY_TEXT_LENGTH
      ? rawBodyText.slice(0, MAX_BODY_TEXT_LENGTH)
      : rawBodyText;
  return [title, description, bodyText].filter((s) => s.length > 0).join('\n\n');
}

export const ARTICLE_TEXT_LIMITS = {
  MAX_BODY_TEXT_LENGTH,
};
