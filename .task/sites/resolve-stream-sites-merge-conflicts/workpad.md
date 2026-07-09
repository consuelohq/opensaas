# Resolve stream sites merge conflicts

branch: `task/sites/resolve-stream-sites-merge-conflicts`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1086/resolve-stream-sites-merge-conflicts
github pr: https://github.com/consuelohq/opensaas/pull/1086
started: 2026-06-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/package.json`

## workspace-owned: files changed

- `packages/workspace/package.json`

## workspace-owned: activity log

- 2026-06-16 17:37:15 fs.patch: `packages/workspace/package.json`

## workspace-owned: validation evidence

- none yet

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
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-16 17:37:15 patch lines 53-58: `packages/workspace/package.json`
