# Release Baseline - 2026-04-29

nuxt-ai-blog のrelease verificationとして、ローカル品質ゲート、公開 URL、GitHub Actions、依存関係 audit を確認した記録です。
この証跡は公開リポの各commitと一緒に管理するため、自己参照になる固定HEADは本文に埋め込まない。
特定commitを確認する場合は、GitHubのcommit画面とActions runを対応させて確認する。

## 対象

- Repository: `proto-atlas/nuxt-ai-blog`
- Branch: `main`
- Public URL: `https://nuxt-ai-blog.atlas-lab.workers.dev/`

## 確認結果

| 項目 | コマンド / 確認方法 | 結果 |
|---|---|---|
| Working tree | `git status --short` | clean |
| Public URL | `Invoke-WebRequest -Method Head https://nuxt-ai-blog.atlas-lab.workers.dev/` | HTTP 200 |
| GitHub Actions | `gh run list --repo proto-atlas/nuxt-ai-blog --limit 3` | latest completed run success |
| TypeScript | `npm run typecheck` | pass |
| Lint / format | `npm run lint` | pass |
| Unit coverage | `npm run test:coverage` | pass: 16 files / 109 tests |
| E2E | `npm run e2e -- --project=chromium --workers=1` | pass: 10 tests |
| Production build | `npm run build` | pass |
| Publish scan | `npm run check:publish` | pass: danger words 0 |
| Dependency audit | `npm audit --audit-level=high` | pass: 0 vulnerabilities |

## Coverage

`npm run test:coverage` の最終結果:

- Statements: 95.76%
- Branches: 87.83%
- Functions: 98.03%
- Lines: 96.59%

## Build Notes

`npm run build` は成功した。確認時に以下の warning が出たが、exit code は 0 だった。

- `@nuxt/content` が Cloudflare deploy 向けに D1 binding `DB` へ切り替える warning
- sourcemap に関する Vite plugin warning
- Nitro の internal cache-driver import が external dependency 扱いになる warning

これらは現時点の build 失敗ではないが、D1 運用と sourcemap の説明材料として残す。

## 未確認

- 本番 `/api/summary` のlive AI smokeは `production-smoke-2026-04-29.md` で管理する。
- 本番cache hitは未確認。Workers isolate単位のin-memory cache制約として扱う。
