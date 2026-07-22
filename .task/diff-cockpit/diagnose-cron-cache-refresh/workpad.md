# diagnose cron cache refresh

branch: `task/diff-cockpit/diagnose-cron-cache-refresh`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/876/diagnose-cron-cache-refresh
github pr: https://github.com/consuelohq/opensaas/pull/876
started: 2026-06-09

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-09 19:49:34 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: validation evidence

- 2026-06-09 19:50:51 `checkFiles`: passed — OK
- 2026-06-09 19:51:29 `review.run`: passed — OK
- 2026-06-09 19:54:24 `review.run`: passed — OK
- 2026-06-09 19:54:40 `verify`: passed — OK

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

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/tsconfig.json`
- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/diagnose-cron-cache-refresh/current.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/evidence-log.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/read-log.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/session.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/workpad.md`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/current.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/evidence-log.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/read-log.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/session.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/verify.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/workpad.md`, `.task/tasks/diff-cockpit/diagnose-cron-cache-refresh.json`, `.task/tasks/diff-cockpit/hydrate-pr-pages-from-shared-cache.json`, `cron_jobs/README.md`, `cron_jobs/diff_cockpit/cron.json`, `cron_jobs/index.ts`, `cron_jobs/tests/cron_jobs.test.ts`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
