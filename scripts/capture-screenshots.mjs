#!/usr/bin/env node
// @ts-check
/**
 * README 用スクリーンショット自動取得スクリプト。
 *
 * 使い方 (Windows / macOS / Linux 共通):
 * 1. 別ターミナルで `npm run dev` を起動 (http://localhost:3000)
 * 2. このスクリプトを実行: `node scripts/capture-screenshots.mjs`
 * 3. `docs/screenshots/{pc,sp}-{index,detail,summary,dark}.png` の 8 枚が生成される
 *
 * 環境変数:
 * BASE_URL: ターゲット URL (default http://localhost:3000)。本番 URL を指定すれば
 * 本番から撮ることも可能。
 *
 * 実装方針:
 * - Playwright の Programmatic API (`@playwright/test` の chromium) を使う
 * - dev server の起動は別管理 (本スクリプトは spawn せず、connect のみ)
 * - AI 要約成功シーンは page.route('**\/api/summary') で 200 mock。
 * 実 Anthropic API への課金を発生させない (e2e/ai-summary.spec.ts と同じパターン)
 * - PC viewport: 1280x800、SP viewport: 375x812 (iPhone 15 相当)
 * - 撮影前に networkidle まで待つ (ハイドレーション完了 + sqlite-wasm load 後)
 *
 * dev server (native sqlite) と production URL のどちらにも対応する。
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const VIEWPORTS = /** @type {const} */ ({
  pc: { width: 1280, height: 800 },
  sp: { width: 375, height: 812 },
});

const ARTICLE_PATH = '/blog/eslint-10-flat-config-practical';

/** AI 要約 API mock body (e2e/ai-summary.spec.ts の成功フローと同じ shape) */
const SUMMARY_MOCK_BODY = JSON.stringify({
  slug: 'eslint-10-flat-config-practical',
  summary:
    'ESLint 10 の flat config は外部 plugin の typegen と Prettier 干渉に注意。配列 + spread 構成で .eslintrc から段階移行できる。',
  model: 'claude-haiku-4-5-20251001',
  cached: false,
  generatedAt: new Date().toISOString(),
});

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();

  for (const [vpKey, viewport] of /** @type {[keyof typeof VIEWPORTS, typeof VIEWPORTS.pc][]} */ (
    Object.entries(VIEWPORTS)
  )) {
    const context = await browser.newContext({
      viewport,
      colorScheme: 'light',
      // motion-reduced: 撮影時の transition によるブレを抑止
      reducedMotion: 'reduce',
    });

    // AI 要約 API は実 Anthropic 呼び出しを避けるため常時 mock
    await context.route('**/api/summary', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: SUMMARY_MOCK_BODY,
      }),
    );

    const page = await context.newPage();

    // 1. 一覧
    // dev server (Vite HMR) では networkidle が来ないことがあるため domcontentloaded で commit して
    // 主要 heading の visible で安定化する。
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: '記事一覧' }).waitFor({ state: 'visible' });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${vpKey}-index.png`),
      fullPage: true,
    });
    console.log(`[capture] ${vpKey}-index.png`);

    // 2. 記事詳細
    await page.goto(`${BASE_URL}${ARTICLE_PATH}`, { waitUntil: 'domcontentloaded' });
    await page
      .getByRole('heading', { level: 1, name: 'ESLint 10 flat config の実務設定' })
      .waitFor({ state: 'visible' });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${vpKey}-detail.png`),
      fullPage: true,
    });
    console.log(`[capture] ${vpKey}-detail.png`);

    // 3. AI 要約結果 (button click → mock 200 → 結果表示)
    await page.goto(`${BASE_URL}${ARTICLE_PATH}`, { waitUntil: 'domcontentloaded' });
    // Vite HMR の WebSocket で networkidle が常時こないので短タイムアウトで諦める
    // (ハイドレーション完了の検出に十分な期間だけ待つ)
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const button = page.getByRole('button', { name: 'AI 要約を生成' });
    await button.waitFor({ state: 'visible' });
    await button.click();
    // 要約テキストが表示されるまで待つ (mock fetch 経由なので即座に返るはず)
    await page.getByText(/ESLint 10 の flat config/).waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${vpKey}-summary.png`),
      fullPage: true,
    });
    console.log(`[capture] ${vpKey}-summary.png`);

    // 4. ダークモード (一覧 + ThemeToggle dark click)
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: '記事一覧' }).waitFor({ state: 'visible' });
    // ThemeToggle の onMounted フック (localStorage 同期) 完了を待つために networkidle catch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const themeGroup = page.getByRole('group', { name: 'テーマ切替' });
    const darkBtn = themeGroup.getByRole('button').nth(2);
    await darkBtn.click();
    // dark class が付与されるまで待つ (color-mode plugin が html に dark class を付ける)
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'), {
      timeout: 10000,
    });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${vpKey}-dark.png`),
      fullPage: true,
    });
    console.log(`[capture] ${vpKey}-dark.png`);

    await context.close();
  }

  await browser.close();
  console.log('[capture] 8 screenshots saved to', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('[capture] failed:', err);
  process.exit(1);
});
