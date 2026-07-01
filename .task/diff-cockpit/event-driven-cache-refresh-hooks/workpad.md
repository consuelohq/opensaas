# event driven cache refresh hooks

branch: `task/diff-cockpit/event-driven-cache-refresh-hooks`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/757/event-driven-cache-refresh-hooks
github pr: https://github.com/consuelohq/opensaas/pull/757
started: 2026-06-05

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- `packages/workspace/hooks/README.md`

## workspace-owned: files changed

- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- `packages/workspace/hooks/README.md`

## workspace-owned: activity log

- 2026-06-05 00:25:36 fs.write: `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- 2026-06-05 00:25:43 fs.write: `packages/workspace/hooks/README.md`

## workspace-owned: validation evidence

- 2026-06-05 00:30:25 `verify`: failed — COMMAND_FAILED
- 2026-06-05 00:31:59 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/diff-cockpit/tsconfig.json`
- `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-05 00:25:36 write: `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`

- 2026-06-05 00:25:43 write: `packages/workspace/hooks/README.md`

## update 2026-06-04 20:29

Implemented event-driven diff-cockpit cache refresh plumbing.

Acceptance criteria covered:
- Worker exposes protected `POST /internal/cache/refresh`.
- Endpoint refreshes homepage API snapshot and selected PR API snapshots into Worker Cache API.
- API GET routes read from prewarmed Worker Cache API before fetching GitHub.
- `bun run diff_cockpit -- refresh ...` calls the refresh endpoint through a workspace hook.
- New workspace hooks folder exists at `packages/workspace/hooks`, parallel to `scripts` and `tools`.
- `task:push` now runs a non-blocking post-push hook; it refreshes diff-cockpit when `DIFF_COCKPIT_REFRESH_TOKEN` is present and skips safely otherwise.

Validation evidence:
- Focused tests: `cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts` passed with 20 tests and 175 expectations.
- Typecheck: `cd packages/diff-cockpit && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json` passed.
- CLI smoke: `bun run diff_cockpit -- --print --no-open 719` prints the expected PR URL.
- CLI missing-token smoke: `bun run diff_cockpit -- refresh 757 --reason smoke` fails clearly with `DIFF_COCKPIT_REFRESH_TOKEN is required to refresh diff cockpit cache`.
- Cloudflare deploy: Worker version `7f36d086-fc87-4eb0-a761-8eb2aff642f7` deployed to `diffs.consuelohq.com`.
- Live disabled smoke: refresh endpoint returns `DIFF_COCKPIT_REFRESH_TOKEN is not configured`, which is expected because Cloudflare currently only has `GITHUB_TOKEN` configured.

Cache strategy:
- TTL is no longer the main freshness mechanism for active workflow changes.
- On task push, the hook can refresh the homepage and task PR cache entries immediately after GitHub is updated.
- The Worker Cache API is used as the shared network cache, so phone/computer reuse the warmed API entries.
- Hook failures are non-blocking and reported as warnings/results so task pushes do not become fragile.

Secret setup needed before automatic live refresh works:
- Configure Cloudflare Worker secret `DIFF_COCKPIT_REFRESH_TOKEN`.
- Export the same value in the shell/session that runs `bun run task:push`.

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/event-driven-cache-refresh-hooks/current.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/evidence-log.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/read-log.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/session.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/workpad.md`, `.task/tasks/diff-cockpit/event-driven-cache-refresh-hooks.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/workspace/hooks/README.md`, `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`, `packages/workspace/scripts/diff_cockpit.ts`, `packages/workspace/scripts/task-push.js`
- matched rules: `workspace-publish-gate`
- selected suites: `workspace verification stamp tests`
- run results: `workspace verification stamp tests` passed
- failed suites: none

## update 2026-06-04 20:31

Patched cache helper error handling for review gate and redeployed.

Additional validation:
- Focused tests and package typecheck passed after error-handling patch.
- Cloudflare Worker version `3a3470e3-3efd-48fa-a894-6c2b2f5d86f2` deployed.
- Live protected endpoint still reports `DIFF_COCKPIT_REFRESH_TOKEN is not configured`, confirming the deployed endpoint is present and protected/disabled until the secret is installed.
