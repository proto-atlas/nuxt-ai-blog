import { expect, test } from '@playwright/test';

/**
 * AI要約フローE2E。
 * 実Anthropic APIは呼ばず、`page.route('/api/summary')` でモックして
 * 主要フロー (button click → loading → 要約表示) と
 * エラー表示 (rate_limit / unknown等の日本語ラベル変換) を検証する。
 */

const ARTICLE_PATH = '/blog/eslint-10-flat-config-practical';

test.describe('AI要約', () => {
  test('要約ボタンをクリックすると要約テキストが表示される (成功フロー)', async ({ page }) => {
    // /api/summaryを成功レスポンスでモック (Anthropic課金ゼロ)
    await page.route('**/api/summary', async (route) => {
      const body = JSON.stringify({
        slug: 'eslint-10-flat-config-practical',
        summary:
          'ESLint 10 のflat configはプラグインを配列 + spreadで並べる構成で、レガシー .eslintrc形式から段階的に移行可能。',
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
    // dev server (Vite HMRのWebSocket) でnetworkidleが来ないため短タイムアウトでcatch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const button = page.getByRole('button', { name: 'AI要約を生成' });
    await expect(button).toBeVisible();
    await page.getByLabel('AI要約アクセスキー').fill('demo-key');

    await button.click();

    // 要約テキストが表示される (モックの本文の一部を検証)。
    // dev server (Vite HMR) ではuseAsyncData / hydrationが遅く、default 5sでは
    // 間に合わないケースがあるためtimeout 10sに延長
    await expect(page.getByText(/ESLint 10 のflat config/)).toBeVisible({ timeout: 10_000 });
  });

  test('429 rate_limitでユーザー向け日本語エラー文言が表示される', async ({ page }) => {
    // /api/summaryを 429 + Nitro createErrorレスポンスbody形状でモック。
    // 実際のh3 createError({ statusCode, statusMessage, data }) はbodyとして
    // { statusCode, statusMessage, data: { error, ... } } を返す (Nitro v2)。
    // ofetchはthrow時にbody全体をerr.dataに入れるため、useAiSummaryの
    // extractErrorCodeはerr.data.data.errorを読む。
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
    // dev server (Vite HMRのWebSocket) でnetworkidleが来ないため短タイムアウトでcatch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await page.getByLabel('AI要約アクセスキー').fill('demo-key');
    await page.getByRole('button', { name: 'AI要約を生成' }).click();

    // labelForSummaryError('rate_limit') の文言を検証
    await expect(page.getByText(/短時間に多くのリクエスト/)).toBeVisible();
  });

  test('500 upstream_unavailableでサーバー側生messageをUIに出さない', async ({ page }) => {
    // SDK例外ケース。サーバーはupstream_unavailable codeのみ返す想定。
    // 上記 429 ケースと同様、Nitro createErrorのレスポンスbody形状で返す。
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
    // dev server (Vite HMRのWebSocket) でnetworkidleが来ないため短タイムアウトでcatch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await page.getByLabel('AI要約アクセスキー').fill('demo-key');
    await page.getByRole('button', { name: 'AI要約を生成' }).click();

    // 日本語ラベル表示
    await expect(page.getByText(/AIサービスとの通信に失敗/)).toBeVisible();
    // 内部詳細 (Anthropic / stack trace等の文字列) が漏れていない
    await expect(page.locator('body')).not.toContainText('Anthropic');
    await expect(page.locator('body')).not.toContainText('stack');
  });
});
