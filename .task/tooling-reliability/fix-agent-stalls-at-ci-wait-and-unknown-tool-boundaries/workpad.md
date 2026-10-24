# fix agent stalls at CI wait and unknown tool boundaries

branch: `task/tooling-reliability/fix-agent-stalls-at-ci-wait-and-unknown-tool-boundaries`
stream: `stream/tooling-reliability`
pr: https://github.com/consuelohq/opensaas/pull/2592
started: 2026-09-26

## acceptance criteria

- [x] `task.merge({ wait: true })` must never hold an agent turn in the legacy 15-second Railway polling loop.
- [x] With `wait: true`, an open PR with pending GitHub checks returns a structured non-terminal/pending result quickly and does not merge yet.
- [x] With `wait: true`, a PR whose relevant GitHub checks are terminal-success may merge and return immediately; failed checks return a terminal blocked result without merging.
- [x] Railway deployment waiting remains available only through the explicit deploy-wait workflow, not implicitly inside the agent-facing merge tool.
- [x] A nested MCP facade call naming a nonexistent/stale tool must not be reported as an authorization FORBIDDEN. It must pass the normal authenticated facade boundary and return a structured `NOT_FOUND` recovery payload.
- [x] Unknown-tool recovery provides bounded manifest-backed suggestions; stale browser auth/profile names steer toward the shared persistent browser tools (especially `browser.headed`) instead of site-specific profile guesses.
- [x] Unknown tools remain fail-closed: recovery guidance never executes or auto-retries a guessed replacement.
- [x] The reproduced `stream.sync` manifest/script `repo` mismatch is eliminated and covered by a parity contract.
- [ ] Focused tests, strict review, and full verify pass before promotion.

## plan

1. Freeze the two observed stall modes in focused tests: CI-wait merge behavior and MCP unknown-tool recovery.
2. Refactor task merge readiness into a bounded GitHub preflight; remove implicit Railway polling from `--wait`.
3. Port/adapt the previously validated structured unknown-tool recovery concept to the current facade executor and let MCP unknown nested calls reach that fail-closed executor under the existing `mcp:call` umbrella scope.
4. Close the concrete `stream.sync --repo` contract drift with the smallest compatible change and test.
5. Run focused workspace/OS tests, strict review, full verify, then promote.

## Test-first contract

behavior under test:
- `task.merge --wait` is a bounded GitHub CI gate, not a long-lived deploy waiter. Pending checks produce an immediate pending result and no merge; failed checks block; successful checks permit merge.
- unknown nested MCP tool calls are authenticated as facade-call attempts and reach the executor, which returns structured `NOT_FOUND` guidance without executing a guessed replacement.
- advertised `stream.sync` arguments are accepted by its backing CLI.

existing local pattern:
- `packages/workspace/scripts/task-merge.js` owns PR merge behavior and currently contains the problematic 30-minute Railway loop.
- `packages/os/scripts/lib/mcp-gateway.ts` resolves nested MCP call scopes before execution.
- `packages/os/scripts/lib/facade/executor.ts` already returns `NOT_FOUND` locally and has a single `fs.patch` repair hint.
- historical PR #811 contains an unmerged but focused structured unknown-tool recovery implementation that previously passed its facade tests.

new or changed tests:
- add focused task-merge readiness tests around a pure helper/module rather than shelling to live GitHub.
- extend MCP gateway/tool-scope tests to prove unknown nested calls use `mcp:call` authorization and then return structured facade `NOT_FOUND`.
- add/update facade recovery tests for manifest-backed suggestions including browser-auth wording.
- add a stream-sync CLI/manifest parity regression for `repo`.

focused RED command:
`bun --cwd packages/workspace test tests/task-merge-readiness.test.ts && bun --cwd packages/os test tests/mcp-gateway.test.ts tests/facade/not-found-recovery.test.ts`

expected RED:
- no bounded merge-readiness helper exists and current `--wait` enters Railway polling after merge.
- MCP scope resolution rejects unknown nested tools with HTTP 403 `UNKNOWN_TOOL_SCOPE` before executor recovery can run.
- generic unknown facade tools return no structured suggestion.
- `stream.sync` advertises `repo` but rejects `--repo`.

no-test waiver: not applicable.

## current status

- Production implementation is complete.
- Focused RED reproduced both user-reported failures before implementation.
- Focused GREEN passes.
- Broader regression passes: 4 workspace Vitest assertions + 1 Bun stream-sync contract + 796 OS tests = 801 tests, plus Node syntax checks and `git diff --check`.
- Live smoke: the new already-merged `task.merge --wait` path returned in 0.73s instead of entering Railway polling.
- Strict review passed after adding fail-closed GitHub-readiness error handling.
- Initial full verify exposed an over-broad test-selection fallback; the selector pulled the entire `@consuelo/os` package suite and outlived the tool-call boundary.
- Test selection now has explicit critical ownership for task-merge/stream-sync/unknown-tool recovery. The plan dropped from 19 suites plus the broad OS package test to 15 focused suites; the broad OS package test is no longer selected.
- All 15 selected suites passed in 58.9s. Ready for final strict review + verify stamp.

