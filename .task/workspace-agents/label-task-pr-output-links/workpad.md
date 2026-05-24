# label task pr output links

branch: `task/workspace-agents/label-task-pr-output-links`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/576/label-task-pr-output-links
github pr: https://github.com/consuelohq/opensaas/pull/576
started: 2026-05-24

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/task-pr.js`

## workspace-owned: files changed

- `packages/workspace/scripts/task-pr.js`

## workspace-owned: activity log

- 2026-05-24 07:05:40 fs.patch: `packages/workspace/scripts/task-pr.js`

## workspace-owned: validation evidence

- 2026-05-24 07:06:42 `verify`: passed — OK

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

- 2026-05-24 07:05:40 patch lines 635-635: `packages/workspace/scripts/task-pr.js`
