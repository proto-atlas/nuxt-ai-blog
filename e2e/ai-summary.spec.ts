import { expect, test } from '@playwright/test';

/**
 * AI 要約フロー E2E。
 * 実 Anthropic API は呼ばず、`page.route('/api/summary')` でモックして
 * 主要フロー (button click → loading → 要約表示) と
 * エラー表示 (rate_limit / unknown 等の日本語ラベル変換) を検証する。
 */

const ARTICLE_PATH = '/blog/eslint-10-flat-config-practical';

test.describe('AI 要約', () => {
  test('要約ボタンをクリックすると要約テキストが表示される (成功フロー)', async ({ page }) => {
    // /api/summary を成功レスポンスでモック (Anthropic 課金ゼロ)
    await page.route('**/api/summary', async (route) => {
      const body = JSON.stringify({
        slug: 'eslint-10-flat-config-practical',
        summary:
          'ESLint 10 の flat config はプラグインを配列 + spread で並べる構成で、レガシー .eslintrc 形式から段階的に移行可能。',
        model: 'claude-haiku-4-5-20251001',
        cached: false,
        generatedAt: '2026-04-25T00:00:00.000Z',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body,
      });
    });

    await page.goto(ARTICLE_PATH);
    // dev server (Vite HMR の WebSocket) で networkidle が来ないため短タイムアウトで catch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const button = page.getByRole('button', { name: 'AI 要約を生成' });
    await expect(button).toBeVisible();

    await button.click();

    // 要約テキストが表示される (モックの本文の一部を検証)。
    // dev server (Vite HMR) では useAsyncData / hydration が遅く、default 5s では
    // 間に合わないケースがあるため timeout 10s に延長
    await expect(page.getByText(/ESLint 10 の flat config/)).toBeVisible({ timeout: 10_000 });
  });

  test('429 rate_limit でユーザー向け日本語エラー文言が表示される', async ({ page }) => {
    // /api/summary を 429 + Nitro createError レスポンス body 形状でモック。
    // 実際の h3 createError({ statusCode, statusMessage, data }) は body として
    // { statusCode, statusMessage, data: { error, ... } } を返す (Nitro v2)。
    // ofetch は throw 時に body 全体を err.data に入れるため、useAiSummary の
    // extractErrorCode は err.data.data.error を読む。
    await page.route('**/api/summary', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 429,
          statusMessage: 'rate_limit',
          data: { error: 'rate_limit', retryAfterSeconds: 30 },
        }),
      });
    });

    await page.goto(ARTICLE_PATH);
    // dev server (Vite HMR の WebSocket) で networkidle が来ないため短タイムアウトで catch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await page.getByRole('button', { name: 'AI 要約を生成' }).click();

    // labelForSummaryError('rate_limit') の文言を検証
    await expect(page.getByText(/短時間に多くのリクエスト/)).toBeVisible();
  });

  test('500 upstream_unavailable でサーバー側生 message を UI に出さない', async ({ page }) => {
    // SDK 例外ケース。サーバーは upstream_unavailable code のみ返す想定。
    // 上記 429 ケースと同様、Nitro createError のレスポンス body 形状で返す。
    await page.route('**/api/summary', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 500,
          statusMessage: 'upstream_unavailable',
          data: { error: 'upstream_unavailable' },
        }),
      });
    });

    await page.goto(ARTICLE_PATH);
    // dev server (Vite HMR の WebSocket) で networkidle が来ないため短タイムアウトで catch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await page.getByRole('button', { name: 'AI 要約を生成' }).click();

    // 日本語ラベル表示
    await expect(page.getByText(/AI サービスとの通信に失敗/)).toBeVisible();
    // 内部詳細 (Anthropic / stack trace 等の文字列) が漏れていない
    await expect(page.locator('body')).not.toContainText('Anthropic');
    await expect(page.locator('body')).not.toContainText('stack');
  });
});
