# fix coderabbit review comments

branch: `task/workspace-agents/fix-coderabbit-review-comments`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/868/fix-coderabbit-review-comments
started: 2026-06-09

## acceptance criteria

- [x] Verify the three actionable CodeRabbit comments on stream PR #852 against current code.
- [x] Fix the still-valid issues with focused changes only.
- [x] Preserve existing Workspace/OS tool behavior and registration semantics.
- [x] Validate touched files and focused tests/checks.
- [ ] Push the task branch and promote it back into `stream/workspace-agents` so PR #852 updates.

## plan

1. Read `AGENTS.md`, `CODING-STANDARDS.md`, and the commented code ranges.
2. Fill test-first contract before production edits.
3. Apply focused fixes for valid comments.
4. Reread changed ranges and inspect diff.
5. Run syntax/focused validation, review, verify, push, and promote.

## Test-first contract

behavior under test:
- Steering guard history ignores future-dated events when calculating guard decisions.
- Workspace steering request context has no shared mutable `ContextVar` default.
- `refresh_steering` is registered once with MCP.

existing local pattern to follow:
- OS tests use Vitest under `packages/os/tests/**` and can isolate runtime state with a temp `CONSUELO_HOME`, as in `doctor-redaction.test.ts`.
- Workspace server has existing `server_call_test.py` coverage for `refresh_steering` guard behavior.
- Python syntax checks are the focused validation layer for server decorator/type cleanup.

new or changed tests:
- Added `packages/os/tests/runtime-state.test.ts` covering `readSteeringGuardDecisions` with current/future guard rows.
- No new Workspace Python test for the duplicated decorator or ContextVar default: the decorator bug is a direct copy/paste registration cleanup and the mutable default finding is a linter/static safety issue. Existing `server_call_test.py` plus `py_compile` replaces a new behavioral test for those lines.

focused red command:
- `bun --cwd packages/os test tests/runtime-state.test.ts`

expected red failure:
- The new OS runtime-state test fails before implementation because `readSteeringGuardDecisions` returns the future-dated guard event.

red evidence:
- First attempt failed for the harness (`bun:sqlite` import unavailable in Vitest's Node runtime), so the test was adjusted to match existing OS tests by invoking Bun in a subprocess.
- Meaningful red: `bun --cwd packages/os test tests/runtime-state.test.ts` failed with `expected [ 'allowed', 'blocked' ] to deeply equal [ 'allowed' ]`.

no-test waiver:
- Workspace `server.py` changes do not get a new test because there is no clean focused runtime failure harness for duplicate MCP decorator registration or mutable `ContextVar` default. Replacement validation: existing `server_call_test.py` focused refresh steering coverage and `python3 -m py_compile packages/workspace/server.py`.

## current status

- PR #852 review comments fetched with `prReview`.
- Task started from `stream/workspace-agents` because this is a direct follow-up to unshipped stream review comments.
- `code.run` investigation failed before edits with `Cannot find module './lib/codemode/tools/index'` from `packages/workspace/scripts/code-run.ts`; switched to direct typed workspace calls.
- `context.search` returned no prior context for `steering guard`.
- `explore` returned noisy Twenty guard files, so exact CodeRabbit file comments and direct `fs.read` results are the source of truth for this task.
- Read `AGENTS.md` and full `CODING-STANDARDS.md` before editing.
- Verified all three actionable CodeRabbit comments are still valid in current code.

## files changed

- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/tests/runtime-state.test.ts`
- `packages/workspace/server.py`

## validation

- Red: `bun --cwd packages/os test tests/runtime-state.test.ts` failed as expected with future row included.
- Green: `bun --cwd packages/os test tests/runtime-state.test.ts` passed.
- `python3 -m py_compile packages/workspace/server.py` passed.
- `python3 -m unittest packages/workspace/tests/server_call_test.py` passed: 38 tests.
- `checkFiles` passed for `packages/os/scripts/lib/runtime-state.ts` and `packages/os/tests/runtime-state.test.ts`.
- Initial `review.run --base origin/stream/workspace-agents --noTests` failed on `console.log` in the test subprocess; changed to `process.stdout.write`.
- Final `review.run --base origin/stream/workspace-agents --noTests` passed with 0 issues.
- `verify --base origin/stream/workspace-agents --noDb` passed and wrote `.task/workspace-agents/fix-coderabbit-review-comments/verify.json`.
- `verify` selected zero suites automatically, but the explicit focused OS and Workspace tests above were run manually.

## notes for Ko

- The existing `code.run` tool is broken on this stream at `packages/workspace/scripts/code-run.ts` because it cannot find `./lib/codemode/tools/index`. This task did not fix that because it is outside the CodeRabbit comments requested here.

- 2026-06-09 17:56:00 write: `.task/workspace-agents/fix-coderabbit-review-comments/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/tests/runtime-state.test.ts`
- `packages/workspace/server.py`

## workspace-owned: activity log

- 2026-06-09 17:56:00 fs.write: `.task/workspace-agents/fix-coderabbit-review-comments/workpad.md`

## workspace-owned: validation evidence

- 2026-06-09 17:56:12 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-coderabbit-review-comments.json`, `.task/workspace-agents/fix-coderabbit-review-comments/current.json`, `.task/workspace-agents/fix-coderabbit-review-comments/evidence-log.json`, `.task/workspace-agents/fix-coderabbit-review-comments/read-log.json`, `.task/workspace-agents/fix-coderabbit-review-comments/session.json`, `.task/workspace-agents/fix-coderabbit-review-comments/verify.json`, `.task/workspace-agents/fix-coderabbit-review-comments/workpad.md`, `packages/os/scripts/lib/runtime-state.ts`, `packages/os/tests/runtime-state.test.ts`, `packages/workspace/server.py`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
