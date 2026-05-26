# render trace watch time in eastern

branch: `task/workspace-agents/render-trace-watch-time-in-eastern`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/530/render-trace-watch-time-in-eastern
github pr: https://github.com/consuelohq/opensaas/pull/530
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

- 2026-05-23 10:34:35 fs.write: `.task/workspace-agents/render-trace-watch-time-in-eastern/workpad.md`
- 2026-05-23 10:35:31 fs.write: `.task/workspace-agents/render-trace-watch-time-in-eastern/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 10:35:24 `verify`: passed — OK

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

Acceptance criteria: render `trace:watch` timestamps in America/New_York local time using 24-hour HH:mm:ss format, keep JSON mode unchanged, validate output.

Plan: add a dedicated timestamp formatter, replace raw UTC slicing, run bounded human/JSON checks, verify, push, and promote.

- 2026-05-23 10:34:35 append: `.task/workspace-agents/render-trace-watch-time-in-eastern/workpad.md`

## final validation

Files changed:

- `scripts/operator/trace-watch.ts`

Implementation:

- Added `fmtTraceTime()` using `Intl.DateTimeFormat` with `timeZone: "America/New_York"` and `hour12: false`.
- Human `trace:watch` timestamps now render as Eastern 24-hour `HH:mm:ss`.
- JSON mode remains unchanged and still emits raw trace rows.

Validation evidence:

- `bun run trace:watch -- --once --limit 3 --no-color`: passed and rendered rows like `06:34:35`, matching Eastern time for `10:34:35Z`.
- `bun run trace:watch -- --once --limit 1 --json`: passed and emitted raw JSON.
- `verify --base origin/stream/workspace-agents --no-review --no-db`: passed.

- 2026-05-23 10:35:31 append: `.task/workspace-agents/render-trace-watch-time-in-eastern/workpad.md`
