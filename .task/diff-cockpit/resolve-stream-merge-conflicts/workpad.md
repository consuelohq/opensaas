# resolve stream merge conflicts

branch: `task/diff-cockpit/resolve-stream-merge-conflicts`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/853/resolve-stream-merge-conflicts
github pr: https://github.com/consuelohq/opensaas/pull/853
started: 2026-06-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/twenty-shared/src/constants/DocumentationPaths.ts`

## workspace-owned: files changed

- `packages/twenty-shared/src/constants/DocumentationPaths.ts`

## workspace-owned: activity log

- 2026-06-08 22:51:39 fs.patch: `packages/twenty-shared/src/constants/DocumentationPaths.ts`

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
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/twenty-shared/src/constants/DocumentationPaths.ts`
