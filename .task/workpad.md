# improve langsmith workspace call trace summaries

branch: `task/workspace-agents/improve-langsmith-workspace-call-trace-summaries`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/346
started: 2026-05-08

## acceptance criteria

- [x] LangSmith run names for workspace.call include the called workspace tool name.
- [x] LangSmith input payloads expose scan-friendly fields: action, tool, taskSession, timeout, and inputSummary.
- [x] LangSmith output payloads expose scan-friendly summary, ok, code, tool, taskSession, tmuxSession, branch, and worktree when available.
- [x] Full tool input and result envelope remain available for click-through debugging.
- [x] Trace summaries truncate long command strings and avoid expanding huge payloads in list views.
- [x] Server tests cover trace input/output formatting helpers without requiring LangSmith network calls.

## plan

1. Add small trace formatting helpers in `packages/workspace/server.py`.
2. Route `_traced_call` through those helpers so workspace.call traces have dynamic names and scan-friendly input/output fields.
3. Preserve full raw input/result detail under nested fields.
4. Add focused server tests for call trace naming, input summary, output summary, batch summary, and truncation.
5. Run Python syntax and server tests.

## files changed

- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## key decisions

- LangSmith run names now use the called workspace tool name directly, for example `fs.read` or `task.exec`, instead of `workspace.call`.
- The trace input keeps full `tool_input` for click-through detail but adds scan-friendly `action` and `inputSummary` fields for the run table.
- The trace output keeps the full result envelope but lifts `summary`, `ok`, `code`, `tool`, `taskSession`, `tmuxSession`, `branch`, and `worktree` for scanning.

## notes for ko

- Batch array input is still blocked by the current MCP schema and remains out of scope for this task.
- Validation used Python 3.11 for the server test suite because the sandbox helper uses modern union type syntax.

## improvements noticed

- The default `python3` on this host cannot import `tools/sandbox.py` because it does not support `str | None`; tests should consistently use the configured Python 3.11 path.

## errors i ran into

- A first `task.exec` workpad update timed out because I passed a millisecond-level input timeout accidentally; the workpad update itself had already applied.
- `python3 packages/workspace/tests/server_call_test.py` fails on the host default Python due `str | None` parsing in `tools/sandbox.py`; `/Users/kokayi/.local/bin/python3.11 -m unittest packages/workspace/tests/server_call_test.py` passes.

## validation

- [x] `/Users/kokayi/.local/bin/python3.11 -m py_compile packages/workspace/server.py packages/workspace/tests/server_call_test.py`
- [x] `/Users/kokayi/.local/bin/python3.11 -m unittest packages/workspace/tests/server_call_test.py` — 21 tests pass
- [x] `workspace.call({ tool: "review.run", taskSession, input: { base: "stream/workspace-agents", noTests: true } })` — passed with yours: []

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```
