# remove worker trace temp helper files

branch: `task/workspace-agents/remove-worker-trace-temp-helper-files`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/662/remove-worker-trace-temp-helper-files
github pr: https://github.com/consuelohq/opensaas/pull/662
started: 2026-05-31

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

- none yet

## workspace-owned: validation evidence

- 2026-05-31 10:50:09 `verify`: failed — COMMAND_FAILED
- 2026-05-31 10:50:09 `verify`: failed — COMMAND_FAILED
- 2026-05-31 10:50:09 `verify`: failed — COMMAND_FAILED

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

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/remove-worker-trace-temp-helper-files.json`, `.task/workspace-agents/remove-worker-trace-temp-helper-files/current.json`, `.task/workspace-agents/remove-worker-trace-temp-helper-files/session.json`, `.task/workspace-agents/remove-worker-trace-temp-helper-files/workpad.md`, `.task/workspace-agents/unify-worker-events-into-trace-db/context_provider_trace_types.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/fix_runtime_sqlite_import.py`, `.task/workspace-agents/unify-worker-events-into-trace-db/patch_runtime.py`, `.task/workspace-agents/unify-worker-events-into-trace-db/patch_tests.py`, `.task/workspace-agents/unify-worker-events-into-trace-db/provider_and_trace_types.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/test_block_fixed.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/test_insert.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/trace_watch_detail.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/trace_watch_return.txt`, `.task/workspace-agents/unify-worker-events-into-trace-db/type_safety_runtime.txt`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed files are docs or task metadata
