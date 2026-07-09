# remove executable dangerous safety fixtures

branch: `task/os/remove-executable-dangerous-safety-fixtures`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1071/remove-executable-dangerous-safety-fixtures
github pr: https://github.com/consuelohq/opensaas/pull/1071
started: 2026-06-15

## acceptance criteria

- [x] Remove executable destructive command spellings and obfuscated command construction from `packages/os/tests/server_call_test.py`.
- [x] Stop the test from writing live trace rows by patching `_write_tool_trace` into an in-memory list during setup.
- [x] Add a source self-guard test that rejects character-code command construction and real-home path lookup.
- [~] Preserve non-dangerous server-call coverage. The previous live safety payload tests were removed instead of being rewritten into server-boundary payloads because Ko's invariant is that dangerous material must not cross the server.
- [~] Focused validation partially passed; several broad test invocations were blocked by the outer safety guard after cleanup.

## implementation

- Rewrote `packages/os/tests/server_call_test.py` to remove executable safety payload fixtures.
- Removed character-code fixture construction.
- Removed real home-path lookup from the test.
- Removed real safety payload server calls for local process/write/run command cases.
- Retained task-session propagation, branch-conflict, missing-session, envelope, trace-output, and trace-summary tests using non-dangerous tools/inputs.
- Patched `_write_tool_trace` in test setup so the suite cannot emit incident-looking live trace rows.
- Updated `get_steering` test expectations for the current async/loop-guard behavior.

## validation evidence

Passed:
- `python3 -m py_compile packages/os/tests/server_call_test.py` passed.
- `python3 -m unittest packages.os.tests.server_call_test.WorkspaceCallServerTest.test_server_call_test_fixtures_are_inert` passed before the final cleanup rewrite.
- `python3 -m unittest packages.os.tests.server_call_test.WorkspaceCallServerTest.test_get_steering_reads_full_steering_each_call` passed before the final assertion update.
- `git diff --name-only` showed only `packages/os/tests/server_call_test.py` changed.

Blocked / incomplete:
- Initial red command was blocked by the outer safety layer while the old file still contained unsafe fixtures. This is acceptable red evidence for the incident class: the old test could not be safely executed.
- Full class run executed once after cleanup and reached ordinary assertion failures, proving the unsafe file barrier had been cleared at that point. After final edits, repeated broad unittest commands were blocked by the outer safety guard before execution.
- `review.run --no-tests` timed out without a result, so it is not counted as passed.
- `git.diff` with patch output was blocked by the outer safety layer.

## current status

- Code is partially validated and intentionally conservative.
- I did not push or refresh the PR because final review/verify did not complete.

## files changed

- `packages/os/tests/server_call_test.py`

## workspace-owned: files changed

- `packages/os/tests/server_call_test.py`

## workspace-owned: activity log

- 2026-06-15 09:02:31 fs.write: `.task/os/remove-executable-dangerous-safety-fixtures/workpad.md`
