# a11y: WCAG 2.2 Target Size 44×44 検査結果

検査日: 2026-04-27
確認対象: 主要画面の interactive 要素
ツール: Playwright (Chromium)、`e2e/a11y-target-size.spec.ts`

## 結果

| テスト | 結果 |
|---|:---:|
| 記事一覧の ThemeToggle 3 ボタン (ライト / 自動 / ダーク) が 44×44 を満たす | ✅ Pass |
| 記事一覧の ArticleCard NuxtLink が 44×44 を満たす (5 枚) | ✅ Pass |
| 記事詳細の AI 要約ボタン / 戻るリンク / ThemeToggle が 44×44 を満たす | ✅ Pass |

合計: **3 / 3 Pass** (Chromium / 1280×800 viewport)。

## 検査方針

- 対象: 主要画面 (記事一覧 `/`、記事詳細 `/blog/<slug>`) の `button` / `link` ロール要素
- 基準: WCAG 2.2 Level AAA Target Size (Enhanced) — 44 × 44 CSS px 以上
- 測定: Playwright `locator.boundingBox()` の `width` / `height` を `expect().toBeGreaterThanOrEqual(44)`
- 失敗時: assert メッセージに違反要素の名前と実測サイズを含めて即特定可能

## 例外扱い (44px 未満を許容、本テスト対象外)

以下の要素は WCAG 2.2 Target Size の例外条項により 44px 必須でない:

| 要素 | 例外条項 | 理由 |
|---|---|---|
| 本文内 inline link (記事 Markdown の段落中の `<a>`) | Inline (例外: 文章内インラインリンク) | テキスト行内のリンクは spacing exception で 44px 不要、`prose` クラスの行間で押下しやすい |
| フッター内 inline link | Inline | 同上 |
| Markdown 内アンカー | Inline | 同上 |

(現状の content/blog/*.md 5 記事の本文内には例外要素を確認、いずれも `prose` でレンダリングされ inline 扱い)

## 補足

- WCAG 2.2 Level AA は 24 × 24 CSS px が基準だが、本リポジトリでは AAA Enhanced (44 × 44) を主要操作の基準として採用
- Mobile (SP / 375×812 / iPhone 15) の target-size 検査は、必要になった時点で mobile project を追加して再計測する
- 包括的 axe-core スキャンは別 evidence として管理する。target-size は WCAG の主要因子として先行カバーしている
- `ThemeToggle` ボタンは `min-h-11` (44px) を採用し、主要操作の最小サイズを揃えている

## 関連

- `e2e/a11y-target-size.spec.ts` (本テスト本体)
- `components/ThemeToggle.vue` (44px 化済)
- `components/AiSummaryButton.vue` (元から `min-h-11`)
- `pages/blog/[slug].vue` の戻るリンク (`min-h-11`)
- `components/ArticleCard.vue` (block `<a>` で十分な高さ)