## key evidence

- Previous stream PR #2590 was merged while GitHub checks were still running; the agent-facing `task.merge({ wait:true })` then remained blocked because `--wait` actually polls Railway deploys for up to 30 minutes.
- `task.merge` facade timeout is 120 seconds, while the backing `waitForDeploy` loop defaults to 30 minutes and sleeps 15 seconds per poll.
- `resolveToolScope` maps unknown tools to HTTP 403 `UNKNOWN_TOOL_SCOPE`; MCP resolves this before facade execution, producing the misleading FORBIDDEN boundary.
- Browser tooling already uses one shared persistent profile; `browser.headed` is the documented auth/MFA handoff. Site-specific browser-login profiles are explicitly not part of the supported contract.
- `stream.sync` manifest advertises `repo`, but the backing parser rejects `--repo`; reproduced on 2026-09-26.

## files changed

- `packages/os/scripts/lib/task-merge-readiness.js`
- `packages/workspace/scripts/lib/task-merge-readiness.js`
- `packages/workspace/scripts/task-merge.js`
- `packages/os/scripts/task-merge.js`
- `packages/workspace/scripts/stream-sync.js`
- `packages/os/scripts/stream-sync.js`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/workspace/tests/task-merge-readiness.test.ts`
- `packages/os/tests/facade/not-found-recovery.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## implementation notes

- `task.merge --wait` now performs one bounded GitHub check-run preflight. Pending checks return `CHECKS_PENDING` with `retryAfterSeconds: 15`; failed checks return `CHECKS_FAILED`; neither path merges or sleeps.
- The legacy Railway polling loop remains available only under explicit `--wait-deploy`. The normal agent-facing `wait=true` path cannot enter it.
- Unknown nested MCP tools are authorized only under the generic `mcp:call` envelope, then fail closed in the facade executor as `NOT_FOUND`; known tools retain their per-tool scope enforcement.
- Unknown-tool recovery runs bounded manifest-backed `tools.search` logic in-process and never executes a guessed replacement. Browser auth/profile-like stale names prefer `browser.headed` when present.
- Both workspace and OS `stream-sync.js` copies now accept the manifest-advertised `--repo` flag and fail explicitly for unsupported repositories rather than reporting an unknown flag.
- Test selection gives these agent-boundary files explicit critical coverage so full verify cannot fall back to the package-wide OS test solely because the new tooling files were previously unmapped.

## issues and recovery

- A broader regression initially invoked an existing `bun:test` file through Vitest; rerunning that file with `bun test` passed 1/1. This was a runner mismatch, not a code defect.
- One behavioral smoke was initially rejected by the OS shell validator because it used a heredoc; it was rewritten using `python3 -c` and passed.
- The first full verify tool call timed out while two orphaned selector processes continued running. The selector plan showed the package-wide OS fallback was the expensive tail. Those timed-out selector process trees were terminated by exact PID after confirming ownership, the test-selection coverage was tightened, and the resulting 15-suite focused plan passed in 58.9s.
- A second live reproduction happened at the typed `verify` boundary: Ko interrupted while the agent was still waiting, and immediately afterward there was no live verify process, no completed facade trace for that verify call, and no verify stamp to resume. This confirms the agent-facing verify call itself is too synchronous/opaque.
- The new non-blocking verify boundary is implemented: identical active runs now return `pending` immediately; JSON verify reserves a run, launches a detached foreground worker, returns `VERIFY_PENDING`, and later calls replay completion.
- Focused non-blocking verify tests are GREEN: 28/28 across OS run-state, workspace run-state, and workspace verification contracts, plus syntax checks for both verify implementations.
- Live task-worktree smoke is GREEN: first verify returned `VERIFY_PENDING` in 396ms, the immediate second call returned in 422ms with the same run key and worker PID, and the worker was re-parented to PID 1 with run state `running`. It later completed successfully and wrote a publish-valid full verify stamp.
- A typed verify call still used the controller checkout's currently-installed/main verify implementation while this task was unmerged, so it reproduced the old blocking behavior until timeout. This is an important self-hosting detail: the facade resolves `taskWorktree` as data/target context, but `resolveWorkspaceCommandCwd` intentionally runs non-`task:`/`stream:` scripts such as `verify` from the controller checkout. Therefore the typed path cannot exercise an unmerged verify implementation; after this task reaches main/local update, it must be re-smoked through the typed tool.

## Test-first contract: non-blocking verify boundary

behavior under test:
- A second verify request for the same active identity returns a structured `VERIFY_PENDING` state immediately instead of sleeping/polling for up to 10 minutes.
- Agent-facing JSON verify starts the long verification in a detached worker, returns pending quickly, and survives caller interruption.
- Repeating verify while that worker is alive returns the same pending run identity; repeating after completion replays the final result and publish stamp.
- Human/non-JSON verify remains foreground/synchronous.
- Stale/dead verify workers are still orphaned and recoverable; no guessed success state is ever emitted.

