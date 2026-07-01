# fix trace home review comments

branch: `task/workspace/fix-trace-home-review-comments`
stream: `stream/workspace`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/697/fix-trace-home-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/697
started: 2026-06-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/trace-home/cli.ts`
- `packages/workspace/scripts/trace-home/command-quality.ts`
- `packages/workspace/scripts/trace-home/db.ts`
- `packages/workspace/scripts/trace-home/model.ts`
- `packages/workspace/scripts/trace-home/tui/app.ts`
- `packages/workspace/scripts/trace-home/tui/state.ts`
- `packages/workspace/tests/trace-home.test.ts`

## workspace-owned: files changed

- `packages/workspace/scripts/trace-home/cli.ts`
- `packages/workspace/scripts/trace-home/command-quality.ts`
- `packages/workspace/scripts/trace-home/db.ts`
- `packages/workspace/scripts/trace-home/model.ts`
- `packages/workspace/scripts/trace-home/tui/app.ts`
- `packages/workspace/scripts/trace-home/tui/state.ts`
- `packages/workspace/tests/trace-home.test.ts`

## workspace-owned: activity log

- 2026-06-02 06:36:09 fs.write: `packages/workspace/scripts/trace-home/db.ts`
- 2026-06-02 06:36:21 fs.write: `packages/workspace/scripts/trace-home/command-quality.ts`
- 2026-06-02 06:36:36 fs.write: `packages/workspace/scripts/trace-home/tui/state.ts`
- 2026-06-02 06:36:55 fs.write: `packages/workspace/scripts/trace-home/tui/app.ts`
- 2026-06-02 06:37:19 fs.write: `packages/workspace/scripts/trace-home/cli.ts`
- 2026-06-02 06:37:39 fs.write: `packages/workspace/scripts/trace-home/model.ts`
- 2026-06-02 06:38:09 fs.write: `packages/workspace/tests/trace-home.test.ts`
- 2026-06-02 06:56:03 fs.write: `packages/workspace/scripts/trace-home/tui/app.ts`

## workspace-owned: validation evidence

- 2026-06-02 06:39:09 `review.run`: passed — OK
- 2026-06-02 06:56:41 `review.run`: passed — OK

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
bun run task:push -- --message "type(workspace): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `package.json`
- `packages/workspace/scripts/trace-home/cli.ts`
- `packages/workspace/scripts/trace-home/command-quality.ts`
- `packages/workspace/scripts/trace-home/db.ts`
- `packages/workspace/scripts/trace-home/model.ts`
- `packages/workspace/scripts/trace-home/tui/app.ts`
- `packages/workspace/scripts/trace-home/tui/keymap.ts`
- `packages/workspace/scripts/trace-home/tui/state.ts`
- `packages/workspace/scripts/trace-home/types.ts`
- `packages/workspace/tests/trace-home.test.ts`
- `scripts/operator/trace-home.ts`

- 2026-06-02 06:56:03 write: `packages/workspace/scripts/trace-home/tui/app.ts`
