/**
 * Nuxt Content 3 のMDC ASTから平文テキストを抽出する純関数群。
 *
 * title / descriptionだけでなく本文も要約対象に含めるため、Markdown ASTを
 * 再帰走査してtext nodeのvalueだけを連結する。
 *
 * MDC ASTのおおまかな形 (Nuxt Content 3):
 * { type: 'root', children: [
 * { type: 'element', tag: 'p', children: [
 * { type: 'text', value: '...' },
 * ] },
 * ...
 * ] }
 *
 * 信用しすぎないため、未知shapeは空文字fallbackで吸収する。
 */

const MAX_BODY_TEXT_LENGTH = 4000;

/**
 * MDC AST nodeを再帰的に走査し、text nodeのvalueを連結して返す。
 * 未知のtype / 形 は無視する (型ガード)。
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
 * title + description + 本文ASTのtext nodeを連結し、長すぎる場合は
 * MAX_BODY_TEXT_LENGTHでtruncateする (Anthropic入力token増加抑止)。
 *
 * body抽出に失敗した場合はtitle + descriptionのみでfallback (要約は
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
