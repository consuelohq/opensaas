# add context trace sqlite store

branch: `task/workspace-agents/add-context-trace-sqlite-store`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/398
started: 2026-05-13

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

## context.trace SQLite implementation

- [x] Store local raw workspace tool traces in a repo-scoped SQLite database outside the repo.
- [x] Use `OPENWORKSPACE_TRACE_DB` override and 500 MB default `OPENWORKSPACE_TRACE_DB_MAX_BYTES` cap.
- [x] Add `context.trace` filters over typed indexed fields and raw payload expansion.
- [ ] Regenerate docs/types and run focused tests.

- 2026-05-13 12:25:02 patch lines 448-456: `packages/workspace/scripts/context.js`