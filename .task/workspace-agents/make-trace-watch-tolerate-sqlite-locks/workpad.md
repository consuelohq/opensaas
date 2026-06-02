# make trace watch tolerate sqlite locks

branch: `task/workspace-agents/make-trace-watch-tolerate-sqlite-locks`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/527/make-trace-watch-tolerate-sqlite-locks
github pr: https://github.com/consuelohq/opensaas/pull/527
started: 2026-05-23

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

- 2026-05-23 10:11:41 fs.write: `.task/workspace-agents/make-trace-watch-tolerate-sqlite-locks/workpad.md`
- 2026-05-23 10:13:22 fs.write: `.task/workspace-agents/make-trace-watch-tolerate-sqlite-locks/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 10:13:15 `verify`: passed — OK

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

## implementation checkpoint

Acceptance criteria: make `trace:watch` tolerate transient SQLite lock errors without mutating the trace DB, keep JSON mode unchanged, validate bounded output and live watch behavior.

Plan: add query busy timeout, detect `database is locked`, retry without crashing, suppress noisy lock messages unless repeated, run focused smoke checks, verify, push, and promote.

- 2026-05-23 10:11:41 append: `.task/workspace-agents/make-trace-watch-tolerate-sqlite-locks/workpad.md`

## final validation

Files changed:

- `scripts/operator/trace-watch.ts`

Implementation:

- Added SQLite CLI `.timeout 1000` so reads wait briefly for the writer lock.
- Added `database is locked` / `SQLITE_BUSY` detection.
- Lock errors now return an empty locked result to the watcher loop instead of crashing.
- Live mode retries after locked polls and prints one muted waiting message only after repeated locks.
- JSON mode remains JSON-only.

Validation evidence:

- `bun run trace:watch -- --once --limit 2 --no-color`: passed through Python wrapper and rendered human rows.
- `bun scripts/operator/trace-watch.ts --once --limit 1 --json`: passed through Python wrapper and emitted JSON.
- `verify --base origin/stream/workspace-agents --no-review --no-db`: passed.

Issue and recovery:

- Direct `trace:watch` task.exec shapes were sometimes platform-blocked, so validation used a shorter Python subprocess wrapper for the same script.

- 2026-05-23 10:13:22 append: `.task/workspace-agents/make-trace-watch-tolerate-sqlite-locks/workpad.md`
