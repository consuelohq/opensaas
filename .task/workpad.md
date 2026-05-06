# DEV-1500 replace sandbox_exec with workspace.call

branch: `task/workspace-agents/dev-1500-replace-sandbox-exec-with-workspace-call`
stream: `stream/workspace-agents`
linear: DEV-1500
task pr: https://github.com/consuelohq/opensaas/pull/336
started: 2026-05-06

## acceptance criteria

- [ ] Replace the normal MCP operation surface from `sandbox_exec` to `workspace.call`.
- [ ] Make `get_steering` bootstrap-only and idempotent.
- [ ] Add task-session-backed task context for task-scoped calls.
- [ ] Make `batch` first-class under `workspace.call` with task context propagation.
- [ ] Update steering, scripts docs, generated tool docs/types, schemas, manifest, and facade tests.
- [ ] Validate the end-to-end task lifecycle through the new call surface.

## plan

1. Inspect current MCP server, sandbox wrapper, facade executor, branch resolver, batch runner, schemas, manifest, and docs.
2. Replace the MCP boundary so typed calls dispatch through the existing facade instead of shell-wrapped commands.
3. Add durable task session creation/resolution and tmux-backed metadata.
4. Propagate `taskSession` into batch children and lifecycle commands.
5. Update documentation/generated surfaces and tests.
6. Run focused syntax checks, facade tests, review, verify, push, and promote to the stream review PR.

## files changed

- `packages/workspace/server.py`

## key decisions

- `packages/workspace/server.py` is the current MCP registration point. It exposed `get_steering` and `sandbox_exec`.
- The existing typed facade path is `packages/workspace/scripts/lib/facade/executor.ts`, called by `packages/workspace/scripts/tool-runner.ts`.
- The first patch changes the server boundary only: it exposes `call`, removes the server import/use of `tools.sandbox`, routes through `bun scripts/workspace.ts`, and makes repeated `get_steering` return `ALREADY_LOADED`.
- Added `packages/workspace/scripts/lib/task-session.js` as the tmux/session owner. It creates deterministic `taskSession` handles, sanitized tmux session names, tmux sessions rooted at the task worktree, and `.task/session.json`.
- Wired `task-start.js` to create tmux-backed task sessions and include `taskSession`/`tmuxSession` in `.task/current.json`, task history, and task-start output.
- `task-exec.js` now passes both `TASK_BRANCH` and `TASK_WORKTREE` into child commands.
- `server.py` now rejects task-scoped `workspace.call` calls without `taskSession`, while allowing explicit `input.branch` as the compatibility escape hatch.

## notes for ko

- This is partial implementation, not ready for review.
- Code read confirmed tmux belongs at `task-start.js`: it already owns branch/worktree/PR/current metadata/workpad creation.
- The current live MCP server still exposes `sandbox_exec` until the patched server is deployed/restarted.
- Direct import smoke for `server.py` failed in this shell because `uvicorn` is missing from the local Python environment. Syntax compilation passed.

## improvements noticed

- The active workspace command surface is fragile for large inline Python/task.exec commands. `mac.exec` with base64 positional payload was the safest workaround for this edit.
- The decision-engine query was blocked by the tool safety filter when it included the issue wording; narrower exploration then hit intermittent MCP network failures.

## errors or blockers

- `workspace explore` was blocked by safety checks for DEV-1500 wording.
- One narrowed `workspace explore` call and one branch-scoped batch read failed with `mcp_network_error`.
- `workspace task.exec` with nested shell/Python payloads produced `workspace commands accept at most one JSON input argument`.
- Direct Python import smoke failed with `ModuleNotFoundError: No module named 'uvicorn'`.

## validation

- `python3 -m py_compile packages/workspace/server.py` passed.
- `git diff -- packages/workspace/server.py` was inspected.
- `node --check packages/workspace/scripts/lib/task-session.js` passed.
- `node --check packages/workspace/scripts/task-start.js` passed.
- `node --check packages/workspace/scripts/task-exec.js` passed.
- Smoke-created `.task/session.json` for the current task with `taskSession=tsk_12cf9dfeaa9f`; tmux session creation succeeded.
- Direct `server.py` behavior smoke is still blocked by missing local Python packages (`starlette` after `uvicorn` was mocked).
