# add operator trace watch script

branch: `task/workspace-agents/add-operator-trace-watch-script`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/519/add-operator-trace-watch-script
github pr: https://github.com/consuelohq/opensaas/pull/519
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `package.json`
- `scripts/operator/trace-watch.ts`

## workspace-owned: files changed

- `package.json`
- `scripts/operator/trace-watch.ts`

## workspace-owned: activity log

- 2026-05-23 09:34:50 fs.write: `scripts/operator/trace-watch.ts`
- 2026-05-23 09:35:19 fs.patch: `package.json`
- 2026-05-23 09:36:32 fs.patch: `scripts/operator/trace-watch.ts`
- 2026-05-23 09:36:56 fs.patch: `scripts/operator/trace-watch.ts`
- 2026-05-23 09:37:22 fs.patch: `scripts/operator/trace-watch.ts`
- 2026-05-23 09:37:57 fs.patch: `scripts/operator/trace-watch.ts`
- 2026-05-23 09:42:52 fs.write: `.task/workspace-agents/add-operator-trace-watch-script/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 09:42:42 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-23 09:34:50 write: `scripts/operator/trace-watch.ts`

- 2026-05-23 09:35:19 patch lines 292-293: `package.json`

- 2026-05-23 09:36:32 patch lines 94-99: `scripts/operator/trace-watch.ts`

- 2026-05-23 09:36:56 patch lines 91-105: `scripts/operator/trace-watch.ts`

- 2026-05-23 09:37:22 patch lines 87-104: `scripts/operator/trace-watch.ts`

- 2026-05-23 09:37:57 patch lines 83-87: `scripts/operator/trace-watch.ts`

## final validation before publish

Files changed:

- `package.json`
- `scripts/operator/trace-watch.ts`

Implementation:

- Added `bun run trace:watch` as an operator-only Bun script.
- Default mode tails every new trace row from the local trace DB until Ctrl-C.
- Added filters for task session, branch, worktree text, tool, errors, since window, limit, interval, JSON lines, and no-color mode.
- Uses SQLite `rowid` for live following because trace `id` is textual.

Validation evidence:

- `bun run trace:watch -- --help`: passed.
- `bun scripts/operator/trace-watch.ts --once --limit 3 --no-color`: passed and rendered human-readable rows.
- `bun scripts/operator/trace-watch.ts --once --limit 2 --since 5m --no-color`: passed after fixing duration parsing.
- `bun run trace:watch -- --once --limit 2 --json`: passed and emitted JSONL rows.
- `bun run trace:watch -- --once --limit 1 --errors --no-color`: passed and filtered error rows.
- Long-running default mode was smoke-tested with a 2s Python timeout and stayed open until killed, as intended.
- `verify --base origin/stream/workspace-agents --no-review --no-db`: passed.

Issue encountered:

- `bun --check scripts/operator/trace-watch.ts` timed out at the caller boundary, so validation used direct script execution plus verify.

- 2026-05-23 09:42:52 append: `.task/workspace-agents/add-operator-trace-watch-script/workpad.md`
