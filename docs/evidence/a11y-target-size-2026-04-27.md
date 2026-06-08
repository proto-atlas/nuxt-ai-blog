# a11y: WCAG 2.2 Target Size 44×44 検査結果

検査日: 2026-04-27
確認対象: 主要画面のinteractive要素
ツール: Playwright (Chromium)、`e2e/a11y-target-size.spec.ts`

## 結果

| テスト | 結果 |
|---|:---:|
| 記事一覧のThemeToggle 3 ボタン (ライト / 自動 / ダーク) が 44×44 を満たす | Pass |
| 記事一覧のArticleCard NuxtLinkが 44×44 を満たす (5 枚) | Pass |
| 記事詳細のAI要約ボタン / 戻るリンク / ThemeToggleが 44×44 を満たす | Pass |

合計: **3 / 3 Pass** (Chromium / 1280×800 viewport)。

## 検査方針

- 対象: 主要画面 (記事一覧 `/`、記事詳細 `/blog/<slug>`) の `button` / `link` ロール要素
- 基準: WCAG 2.2 Level AAA Target Size (Enhanced): 44 × 44 CSS px以上
- 測定: Playwright `locator.boundingBox()` の `width` / `height` を `expect().toBeGreaterThanOrEqual(44)`
- 失敗時: assertメッセージに違反要素の名前と実測サイズを含めて即特定可能

## 例外扱い (44px未満を許容、本テスト対象外)

以下の要素はWCAG 2.2 Target Sizeの例外条項により 44px必須でない:

| 要素 | 例外条項 | 理由 |
|---|---|---|
| 本文内inline link (記事Markdownの段落中の `<a>`) | Inline (例外: 文章内インラインリンク) | テキスト行内のリンクはspacing exceptionで 44px不要、`prose` クラスの行間で押下しやすい |
| フッター内inline link | Inline | 同上 |
| Markdown内アンカー | Inline | 同上 |

(現状のcontent/blog/*.md 5 記事の本文内には例外要素を確認、いずれも `prose` でレンダリングされinline扱い)

## 補足

- WCAG 2.2 Level AAは 24 × 24 CSS pxが基準だが、本リポジトリではAAA Enhanced (44 × 44) を主要操作の基準として採用
- Mobile (SP / 375×812 / iPhone 15) のtarget-size検査は、必要になった時点でmobile projectを追加して再計測する
- 包括的axe-coreスキャンは別evidenceとして管理する。target-sizeはWCAGの主要因子として先行カバーしている
- `ThemeToggle` ボタンは `min-h-11` (44px) を採用し、主要操作の最小サイズを揃えている

## 関連

- `e2e/a11y-target-size.spec.ts` (本テスト本体)
- `components/ThemeToggle.vue` (44px化済)
- `components/AiSummaryButton.vue` (元から `min-h-11`)
- `pages/blog/[slug].vue` の戻るリンク (`min-h-11`)
- `components/ArticleCard.vue` (block `<a>` で十分な高さ)
