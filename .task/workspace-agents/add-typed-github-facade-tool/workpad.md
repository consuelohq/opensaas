# add typed github facade tool

branch: `task/workspace-agents/add-typed-github-facade-tool`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/447/add-typed-github-facade-tool
github pr: https://github.com/consuelohq/opensaas/pull/447
started: 2026-05-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-22 04:24:10 write: `packages/workspace/SCRIPTS.md`
- 2026-05-22 04:25:44 write: `packages/workspace/scripts/task-start.js`