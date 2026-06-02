# unify worker events into trace db

branch: `task/workspace-agents/unify-worker-events-into-trace-db`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/659/unify-worker-events-into-trace-db
github pr: https://github.com/consuelohq/opensaas/pull/659
started: 2026-05-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/lib/worker/runtime.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `scripts/operator/trace-watch.ts`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/worker/runtime.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `scripts/operator/trace-watch.ts`

## workspace-owned: activity log

- 2026-05-31 10:31:52 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/patch_runtime.py`
- 2026-05-31 10:32:58 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/fix_runtime_sqlite_import.py`
- 2026-05-31 10:33:32 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/patch_tests.py`
- 2026-05-31 10:33:59 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-31 10:34:38 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/test_insert.txt`
- 2026-05-31 10:34:44 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-31 10:35:00 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/test_block_fixed.txt`
- 2026-05-31 10:35:12 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-31 10:35:39 fs.patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-05-31 10:36:29 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/trace_watch_detail.txt`
- 2026-05-31 10:36:39 fs.patch: `scripts/operator/trace-watch.ts`
- 2026-05-31 10:36:55 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/trace_watch_return.txt`
- 2026-05-31 10:36:59 fs.patch: `scripts/operator/trace-watch.ts`
- 2026-05-31 10:42:56 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/type_safety_runtime.txt`
- 2026-05-31 10:43:03 fs.patch: `packages/workspace/scripts/lib/worker/runtime.ts`
- 2026-05-31 10:43:18 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/provider_and_trace_types.txt`
- 2026-05-31 10:43:25 fs.patch: `packages/workspace/scripts/lib/worker/runtime.ts`
- 2026-05-31 10:43:40 fs.write: `.task/workspace-agents/unify-worker-events-into-trace-db/context_provider_trace_types.txt`
- 2026-05-31 10:43:50 fs.patch: `packages/workspace/scripts/lib/worker/runtime.ts`
- 2026-05-31 10:44:30 fs.patch: `packages/workspace/scripts/lib/worker/runtime.ts`
- 2026-05-31 10:44:39 fs.patch: `packages/workspace/scripts/lib/worker/runtime.ts`

## workspace-owned: validation evidence

- 2026-05-31 10:42:37 `review.run`: passed — OK
- 2026-05-31 10:44:15 `review.run`: passed — OK
- 2026-05-31 10:45:03 `review.run`: passed — OK
- 2026-05-31 10:45:39 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/workspace/package.json`
- `packages/workspace/scripts/context.js`
- `packages/workspace/scripts/lib/facade/logger.ts`
- `packages/workspace/scripts/lib/worker/runtime.ts`
- `packages/workspace/server.py`
- `packages/workspace/tests/facade/facade.test.ts`
- `scripts/operator/trace-watch.ts`

- 2026-05-31 10:44:30 patch lines 1220-1220: `packages/workspace/scripts/lib/worker/runtime.ts`

- 2026-05-31 10:44:39 patch lines 1253-1253: `packages/workspace/scripts/lib/worker/runtime.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/unify-worker-events-into-trace-db.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/context_provider_trace_types.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/current.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/evidence-log.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/fix_runtime_sqlite_import.py`, `.task/workspace-agents/unify-worker-events-into-trace-db/patch_runtime.py`, `.task/workspace-agents/unify-worker-events-into-trace-db/patch_tests.py`, `.task/workspace-agents/unify-worker-events-into-trace-db/provider_and_trace_types.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/read-log.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/session.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/test_block_fixed.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/test_insert.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/trace_watch_detail.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/trace_watch_return.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/type_safety_runtime.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/workpad.md`, `packages/workspace/scripts/lib/worker/runtime.ts`, `packages/workspace/tests/facade/facade.test.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `trace-watch`
- selected suites: `trace watch build`
- run results: `trace watch build` passed
- failed suites: none
