# Sync OS stream with main after worker drain fix

branch: `task/os/sync-os-stream-with-main-after-worker-drain-fix`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2106/sync-os-stream-with-main-after-worker-drain-fix
github pr: https://github.com/consuelohq/opensaas/pull/2106
started: 2026-08-16

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

- 2026-08-16 02:56:11 fs.write: `.task/os/sync-os-stream-with-main-after-worker-drain-fix/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:00:03 `review.run`: passed — OK
- 2026-08-16 03:00:04 `review.run`: passed — OK
- 2026-08-16 03:02:02 `verify`: passed — OK

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

## Test-first contract

behavior under test: current `stream/os` behavior, including the worker-drain continuity fix, and current `main` behavior must both survive ancestry synchronization.
existing local pattern: isolated task from `stream/os`, merge current `main`, resolve only true semantic conflicts, run the affected existing lifecycle/MCP/docs gates, then merge this task back to the stream.
new or changed tests: none intended; this task introduces no independent product behavior.
focused red command: not applicable before the ancestry merge.
expected red failure: any failure after the merge indicates a semantic conflict that must be resolved before publishing the sync.
no-test waiver: synchronization-only task; existing focused lifecycle/MCP/docs tests, strict review, and verify are mandatory after the merge.

- 2026-08-16 02:56:11 append: `.task/os/sync-os-stream-with-main-after-worker-drain-fix/workpad.md`
