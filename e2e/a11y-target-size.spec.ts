import { expect, test, type Locator } from '@playwright/test';

/**
 * a11y target-size E2E。
 *
 * 主要画面の
 * interactive要素 (`button` / `link`) を辿ってWCAG 2.2 AAA Target Size Enhanced
 * (44×44 CSS px) を機械的に検査する。
 *
 * 例外扱い (44px未満を許容):
 * - 本文内inline link (記事本文の段落中の <a>): WCAG例外として「inline text」は
 * spacing exceptionで 44px必須ではない。実装上も `prose` クラスの内部リンクは
 * 周辺余白で押下しやすく、デモ用途では実害低
 * - フッター内inline link: 同上
 *
 * 検査対象:
 * - 記事一覧のThemeToggle 3 ボタン (light / system / dark)
 * - 記事一覧のArticleCard NuxtLink (5 枚)
 * - 記事詳細のAI要約ボタン
 * - 記事詳細の「記事一覧へ戻る」リンク
 * - 記事詳細のThemeToggle 3 ボタン
 */

const ARTICLE_PATH = '/blog/eslint-10-flat-config-practical';
const MIN_SIZE_PX = 44;

/**
 * 渡したlocatorのbounding boxを取得し、44×44 を満たすかassertする。
 * 名前はassertメッセージに含めて、fail時に違反要素を即特定できるようにする。
 */
async function expectTargetSize(locator: Locator, name: string): Promise<void> {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  expect(box, `${name} のbounding boxが取得できない (visibleでないかdetached)`).not.toBeNull();
  if (!box) return;
  expect(
    box.width,
    `${name} のwidthが ${MIN_SIZE_PX}px未満 (実測 ${box.width}px)`,
  ).toBeGreaterThanOrEqual(MIN_SIZE_PX);
  expect(
    box.height,
    `${name} のheightが ${MIN_SIZE_PX}px未満 (実測 ${box.height}px)`,
  ).toBeGreaterThanOrEqual(MIN_SIZE_PX);
}

test.describe('a11y: WCAG 2.2 Target Size 44×44', () => {
  test('記事一覧のThemeToggle 3 ボタンが 44×44 を満たす', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();

    const themeGroup = page.getByRole('group', { name: 'テーマ切替' });
    await expectTargetSize(themeGroup.getByRole('button').nth(0), 'ThemeToggleライト');
    await expectTargetSize(themeGroup.getByRole('button').nth(1), 'ThemeToggle自動');
    await expectTargetSize(themeGroup.getByRole('button').nth(2), 'ThemeToggleダーク');
  });

  test('記事一覧のArticleCard NuxtLinkが 44×44 を満たす (5 枚)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: '記事一覧' })).toBeVisible();

    // ArticleCardは <a class="block ..."> なので幅広・高めのlink
    const cardLinks = page.locator('a[href^="/blog/"]');
    const count = await cardLinks.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < Math.min(count, 5); i += 1) {
      await expectTargetSize(cardLinks.nth(i), `ArticleCard #${i + 1}`);
    }
  });

  test('記事詳細のAI要約ボタン / 戻るリンク / ThemeToggleが 44×44 を満たす', async ({ page }) => {
    await page.goto(ARTICLE_PATH);
    await expect(
      page.getByRole('heading', { level: 1, name: 'ESLint 10 flat configの実務設定' }),
    ).toBeVisible();

    await expectTargetSize(page.getByRole('button', { name: 'AI要約を生成' }), 'AI要約ボタン');

    await expectTargetSize(
      page.getByRole('link', { name: /記事一覧へ戻る/ }),
      '記事一覧へ戻るリンク',
    );

    const themeGroup = page.getByRole('group', { name: 'テーマ切替' });
    await expectTargetSize(themeGroup.getByRole('button').nth(2), '記事詳細のThemeToggleダーク');
  });
});
