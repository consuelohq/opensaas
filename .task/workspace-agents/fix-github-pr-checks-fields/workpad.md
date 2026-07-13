# fix github pr checks fields

branch: `task/workspace-agents/fix-github-pr-checks-fields`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/477/fix-github-pr-checks-fields
github pr: https://github.com/consuelohq/opensaas/pull/477
started: 2026-05-23

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

- 2026-05-23 03:40:16 patch lines 16-16: `packages/workspace/scripts/github.js`