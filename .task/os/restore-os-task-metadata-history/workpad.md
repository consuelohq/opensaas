# restore os task metadata history

branch: `task/os/restore-os-task-metadata-history`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/702/restore-os-task-metadata-history
github pr: https://github.com/consuelohq/opensaas/pull/702
started: 2026-06-02

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

- 2026-06-02 19:13:36 fs.write: `.task/os/restore-os-task-metadata-history/workpad.md`
- 2026-06-02 19:15:50 fs.write: `.task/os/restore-os-task-metadata-history/workpad.md`

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```


## goal

Restore `.task` history metadata that was over-pruned in `task/os/prune-non-os-changes-from-stream-os` while preserving the source-code cleanup.

Ko clarified that `.task` is a history book and should stay in the stream even if it looks noisy, because it records completed work and open work.

Safety:
- Pre-prune stream backup exists at `backup/os-stream-pre-prune-20260602`.
- Restore only `.task` metadata from backup/main comparison; do not restore `packages/workspace`, frontend, design, or unrelated source-code changes.

Acceptance criteria:
- Restore the `.task` metadata that existed before pruning.
- Keep final PR source-code categories pruned: no `packages/workspace/**`, `packages/consuelo-design/**`, `areas/consuelo-design/**`, `packages/twenty-front/**`, `packages/twenty-shared/**`, `agent-browser.json`, or unrelated server paths.
- Confirm final stream diff has OS runtime/docs plus `.task` history only.
- Validate bootstrap/help/dry-run still passes.

- 2026-06-02 19:13:36 append: `.task/os/restore-os-task-metadata-history/workpad.md`


## result

Restored `.task` history metadata from `backup/os-stream-pre-prune-20260602` after Ko clarified that `.task` is intentional historical/task context and should remain even if noisy.

Restored:
- root `.task/evidence-log.json`, `.task/explore-state.json`, `.task/read-log.json`
- historical `.task/os/**` workpads/session/current/evidence/read/verify files
- historical `.task/tasks/os/**` task registry files
- this task's own metadata: `.task/os/restore-os-task-metadata-history/**` and `.task/tasks/os/restore-os-task-metadata-history.json`

Kept pruned:
- `packages/workspace/**`
- `packages/consuelo-design/**`
- `areas/consuelo-design/**`
- `packages/twenty-front/**`
- `packages/twenty-shared/**`
- `agent-browser.json`
- unrelated server GraphQL/session/dialer paths

Final PR-equivalent category count before promotion:

```text
218 packages/os
84 .task/os
28 .task/tasks
22 packages/consuelo-docs
2 packages/twenty-server
2 packages/cli
1 .task/read-log.json
1 .task/explore-state.json
1 .task/evidence-log.json
359 total
```

Validation:

```bash
bad-path guard # no disallowed source paths
bash -n packages/os/scripts/bootstrap.sh
bash packages/os/scripts/bootstrap.sh --help
git diff --check
```

Notes:
- `.task` history is intentionally retained going forward.
- Source-code cleanup remains intact.

- 2026-06-02 19:15:50 append: `.task/os/restore-os-task-metadata-history/workpad.md`
