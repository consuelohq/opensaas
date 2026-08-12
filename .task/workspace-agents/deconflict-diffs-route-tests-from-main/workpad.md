# deconflict Diffs route tests from main

branch: `task/workspace-agents/deconflict-diffs-route-tests-from-main`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1883/deconflict-diffs-route-tests-from-main
github pr: https://github.com/consuelohq/opensaas/pull/1883
started: 2026-08-12

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

- 2026-08-12 04:41:23 fs.write: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`
- 2026-08-12 04:44:15 fs.write: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Goal: remove remaining stream/main textual conflicts without changing production behavior.
- Production merge is already clean; only two shared test files conflict.
- Strategy: restore those shared tests to current `main` and preserve Diffs-specific coverage in a dedicated non-conflicting contract test.
- Installed Consuelo OS remains untouched; no update/restart/deploy in this task.

- 2026-08-12 04:41:23 append: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`

## merge reconciliation

- `main` was merged into this clean task worktree with `--no-commit --no-ff`; only two test files conflicted. Production files auto-merged cleanly.
- Resolved both test conflicts as current-main coverage plus the Diffs-specific gateway assertions: `/diffs` is authenticated gateway-backed, not a static snapshot; private Site assertions from main remain intact.
- No installed-runtime mutation: no `consuelo update`, restart, release-channel change, or deployment was run.

## validation evidence

- Focused merge-resolution packet: install-edge publisher + route seed + Sites/Gateway integration + Diffs Hono + source-control config + Diffs adapter -> 46 pass / 0 fail / 281 assertions.
- This task is an ancestry-preserving main-to-stream sync; the only manual conflict resolutions are test contracts.

- 2026-08-12 04:44:15 append: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`
