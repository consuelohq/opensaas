# add workspace tool surface recovery steering

branch: `task/workspace-agents/add-workspace-tool-surface-recovery-steering`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/638/add-workspace-tool-surface-recovery-steering
github pr: https://github.com/consuelohq/opensaas/pull/638
started: 2026-05-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/STEERING.md`

## workspace-owned: files changed

- `packages/workspace/STEERING.md`

## workspace-owned: activity log

- 2026-05-29 00:57:21 fs.patch: `packages/workspace/STEERING.md`
- 2026-05-29 00:57:37 fs.patch: `packages/workspace/STEERING.md`
- 2026-05-29 00:57:53 fs.patch: `packages/workspace/STEERING.md`

## workspace-owned: validation evidence

- 2026-05-29 00:58:22 `audit`: failed — COMMAND_FAILED
- 2026-05-29 01:01:37 `review.run`: passed — OK
- 2026-05-29 01:01:41 `review.run`: passed — OK
- 2026-05-29 01:01:42 `review.run`: passed — OK
- 2026-05-29 01:01:43 `review.run`: passed — OK
- 2026-05-29 01:03:37 `verify`: failed — COMMAND_FAILED
- 2026-05-29 01:03:37 `verify`: failed — COMMAND_FAILED

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

- 2026-05-29 00:57:21 patch lines 897-897: `packages/workspace/STEERING.md`

- 2026-05-29 00:57:37 patch lines 910-910: `packages/workspace/STEERING.md`

- 2026-05-29 00:57:53 patch lines 911-911: `packages/workspace/STEERING.md`
