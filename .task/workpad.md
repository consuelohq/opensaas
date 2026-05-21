# keep workspace server responsive during long tool calls

branch: `task/workspace-agents/keep-workspace-server-responsive-during-long-tool-calls`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/437/keep-workspace-server-responsive-during-long-tool-calls
github pr: https://github.com/consuelohq/opensaas/pull/437
started: 2026-05-21

## acceptance criteria

- [x] Identify why workspace health and simple calls time out while another agent runs long workspace work.
- [x] Keep the MCP server event loop responsive while `workspace.call` executes long blocking facade commands.
- [x] Keep steering reads from blocking unrelated HTTP/MCP requests.
- [x] Add focused regression coverage for async/off-loop workspace call behavior.
- [x] Validate Python syntax and focused server-call tests.

## plan

1. Inspect workspace traces, doctor output, process state, health endpoint behavior, and server implementation.
2. Confirm whether concurrent long-running agent calls correlate with health and bootstrap timeouts.
3. Patch the MCP tool entrypoints so blocking steering and facade execution run in a worker thread.
4. Update tests to call async tool entrypoints and prove the event loop remains free while workspace execution blocks.
5. Validate with Python syntax checks and server-call unit tests.

## files changed

- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## key decisions

- The timeout pattern is primarily a server responsiveness issue, not just a large steering payload issue.
- `workspace.call` used synchronous `subprocess.run(...)` under the MCP server. Long calls such as `verify`, `review.run`, and `batch` can monopolize the server event loop and starve `/health`, `get_steering`, and other agents.
- The simplest correct fix is to keep the existing synchronous facade implementation and run it through `asyncio.to_thread(...)` from the MCP tool entrypoint. This preserves existing behavior and moves blocking work off the async request loop.
- `get_steering` also runs through `asyncio.to_thread(...)` so the large steering read/trace path does not block unrelated requests.
- No documentation update was required because the public contract of `workspace.get_steering()` and `workspace.call(...)` is unchanged. The implementation now preserves the existing contract under concurrency.

## notes for Ko

- Live daemon health currently times out on `http://127.0.0.1:8850/health` even though Python is listening on port 8850. This task patches the code path, but the running daemon will need to be updated/restarted after merge before live health improves.
- Traces showed another active agent running long workspace work on `task/workspace-agents/remove-stale-task-pin-prose-from-steering`; this supports the concurrency hypothesis.
- `doctor` also found stale root `.task/current.json` and `.task/verify.json` on `main`. That is a separate hygiene issue that can confuse fallback tooling, but the blocking server loop is the main timeout root cause found here.
- `stream/workspace-agents` was behind origin during investigation. This task started from `main` to avoid stacking on unstable stream state.

## improvements noticed

- The workspace daemon LaunchDaemon showed repeated restarts and `last exit code = 78: EX_CONFIG`; logs are permission denied to normal read tools. That should be investigated separately if daemon health remains flaky after this patch lands.
- There is a malformed task session metadata file under an old `stream-os-sync-wre1Oe` worktree. Many calls warn about `JSON Parse error: Unrecognized token '<'`. That cleanup is separate from this responsiveness fix.
- The Railway doctor check uses `railway status --service opensaas`, but the installed Railway CLI rejects `--service` for `status`.

## errors i ran into

- `status` and `doctor` initially surfaced as ChatGPT tool timeouts, but trace rows later showed the workspace commands completed quickly. That suggests response transport/server starvation rather than command failure.
- `curl` to `/health` timed out with zero bytes while Python listened on port 8850.
- Running server-call tests with `/usr/bin/python3` failed because system Python cannot parse `str | None` annotations in `tools/sandbox.py`. Re-running with `/opt/homebrew/bin/python3` matched the daemon runtime and passed.

## validation commands and results

- `/opt/homebrew/bin/python3 -m py_compile packages/workspace/server.py packages/workspace/tests/server_call_test.py` — passed.
- `/opt/homebrew/bin/python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_call_runs_workspace_execution_off_event_loop packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_get_steering_reads_full_steering_each_call` — passed.
- `/opt/homebrew/bin/python3 -m unittest packages.workspace.tests.server_call_test` — passed, 29 tests.
- `git diff -- packages/workspace/server.py packages/workspace/tests/server_call_test.py` — reviewed; only async off-loop server/tool entrypoint changes and tests.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): keep server responsive during long tool calls" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-21 09:28:58 write: `.task/workpad.md`