# polish trace watch output

branch: `task/workspace-agents/polish-trace-watch-output`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/525/polish-trace-watch-output
github pr: https://github.com/consuelohq/opensaas/pull/525
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `scripts/operator/trace-watch.ts`

## workspace-owned: files changed

- `scripts/operator/trace-watch.ts`

## workspace-owned: activity log

- 2026-05-23 10:04:10 fs.write: `.task/workspace-agents/polish-trace-watch-output/workpad.md`
- 2026-05-23 10:04:40 fs.write: `scripts/operator/trace-watch.ts`
- 2026-05-23 10:05:34 fs.write: `.task/workspace-agents/polish-trace-watch-output/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 10:05:26 `verify`: passed — OK

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

Acceptance criteria: polish `trace:watch` human output, keep JSON unchanged, validate, and promote.

Plan: copy the validated polish from the prior local task worktree, run bounded human/JSON/live smoke checks, verify, push, and promote.

- 2026-05-23 10:04:10 append: `.task/workspace-agents/polish-trace-watch-output/workpad.md`

- 2026-05-23 10:04:40 write: `scripts/operator/trace-watch.ts`

## final validation

Files changed:

- `scripts/operator/trace-watch.ts`

Validation evidence:

- `bun run trace:watch -- --once --limit 2 --no-color`: passed and showed spelled-out tokens, two-space detail indentation, and dotted dividers.
- Long-running mode with `--limit 1 --no-color` was smoke-tested through a 5s timeout and printed the startup header with flag reminders before staying open.
- Direct `bun scripts/operator/trace-watch.ts --once --limit 1 --json`: passed and emitted JSON only.
- `verify --base origin/stream/workspace-agents --no-review --no-db`: passed.

Issue and recovery:

- The prior task branch had already been merged and deleted remotely, so this follow-up task was created from the current stream and the validated polished script was copied through a temp file plus `contentFile`.

- 2026-05-23 10:05:34 append: `.task/workspace-agents/polish-trace-watch-output/workpad.md`
