# add sites launcher cron refresh

branch: `task/design/add-sites-launcher-cron-refresh`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1018/add-sites-launcher-cron-refresh
github pr: https://github.com/consuelohq/opensaas/pull/1018
started: 2026-06-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `cron_jobs/index.ts`
- `cron_jobs/README.md`
- `cron_jobs/sites_launcher/.env.example`
- `cron_jobs/sites_launcher/cron.json`
- `cron_jobs/sites_launcher/README.md`
- `cron_jobs/tests/cron_jobs.test.ts`

## workspace-owned: files changed

- `cron_jobs/index.ts`
- `cron_jobs/README.md`
- `cron_jobs/sites_launcher/.env.example`
- `cron_jobs/sites_launcher/cron.json`
- `cron_jobs/sites_launcher/README.md`
- `cron_jobs/tests/cron_jobs.test.ts`

## workspace-owned: activity log

- 2026-06-13 15:49:17 fs.write: `cron_jobs/index.ts`
- 2026-06-13 15:52:32 fs.patch: `cron_jobs/index.ts`
- 2026-06-13 15:53:23 fs.patch: `cron_jobs/index.ts`
- 2026-06-13 15:54:56 fs.patch: `cron_jobs/index.ts`
- 2026-06-13 15:56:02 fs.write: `cron_jobs/sites_launcher/cron.json`
- 2026-06-13 15:56:02 fs.write: `cron_jobs/sites_launcher/.env.example`
- 2026-06-13 15:56:03 fs.write: `cron_jobs/sites_launcher/README.md`
- 2026-06-13 15:56:03 fs.write: `cron_jobs/README.md`
- 2026-06-13 15:57:15 fs.write: `cron_jobs/tests/cron_jobs.test.ts`
- 2026-06-13 15:59:47 fs.patch: `cron_jobs/index.ts`

## workspace-owned: validation evidence

- 2026-06-13 16:02:49 `review.run`: passed — OK
- 2026-06-13 16:07:09 `verify`: failed — COMMAND_FAILED
- 2026-06-13 16:07:09 `verify`: failed — COMMAND_FAILED
- 2026-06-13 16:07:09 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(design): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `cron_jobs/README.md`
- `cron_jobs/diff_cockpit/cron.json`
- `cron_jobs/index.ts`
- `cron_jobs/tests/cron_jobs.test.ts`

- 2026-06-13 15:57:15 write: `cron_jobs/tests/cron_jobs.test.ts`

- 2026-06-13 15:59:47 patch lines 1-1: `cron_jobs/index.ts`

## workspace-owned: test selection

- changed files: `.task/design/add-sites-launcher-cron-refresh/current.json`, `.task/design/add-sites-launcher-cron-refresh/evidence-log.json`, `.task/design/add-sites-launcher-cron-refresh/read-log.json`, `.task/design/add-sites-launcher-cron-refresh/session.json`, `.task/design/add-sites-launcher-cron-refresh/workpad.md`, `.task/tasks/design/add-sites-launcher-cron-refresh.json`, `cron_jobs/README.md`, `cron_jobs/index.ts`, `cron_jobs/sites_launcher/.env.example`, `cron_jobs/sites_launcher/README.md`, `cron_jobs/sites_launcher/cron.json`, `cron_jobs/tests/cron_jobs.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
