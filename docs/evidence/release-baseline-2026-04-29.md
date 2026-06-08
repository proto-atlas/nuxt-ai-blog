# release検証スナップショット - 2026-04-29

nuxt-ai-blogのrelease verificationとして、ローカル品質ゲート、公開URL、GitHub Actions、依存関係auditを確認した記録です。
この証跡は特定時点の検証スナップショットであり、リポジトリの最新HEADであることは主張しません。固定HEADは本文に埋め込まず、確認時に対象にするcommitとCI runは外部入力として指定してください。

## 対象

- Repository: `proto-atlas/nuxt-ai-blog`
- Branch: `main`
- 公開URL: `https://nuxt-ai-blog.atlas-lab.workers.dev/`

## 確認結果

| 項目 | コマンド / 確認方法 | 結果 |
|---|---|---|
| Working tree | `git status --short` | clean |
| 公開URL | `Invoke-WebRequest -Method Head https://nuxt-ai-blog.atlas-lab.workers.dev/` | HTTP 200 |
| GitHub Actions | `gh run list --repo proto-atlas/nuxt-ai-blog --limit 3` | 確認時点でcompleted runが成功 |
| TypeScript | `npm run typecheck` | 通過 |
| Lint / format | `npm run lint` | 通過 |
| Unit coverage | `npm run test:coverage` | 通過: 16 files / 109 tests |
| E2E | `npm run e2e -- --project=chromium --workers=1` | 通過: 10 tests |
| Production build | `npm run build` | 通過 |
| Dependency audit | `npm audit --audit-level=high` | 通過: 0 vulnerabilities |

## coverage結果

`npm run test:coverage` の最終結果:

- Statements: 95.76%
- Branches: 87.83%
- Functions: 98.03%
- Lines: 96.59%

## build時の補足

`npm run build` は成功した。確認時に以下のwarningが出たが、exit codeは 0 だった。

- `@nuxt/content` がCloudflare deploy向けにD1 binding `DB` へ切り替えるwarning
- sourcemapに関するVite plugin warning
- Nitroのinternal cache-driver importがexternal dependency扱いになるwarning

これらは現時点のbuild失敗ではないが、D1 運用とsourcemapの説明材料として残す。

## 未確認

- 本番 `/api/summary` の実API確認は `production-check-2026-04-29.md` で管理する。
- このsnapshot時点では本番cache hitは未確認だった。Durable Objects cache / quota実装後の本番 `cached:true` は、deploy後のmanual-live-summary-checkで別途記録する。
