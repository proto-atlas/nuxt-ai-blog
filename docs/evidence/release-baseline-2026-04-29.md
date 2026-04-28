# Release Baseline - 2026-04-29

nuxt-ai-blog の公開前再検証として、ローカル品質ゲート、公開 URL、GitHub Actions、依存関係 audit を確認した記録です。

## 対象

- Repository: `proto-atlas/nuxt-ai-blog`
- Local path: `public-clean-repos-2026-04-28/nuxt-ai-blog`
- HEAD: `8d2451242185f35da186c39d3d1f45278085820b`
- Public URL: `https://nuxt-ai-blog.atlas-lab.workers.dev/`

## 確認結果

| 項目 | コマンド / 確認方法 | 結果 |
|---|---|---|
| Working tree | `git status --short` | clean |
| Public URL | `Invoke-WebRequest -Method Head https://nuxt-ai-blog.atlas-lab.workers.dev/` | HTTP 200 |
| GitHub Actions | `gh run list --repo proto-atlas/nuxt-ai-blog --limit 1` | success: `25051003986` |
| TypeScript | `npm run typecheck` | pass |
| Lint / format | `npm run lint` | pass |
| Unit coverage | `npm run test:coverage` | pass: 13 files / 94 tests |
| E2E | `npm run e2e -- --project=chromium` | pass: 9 tests |
| Production build | `npm run build` | pass |
| Publish scan | `npm run check:publish` | pass: danger words 0 |
| Dependency audit | `npm audit --audit-level=high` | pass: 0 vulnerabilities |

## Coverage

`npm run test:coverage` の最終結果:

- Statements: 95.19%
- Branches: 88.73%
- Functions: 97.14%
- Lines: 96.25%

## Build Notes

`npm run build` は成功した。確認時に以下の warning が出たが、exit code は 0 だった。

- `@nuxt/content` が Cloudflare deploy 向けに D1 binding `DB` へ切り替える warning
- sourcemap に関する Vite plugin warning
- Nitro の internal cache-driver import が external dependency 扱いになる warning

これらは現時点の build 失敗ではないが、D1 運用と sourcemap の説明材料として残す。

## 未確認

- 本番 `/api/summary` の live AI smoke はこの baseline では未実施。
- 本番の濫用対策強化後の 401 / 429 smoke は未実施。

