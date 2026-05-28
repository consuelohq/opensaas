# Recover Qwen3 2560 benchmark task

Task session: `tsk_0ce13ba96f69`
Branch: `task/workspace/recover-qwen3-2560-benchmark-task`
Task PR: #627
Stream: `stream/workspace`

## Goal

Recover the already-implemented Qwen3 4B/2560 benchmark infrastructure from the broken task metadata state and publish it through a clean task lifecycle.

## Context

The previous task branch `task/workspace/benchmark-qwen3-4b-2560-explore-index` successfully pushed the implementation commit and handoff commit, but `task.pr` became stuck on a workpad heuristic / stale task discovery issue after workspace outages. Ko approved using the override and then suggested starting a clean task and bringing the changes over.

Known commits to recover:

- `21f7a05ce22e18c3214beafc53145f9217f3fdc4` — `feat(workspace): support versioned 2560 embedding benchmark`
- `ace180717e77210eadfbe2221c0a0625c7bb8443` — `docs(workspace): update 2560 benchmark handoff`

## Acceptance criteria

- [ ] Bring over the implementation without unrelated task-metadata corruption.
- [ ] Preserve legacy 1024 index behavior.
- [ ] Keep 2560 benchmark index non-destructive and config-specific.
- [ ] Validate syntax, tests, audit, review, and verify against `origin/main`.
- [ ] Promote clean task into `stream/workspace` and return the stream review PR.
- [ ] Continue or resume 2560 index build if practical after publish path is clean.

## Plan

1. Cherry-pick the known good implementation commit(s) into this clean task.
2. Inspect diff and remove/avoid stale metadata from the old task if needed.
3. Rerun focused validation.
4. Push and promote this clean task.
5. Resume 2560 index build separately from the clean task lifecycle.

- 2026-05-28 22:35:30 write: `.task/workspace/recover-qwen3-2560-benchmark-task/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-28 22:35:30 fs.write: `.task/workspace/recover-qwen3-2560-benchmark-task/workpad.md`
- 2026-05-28 22:36:06 fs.trash: `.task/workspace/benchmark-qwen3-4b-2560-explore-index`
- 2026-05-28 22:36:11 fs.trash: `.task/tasks/workspace/benchmark-qwen3-4b-2560-explore-index.json`

## workspace-owned: validation evidence

- 2026-05-28 22:36:42 `audit`: passed — OK
- 2026-05-28 22:37:10 `review.run`: passed — OK
- 2026-05-28 22:37:24 `verify`: passed — OK
