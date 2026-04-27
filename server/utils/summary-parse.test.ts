import { describe, expect, it } from 'vitest';
import { extractFirstText, parseSummaryRequest } from './summary-parse';

describe('parseSummaryRequest', () => {
  it('正常な slug を ok: true で返す', () => {
    const result = parseSummaryRequest({ slug: 'sample-article' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slug).toBe('sample-article');
  });

  it('前後空白を trim する', () => {
    const result = parseSummaryRequest({ slug: '  sample-article  ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slug).toBe('sample-article');
  });

  it('null は invalid_input', () => {
    expect(parseSummaryRequest(null)).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('object 以外 (string / number / array) は invalid_input', () => {
    expect(parseSummaryRequest('string')).toEqual({ ok: false, error: 'invalid_input' });
    expect(parseSummaryRequest(123)).toEqual({ ok: false, error: 'invalid_input' });
    // 配列は object なのでフォーマット的には通るが、slug が string でない => invalid_input
    expect(parseSummaryRequest([])).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('slug が文字列でないなら invalid_input', () => {
    expect(parseSummaryRequest({ slug: 123 })).toEqual({ ok: false, error: 'invalid_input' });
    expect(parseSummaryRequest({ slug: null })).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('空文字 / 空白のみは invalid_input', () => {
    expect(parseSummaryRequest({ slug: '' })).toEqual({ ok: false, error: 'invalid_input' });
    expect(parseSummaryRequest({ slug: '   ' })).toEqual({ ok: false, error: 'invalid_input' });
  });

  it('SLUG_PATTERN を満たさない slug は invalid_input (path traversal 対策)', () => {
    expect(parseSummaryRequest({ slug: '../../etc/passwd' })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(parseSummaryRequest({ slug: 'has space' })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(parseSummaryRequest({ slug: 'UPPER-CASE' })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(parseSummaryRequest({ slug: '-starts-with-hyphen' })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('128 文字超は invalid_input', () => {
    const tooLong = 'a' + 'b'.repeat(128); // 129 文字
    expect(parseSummaryRequest({ slug: tooLong })).toEqual({
      ok: false,
      error: 'invalid_input',
    });
  });

  it('上限 127 文字は ok (先頭 a + b*126 = 127 文字)', () => {
    const justUnder = 'a' + 'b'.repeat(126); // 127 文字
    const result = parseSummaryRequest({ slug: justUnder });
    expect(result.ok).toBe(true);
  });

  it('英小文字数字ハイフンの組み合わせは ok', () => {
    expect(parseSummaryRequest({ slug: 'a-b-c' }).ok).toBe(true);
    expect(parseSummaryRequest({ slug: '0123456789' }).ok).toBe(true);
    expect(parseSummaryRequest({ slug: 'abc123' }).ok).toBe(true);
  });
});

describe('extractFirstText', () => {
  it('正常な TextBlock から text を取り出す', () => {
    expect(extractFirstText([{ type: 'text', text: 'Hello' }])).toBe('Hello');
  });

  it('content が配列でないなら空文字', () => {
    expect(extractFirstText(null)).toBe('');
    expect(extractFirstText(undefined)).toBe('');
    expect(extractFirstText('string')).toBe('');
    expect(extractFirstText({ type: 'text', text: 'foo' })).toBe('');
  });

  it('content が空配列なら空文字', () => {
    expect(extractFirstText([])).toBe('');
  });

  it('first.type が text 以外なら空文字 (画像 / tool_use 等)', () => {
    expect(extractFirstText([{ type: 'image', source: 'data:...' }])).toBe('');
    expect(extractFirstText([{ type: 'tool_use', name: 'foo' }])).toBe('');
  });

  it('first.text が文字列でないなら空文字 (null / number / 欠落)', () => {
    expect(extractFirstText([{ type: 'text', text: null }])).toBe('');
    expect(extractFirstText([{ type: 'text', text: 123 }])).toBe('');
    expect(extractFirstText([{ type: 'text' }])).toBe('');
  });

  it('複数 content block があっても最初のみを見る', () => {
    expect(
      extractFirstText([
        { type: 'text', text: 'First' },
        { type: 'text', text: 'Second' },
      ]),
    ).toBe('First');
  });
});
