# switch workspace tracing to langfuse

branch: `task/workspace-agents/switch-workspace-tracing-to-langfuse`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/401
started: 2026-05-20

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

## Langfuse workspace observability

- [x] Explored existing LangSmith wrapper in `packages/workspace/server.py`.
- [x] Checked current Langfuse SDK docs for `get_client`, `start_as_current_observation`, and `propagate_attributes`.
- [x] Keep local `context.trace` SQLite as fallback/local truth.
- [ ] Replace default remote provider with Langfuse and keep LangSmith only behind explicit provider flag.
- [ ] Update docs, requirements, and tests.
