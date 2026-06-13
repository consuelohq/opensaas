# merge ui updates and configure cache refresh token

branch: `task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token`
stream: `stream/diff-cockpit`
pr: pending

## acceptance criteria

- [x] Confirm stream contains the Graphite-like diff cockpit UI updates from PR #891.
- [x] Confirm production cache refresh secret exists in Cloudflare.
- [x] Rotate and align the diff-cockpit refresh token between Cloudflare Worker secrets and local ignored env files.
- [x] Make `task:push` load local ignored env files so the cache refresh hook does not silently skip when the token is only local.
- [x] Prove the internal cache refresh endpoint accepts the configured token and queues edge cache refresh work.
- [ ] Merge stream to main and deploy the UI/cache changes.

## implementation

- Added local env loading to `packages/workspace/scripts/task-push.js`, after task context resolves the repo root and before post-push hooks run.
- Loader reads root env first and packages env second without overwriting already-exported process env vars.
- Rotated the refresh token with Wrangler for the diff cockpit Worker and wrote the same token to ignored local env files.

## validation evidence

- Wrangler secret list shows the refresh token and GitHub token are present.
- Cache refresh endpoint check returned HTTP 200 with `ok=true`, `queued=true`, `cache=edge`.
- `node --check packages/workspace/scripts/task-push.js`: passed.

## notes

- Do not commit local env files; they are ignored.
- Production still showed the old UI because stream PR #895 had not yet been merged to main/deployed.

- 2026-06-09 23:50:29 write: `.task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-09 23:50:29 fs.write: `.task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token/workpad.md`

## workspace-owned: files read

- `packages/workspace/scripts/task-push.js`

## workspace-owned: validation evidence

- Wrangler secret list shows the refresh token and GitHub token are present.
- Cache refresh endpoint check returned HTTP 200 with `ok=true`, `queued=true`, `cache=edge`.
- `node --check packages/workspace/scripts/task-push.js`: passed.
- 2026-06-09 23:52:14 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token/current.json`, `.task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token/evidence-log.json`, `.task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token/read-log.json`, `.task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token/session.json`, `.task/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token/workpad.md`, `.task/tasks/diff-cockpit/merge-ui-updates-and-configure-cache-refresh-token.json`, `packages/workspace/scripts/task-push.js`
- matched rules: `workspace-publish-gate`
- selected suites: `workspace verification stamp tests`
- run results: `workspace verification stamp tests` passed
- failed suites: none
