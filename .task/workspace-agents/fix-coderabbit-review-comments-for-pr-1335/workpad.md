# Fix CodeRabbit review comments for PR 1335

## Acceptance criteria
- Verify actionable CodeRabbit and Codex comments from PR #1335 against current `stream/workspace-agents` code.
- Fix still-valid issues with a narrow blast radius in workspace/os subagent and wait tooling.
- Keep generated/docs/manifests consistent when schema/runtime contracts change.
- Validate with focused tests/type checks and publish back to `stream/workspace-agents` so PR #1335 can be merged to main.

## Review findings to address
- Subagent output contract mismatch: runtime can omit `summary`, schemas/signatures require it, and `SubagentData` is missing the typed `summary` field while using it.
- Grok subagent result passes unsupported `audit` into compaction and does not mark spawned CLI execution as raw shell used.
- Subagent process output is collected unbounded; timeout only sends SIGTERM and can hang if the provider ignores it.
- Codex help can be absent while later code dereferences `help.includes(...)`.
- `wait --pr` uses throwing/dynamic `execSync` for `gh pr checks`, mishandles pending exit code 8, accepts missing `--pr`, and accepts invalid poll intervals.
- Deploy wait output is not JSON-only on all terminal/superseded paths and hard-codes 30m in timeout output.
- Subagent CLI examples advertise `/tmp` instruction paths that resolver rejects.
- Script parity classifications are stale after worker -> subagent rename.
- Existing bounded-output test is too weak.

## Implementation plan
1. Add/strengthen focused tests and run them red where practical.
2. Patch workspace and os runtimes symmetrically where the duplicated tool surfaces share the same bug.
3. Patch wait.js in both packages with a shared local pattern: non-throwing gh invocation, pending exit code 8 handling, finite positive poll interval, strict argument parsing, JSON-only deploy terminal output.
4. Regenerate or minimally repair parity classification/generator surfaces after reading the audit pattern.
5. Run focused validations, then review diff and publish task PR into the stream PR.

## Test-first contract
- Behavior under test:
  - Subagent runtime output type includes optional typed `summary`; error paths remain valid without `summary`, success paths include trace summary.
  - Subagent process runner bounds stdout/stderr during collection and escalates timed-out child processes.
  - `wait --pr` treats GitHub CLI pending exit code 8 as retryable, rejects missing PR values, clamps invalid poll interval values, and keeps deploy stdout machine-parseable.
  - Script parity classifications match the real script tree.
  - Bounded-output facade test proves actual truncation/compaction.
- Existing local pattern to follow:
  - `packages/workspace/tests/facade/facade.test.ts` already covers subagent facade behavior with fake provider CLIs.
  - `packages/os/tests/audit/script-parity-audit.test.ts` enforces parity classification inventory.
  - Existing wait.js scripts are duplicated between os/workspace; keep edits symmetric unless package-specific behavior is intentional.
- New or changed tests:
  - Strengthen `packages/workspace/tests/facade/facade.test.ts` bounded-output assertion and add timeout/process behavior coverage if current helpers can express it cheaply.
  - Add/adjust wait.js CLI smoke tests only if a local test file exists; otherwise use direct CLI smoke commands as validation for parser and JSON contracts.
  - Use the existing script parity audit as the red/green proof for classification updates.
- Focused red commands:
  - `bun --cwd packages/workspace test tests/facade/facade.test.ts`
  - `bun --cwd packages/os test tests/audit/script-parity-audit.test.ts`
  - CLI smoke: `bun packages/workspace/scripts/wait.js --pr` should fail instead of sleeping; pending gh behavior to be tested with PATH shim if no existing test harness covers it.
- Expected red failure:
  - Current code has type/contract mismatch around `SubagentData.summary` and weak bounded-output assertion.
  - Current parity audit should reject stale/missing classifications.
  - Current wait CLI accepts missing `--pr` and may sleep, so use short timeout/smoke carefully.

## Key decisions
- Fix both `packages/os` and `packages/workspace` copies for duplicated bugs even when CodeRabbit only anchored one copy, because the review comments and code show the same implementation drift.
- Keep public subagent help examples inside repo/task roots rather than loosening the resolver to allow arbitrary `/tmp` instruction files.

## Validation log
- RED: `bun --cwd packages/os test tests/audit/script-parity-audit.test.ts` failed before fix because classifications contained stale/nonexistent script paths and incompatible statuses.
- RED: `bun packages/workspace/scripts/wait.js --pr` hung into default sleep before fix because `--pr` accepted a missing value.
- RED: pending `gh pr checks` shim exited 8 before fix and was treated as fatal instead of pending.
- GREEN: `workspace checkFiles` passed for changed TS/JS/d.ts files.
- GREEN: `bun --cwd packages/os test tests/audit/script-parity-audit.test.ts`.
- GREEN: `bun --cwd packages/workspace test tests/facade/facade.test.ts -t "bounds subagent output"`.
- GREEN: wait CLI smoke: missing `--pr` now returns JSON failure immediately.
- GREEN: wait CLI smoke: pending `gh pr checks` exit code 8 now parses as pending and times out deterministically as JSON.
- GREEN: grep found no stale required `SubagentOutput.summary` generated signatures and no stale `/tmp/ko-social.md` help examples.

## Notes for Ko
- PR #1335 is open and unstable. Task PR #1351 is scoped to review-comment fixes and will merge back into `stream/workspace-agents` before the original stream PR is merged to main.

## Improvements noticed
- The duplicated os/workspace scripts are drifting. After this fix, consider extracting a generator/shared source if that fits the repo workflow.

## Errors or blockers
- None yet.

## workspace-owned: validation evidence

- 2026-07-03 09:53:49 `checkFiles`: failed — COMMAND_FAILED
- 2026-07-03 10:00:44 `checkFiles`: passed — OK

## Final implementation note
- Changed subagent output contracts so generated signatures match runtime behavior: `summary` is optional, while successful compacted provider runs still include it.
- Bounded live subagent stdout/stderr accumulation, added timeout SIGKILL escalation, and tightened the bounded-output regression test.
- Fixed Grok audit reporting by marking direct CLI execution as raw-shell usage and removed the unsupported audit argument from compaction.
- Fixed wait PR/deploy edge cases: non-throwing `gh pr checks`, pending exit code 8 support, required flag values, finite positive poll interval handling, timeout-bounded sleeps, and JSON-only deploy terminal outputs.
- Refreshed generated workspace signatures/docs and script parity classifications after the worker -> subagent rename and current script inventory drift.
- Follow-up: full `packages/workspace/tests/facade/facade.test.ts` had unrelated pre-existing red tests before this task; this task validated the specific fixed bounded-output behavior instead of claiming full-suite green.
