import { expect, test } from '@playwright/test';

test.describe('blog', () => {
  test('記事一覧ページが 5 記事を表示する', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();

    // 記事 5 本 = リンク 5 個（ArticleCard 全体が NuxtLink）
    // 記事タイトルの一部で存在確認 (すべてが確実に描画されているか)
    await expect(page.getByText('Nuxt 4 の新ディレクトリ構造 app/ への移行')).toBeVisible();
    await expect(
      page.getByText('TypeScript 6 で書く Vue 3 composable のベストプラクティス'),
    ).toBeVisible();
    await expect(page.getByText('Cloudflare Workers で Nuxt 4 をデプロイするまで')).toBeVisible();
    await expect(page.getByText('Tailwind CSS 4 の注目機能 5 選')).toBeVisible();
    await expect(page.getByText('ESLint 10 flat config の実務設定')).toBeVisible();
  });

  test('記事詳細ページに遷移して見出しと AI 要約ボタンが出る', async ({ page }) => {
    await page.goto('/');
    // 一覧描画完了を待ってから click する (hydration 前の link click を避ける)
    await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();
    await expect(page.getByText('ESLint 10 flat config の実務設定')).toBeVisible();

    // Vue ハイドレーション完了まで待つ (NuxtLink の SPA 遷移ハンドラが付いたタイミング)
    // dev server (Vite HMR の WebSocket) で networkidle が来ないため短タイムアウトで catch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // path 直指定でクリック + URL 変化を待つ (accessible name が長文で辿りにくいため)
    await Promise.all([
      page.waitForURL(/\/blog\/eslint-10-flat-config-practical$/),
      page.locator('a[href="/blog/eslint-10-flat-config-practical"]').first().click(),
    ]);

    await expect(
      page.getByRole('heading', { level: 1, name: 'ESLint 10 flat config の実務設定' }),
    ).toBeVisible();

    // AI 要約ボタン存在確認 (クリックはしない、API 呼ぶため)
    await expect(page.getByRole('heading', { level: 3, name: 'AI 要約' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI 要約を生成' })).toBeVisible();

    // 戻るリンク
    await expect(page.getByRole('link', { name: /記事一覧へ戻る/ })).toBeVisible();
  });

  test('ダークモードトグルで html.dark class が付く', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();
    // ThemeToggle は onMounted で activePreference を localStorage 同期するため、
    // ハイドレーション完了を networkidle で確認してから click。
    // dev server (Vite HMR の WebSocket) で networkidle が来ないため短タイムアウトで catch
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // テーマ切替 group 内の 3 択ボタンを位置で特定 (0: ライト, 1: 自動, 2: ダーク)
    const themeGroup = page.getByRole('group', { name: 'テーマ切替' });
    const lightBtn = themeGroup.getByRole('button').nth(0);
    const darkBtn = themeGroup.getByRole('button').nth(2);

    await darkBtn.click();
    // color-mode plugin が <html class="dark"> を反映するまで待つ (default 5s timeout)
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(darkBtn).toHaveAttribute('aria-pressed', 'true');

    await lightBtn.click();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
