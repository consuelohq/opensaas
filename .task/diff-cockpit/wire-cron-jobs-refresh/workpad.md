# wire cron jobs refresh

branch: `task/diff-cockpit/wire-cron-jobs-refresh`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/851/wire-cron-jobs-refresh
github pr: https://github.com/consuelohq/opensaas/pull/851
started: 2026-06-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `cron_jobs/diff_cockpit/.env.example`
- `cron_jobs/diff_cockpit/cron.json`
- `cron_jobs/README.md`
- `cron_jobs/tests/cron_jobs.test.ts`
- `packages/workspace/SCRIPTS.md`

## workspace-owned: files changed

- `cron_jobs/diff_cockpit/.env.example`
- `cron_jobs/diff_cockpit/cron.json`
- `cron_jobs/README.md`
- `cron_jobs/tests/cron_jobs.test.ts`
- `packages/workspace/SCRIPTS.md`

## workspace-owned: activity log

- 2026-06-08 06:44:08 fs.write: `cron_jobs/tests/cron_jobs.test.ts`
- 2026-06-08 06:44:37 fs.write: `cron_jobs/diff_cockpit/cron.json`
- 2026-06-08 06:45:01 fs.write: `cron_jobs/diff_cockpit/.env.example`
- 2026-06-08 06:45:27 fs.write: `cron_jobs/README.md`
- 2026-06-08 06:49:12 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-06-08 06:50:14 fs.patch: `packages/workspace/SCRIPTS.md`

## workspace-owned: validation evidence

- 2026-06-08 06:56:56 `review.run`: passed — OK
- 2026-06-08 06:56:57 `review.run`: passed — OK
- 2026-06-08 06:56:57 `review.run`: passed — OK
- 2026-06-08 06:58:50 `verify`: failed — COMMAND_FAILED
- 2026-06-08 06:58:51 `verify`: failed — COMMAND_FAILED

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

- `cron_jobs/diff_cockpit/cron.json`
- `cron_jobs/index.ts`
- `cron_jobs/tests/cron_jobs.test.ts`
- `package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- `packages/workspace/package.json`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/wire-cron-jobs-refresh/current.json`, `.task/diff-cockpit/wire-cron-jobs-refresh/evidence-log.json`, `.task/diff-cockpit/wire-cron-jobs-refresh/read-log.json`, `.task/diff-cockpit/wire-cron-jobs-refresh/session.json`, `.task/diff-cockpit/wire-cron-jobs-refresh/workpad.md`, `.task/tasks/diff-cockpit/wire-cron-jobs-refresh.json`, `cron_jobs/README.md`, `cron_jobs/diff_cockpit/.env.example`, `cron_jobs/diff_cockpit/cron.json`, `cron_jobs/index.ts`, `cron_jobs/tests/cron_jobs.test.ts`, `packages/workspace/SCRIPTS.md`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none
