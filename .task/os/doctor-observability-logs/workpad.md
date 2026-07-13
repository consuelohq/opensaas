# doctor observability logs

branch: `task/os/doctor-observability-logs`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/579/doctor-observability-logs
github pr: https://github.com/consuelohq/opensaas/pull/579
started: 2026-05-24

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/doctor-analytics.ts`
- `packages/os/scripts/doctor-errors.ts`
- `packages/os/scripts/doctor-watch.ts`
- `packages/os/tests/doctor-logs.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/doctor-analytics.ts`
- `packages/os/scripts/doctor-errors.ts`
- `packages/os/scripts/doctor-watch.ts`
- `packages/os/tests/doctor-logs.test.ts`

## workspace-owned: activity log

- 2026-05-24 07:23:00 fs.write: `packages/os/scripts/doctor-watch.ts`
- 2026-05-24 07:23:10 fs.write: `packages/os/scripts/doctor-errors.ts`
- 2026-05-24 07:23:28 fs.write: `packages/os/scripts/doctor-analytics.ts`
- 2026-05-24 07:23:43 fs.write: `packages/os/tests/doctor-logs.test.ts`

## workspace-owned: validation evidence

- 2026-05-24 07:24:15 `checkFiles`: passed — OK
- 2026-05-24 07:24:40 `review.run`: passed — OK
- 2026-05-24 07:25:23 `review.run`: passed — OK
- 2026-05-24 07:25:36 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-24 07:23:00 write: `packages/os/scripts/doctor-watch.ts`

- 2026-05-24 07:23:10 write: `packages/os/scripts/doctor-errors.ts`

- 2026-05-24 07:23:28 write: `packages/os/scripts/doctor-analytics.ts`

- 2026-05-24 07:23:43 write: `packages/os/tests/doctor-logs.test.ts`