new or changed tests:
- Extend `packages/os/tests/verify-run-state.test.js` and the compatibility copy to cover immediate pending instead of synchronous lock waiting.
- Extend verify contract tests to require detached JSON-worker launch and explicit pending/replay handling.
- Live smoke the actual task worktree: first JSON verify returns pending in a bounded time, detached worker remains alive after the caller returns, second call returns pending quickly, final call replays completion.

focused RED command:
`bun x vitest run packages/os/tests/verify-run-state.test.js packages/workspace/tests/verify-run-state.test.js packages/workspace/tests/verification.test.js`

expected RED:
- current `beginVerifyRun` blocks in `waitForExistingRun` for an active identical run.
- current JSON verify executes the entire review + selected-test gate in the caller process and has no detached pending state.

## workspace-owned: files changed

- `packages/os/scripts/lib/task-merge-readiness.js`
- `packages/workspace/scripts/lib/task-merge-readiness.js`

## workspace-owned: activity log

- 2026-09-26 13:16:13 fs.write: `.task/tooling-reliability/fix-agent-stalls-at-ci-wait-and-unknown-tool-boundaries/workpad.md`
- 2026-09-26 13:18:52 fs.write: `packages/workspace/scripts/lib/task-merge-readiness.js`
- 2026-09-26 13:18:52 fs.write: `packages/os/scripts/lib/task-merge-readiness.js`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/verify-run-state.js`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/stream-sync.js`
- `packages/os/scripts/task-merge.js`
- `packages/os/scripts/verify.js`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/verify-run-state.test.js`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/lib/verify-run-state.js`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/scripts/task-merge.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/verification.test.js`
- `packages/workspace/tests/verify-run-state.test.js`

## workspace-owned: validation evidence

- 2026-09-26 13:25:45 `review.run`: passed — OK
- 2026-09-26 13:26:00 apply-patch: `packages/workspace/scripts/task-merge.js`
- 2026-09-26 13:26:00 apply-patch: `packages/os/scripts/task-merge.js`
- 2026-09-26 13:26:30 `review.run`: passed — OK
- 2026-09-26 13:28:59 `verify`: failed — COMMAND_FAILED
- 2026-09-26 13:30:05 `verify`: failed — COMMAND_FAILED
- 2026-09-26 13:33:45 apply-patch: `packages/workspace/test-selection.registry.json`
- 2026-09-26 13:33:46 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-26 13:35:19 apply-patch: `.task/tooling-reliability/fix-agent-stalls-at-ci-wait-and-unknown-tool-boundaries/workpad.md`
- 2026-09-26 13:35:39 `review.run`: passed — OK
- 2026-09-26 13:36:53 `verify`: failed — COMMAND_FAILED
- 2026-09-26 13:37:49 `verify`: failed — COMMAND_FAILED
- 2026-09-26 13:38:07 apply-patch: `packages/workspace/scripts/task-merge.js`
- 2026-09-26 13:38:07 apply-patch: `packages/os/scripts/task-merge.js`
- 2026-09-26 16:42:13 apply-patch: `.task/tooling-reliability/fix-agent-stalls-at-ci-wait-and-unknown-tool-boundaries/workpad.md`
- 2026-09-26 16:42:31 apply-patch: `packages/os/tests/verify-run-state.test.js`
- 2026-09-26 16:42:31 apply-patch: `packages/workspace/tests/verify-run-state.test.js`
- 2026-09-26 16:42:32 apply-patch: `packages/workspace/tests/verification.test.js`
- 2026-09-26 16:43:12 apply-patch: `packages/os/tests/verify-run-state.test.js`
- 2026-09-26 16:43:49 apply-patch: `packages/os/scripts/lib/verify-run-state.js`
- 2026-09-26 16:43:49 apply-patch: `packages/workspace/scripts/lib/verify-run-state.js`
- 2026-09-26 16:45:20 apply-patch: `packages/os/scripts/lib/verify-run-state.js`
- 2026-09-26 16:45:20 apply-patch: `packages/workspace/scripts/lib/verify-run-state.js`
- 2026-09-26 16:45:55 apply-patch: `packages/workspace/scripts/verify.js`
- 2026-09-26 16:46:05 apply-patch: `packages/workspace/scripts/verify.js`
- 2026-09-26 16:46:10 apply-patch: `packages/os/scripts/verify.js`
- 2026-09-26 16:46:20 apply-patch: `packages/os/scripts/verify.js`
- 2026-09-26 16:46:35 apply-patch: `packages/workspace/test-selection.registry.json`
- 2026-09-26 16:47:14 `review.run`: passed — OK

- 2026-09-26 16:50:57 apply-patch: `.task/tooling-reliability/fix-agent-stalls-at-ci-wait-and-unknown-tool-boundaries/workpad.md`