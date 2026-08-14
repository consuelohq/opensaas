# repair changed server ci baseline

branch: `task/os/repair-changed-server-ci-baseline`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1924/repair-changed-server-ci-baseline
github pr: https://github.com/consuelohq/opensaas/pull/1924
started: 2026-08-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 00:00:01 `review.run`: passed — OK
- 2026-08-14 00:03:53 `verify`: failed — COMMAND_FAILED
- 2026-08-14 00:04:07 `verify`: failed — COMMAND_FAILED
- 2026-08-14 00:12:20 `review.run`: passed — OK
- 2026-08-14 00:14:07 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/workspace/scripts/ci/run-changed-server-task.mjs`
- `packages/workspace/tests/run-changed-server-task.test.mjs`
