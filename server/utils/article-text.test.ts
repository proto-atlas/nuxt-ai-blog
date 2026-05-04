import { describe, expect, it } from 'vitest';
import { ARTICLE_TEXT_LIMITS, buildSummarySource, extractMdcText } from './article-text';

describe('extractMdcText', () => {
  it('text node の value を返す', () => {
    expect(extractMdcText({ type: 'text', value: 'Hello' })).toBe('Hello');
  });

  it('children を再帰的に連結する', () => {
    const ast = {
      type: 'root',
      children: [
        { type: 'element', tag: 'p', children: [{ type: 'text', value: '一段落目。' }] },
        {
          type: 'element',
          tag: 'p',
          children: [
            { type: 'text', value: '二段落目の前半 ' },
            { type: 'element', tag: 'strong', children: [{ type: 'text', value: '強調' }] },
            { type: 'text', value: ' を含む後半。' },
          ],
        },
      ],
    };
    expect(extractMdcText(ast)).toBe('一段落目。二段落目の前半 強調 を含む後半。');
  });

  it('null / undefined / 非オブジェクトは空文字を返す', () => {
    expect(extractMdcText(null)).toBe('');
    expect(extractMdcText(undefined)).toBe('');
    expect(extractMdcText('string')).toBe('');
    expect(extractMdcText(123)).toBe('');
  });

  it('text node でも value が文字列でなければ空文字', () => {
    expect(extractMdcText({ type: 'text', value: null })).toBe('');
    expect(extractMdcText({ type: 'text', value: 123 })).toBe('');
  });

  it('children が配列でなければ空文字 (型ガード)', () => {
    expect(extractMdcText({ type: 'element', children: 'not array' })).toBe('');
    expect(extractMdcText({ type: 'element', children: { not: 'array' } })).toBe('');
  });

  it('未知 type の element でも children を走査する', () => {
    const ast = {
      type: 'unknown-tag',
      children: [{ type: 'text', value: 'recoverable' }],
    };
    expect(extractMdcText(ast)).toBe('recoverable');
  });
});

describe('buildSummarySource', () => {
  it('title + description + body の text node を改行で結合する', () => {
    const article = {
      title: 'タイトル',
      description: '概要文',
      body: {
        type: 'root',
        children: [
          { type: 'element', tag: 'p', children: [{ type: 'text', value: '本文の段落。' }] },
        ],
      },
    };
    expect(buildSummarySource(article)).toBe('タイトル\n\n概要文\n\n本文の段落。');
  });

  it('body が AST でなくても title + description で要約源を作れる (fallback)', () => {
    const article = { title: 'タイトル', description: '概要文', body: null };
    expect(buildSummarySource(article)).toBe('タイトル\n\n概要文');
  });

  it('title が空でも description + body だけで作れる', () => {
    const article = {
      title: '',
      description: '概要文',
      body: { type: 'text', value: '本文' },
    };
    expect(buildSummarySource(article)).toBe('概要文\n\n本文');
  });

  it('全フィールドが空なら空文字を返す', () => {
    expect(buildSummarySource({})).toBe('');
    expect(buildSummarySource({ title: null, description: undefined, body: 123 })).toBe('');
  });

  it('連続する空白 / 改行は単一スペースに正規化する', () => {
    const article = {
      title: 'T',
      description: 'D',
      body: {
        type: 'root',
        children: [
          { type: 'text', value: '   abc\n\n  def\t\tghi   ' },
          { type: 'text', value: '\njkl' },
        ],
      },
    };
    expect(buildSummarySource(article)).toBe('T\n\nD\n\nabc def ghi jkl');
  });

  it('本文が MAX_BODY_TEXT_LENGTH を超えたら truncate する', () => {
    const longText = 'a'.repeat(ARTICLE_TEXT_LIMITS.MAX_BODY_TEXT_LENGTH + 100);
    const article = {
      title: 'T',
      description: 'D',
      body: { type: 'text', value: longText },
    };
    const result = buildSummarySource(article);
    // T (1) + \n\n (2) + D (1) + \n\n (2) + body (4000 切り詰め) = 4006
    expect(result.length).toBe(1 + 2 + 1 + 2 + ARTICLE_TEXT_LIMITS.MAX_BODY_TEXT_LENGTH);
  });

  it('description のみ / body のみでも動く', () => {
    expect(buildSummarySource({ description: 'only desc' })).toBe('only desc');
    expect(buildSummarySource({ body: { type: 'text', value: 'only body' } })).toBe('only body');
  });
});
