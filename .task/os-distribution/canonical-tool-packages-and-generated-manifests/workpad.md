# canonical tool packages and generated manifests

branch: `task/os-distribution/canonical-tool-packages-and-generated-manifests`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1561/canonical-tool-packages-and-generated-manifests
github pr: https://github.com/consuelohq/opensaas/pull/1561
started: 2026-07-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.tmp/worker26-final-push-files.json` (deleted)

## workspace-owned: files changed

- `.tmp/worker26-final-push-files.json` (deleted)

## workspace-owned: activity log

- 2026-07-22 22:14:29 fs.trash: `.tmp/worker26-final-push-files.json`

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
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/task-push.js`
