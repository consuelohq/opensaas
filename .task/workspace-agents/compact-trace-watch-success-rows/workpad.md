# compact trace watch success rows

branch: `task/workspace-agents/compact-trace-watch-success-rows`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/529/compact-trace-watch-success-rows
github pr: https://github.com/consuelohq/opensaas/pull/529
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

- 2026-05-23 10:24:30 fs.write: `.task/workspace-agents/compact-trace-watch-success-rows/workpad.md`
- 2026-05-23 10:25:38 fs.write: `.task/workspace-agents/compact-trace-watch-success-rows/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 10:25:30 `verify`: passed — OK

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

Acceptance criteria: make successful `trace:watch` rows one-line human summaries, suppress raw JSON command envelopes in human mode, keep error rows readable with a second-line error detail, preserve JSON mode.

Plan: update detail extraction/rendering in `scripts/operator/trace-watch.ts`, run bounded human and JSON checks, verify, push, and promote.

- 2026-05-23 10:24:30 append: `.task/workspace-agents/compact-trace-watch-success-rows/workpad.md`

## final validation

Files changed:

- `scripts/operator/trace-watch.ts`

Implementation:

- Successful human rows now render as one-line summaries with `| command completed` style detail.
- Human success rows suppress raw JSON command envelopes.
- Error rows still render the failure code on the first line and the best failure message on the second line.
- JSON mode remains unchanged.

Validation evidence:

- `bun run trace:watch -- --once --limit 4 --no-color`: passed and showed one-line success rows.
- `bun run trace:watch -- --once --limit 1 --errors --no-color`: passed and showed two-line error detail.
- `bun run trace:watch -- --once --limit 1 --json`: passed and emitted JSON.
- `verify --base origin/stream/workspace-agents --no-review --no-db`: passed.

- 2026-05-23 10:25:38 append: `.task/workspace-agents/compact-trace-watch-success-rows/workpad.md`
