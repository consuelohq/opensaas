# compact verify trace output and dedupe verification runs

branch: `task/os/compact-verify-trace-output-and-dedupe-verification-runs`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2543/compact-verify-trace-output-and-dedupe-verification-runs
github pr: https://github.com/consuelohq/opensaas/pull/2543
started: 2026-09-22

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

- 2026-09-22 23:20:42 fs.write: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`
- 2026-09-22 23:26:59 fs.write: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`
- 2026-09-22 23:33:27 fs.write: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`
- 2026-09-22 23:38:55 fs.write: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`

## workspace-owned: validation evidence

- 2026-09-22 23:27:13 `review.run`: passed — OK
- 2026-09-22 23:29:27 `verify`: passed — OK
- 2026-09-22 23:30:44 `verify`: passed — OK
- 2026-09-22 23:33:20 `review.run`: passed — OK
- 2026-09-22 23:35:34 `verify`: passed — OK
- 2026-09-22 23:36:34 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- identical verify runs on the same repo/base/head/change hash replay the completed result even when the first run failed, so callers do not rerun an identical expensive gate
- code.call verify mode suppresses nested facade telemetry emission while preserving trace persistence
- code.call verify mode defaults to a smaller result envelope and bounds duplicated top-level stderr
- observability marks fallback payload-derived token counts as estimates instead of presenting them as recorded model tokens
existing local pattern:
- packages/os/scripts/lib/verify-run-state.js already single-flights and replays successful completed verify results
- packages/os/scripts/lib/code-call/output.ts already writes full oversized logs and returns bounded head/tail envelopes
- facade logMode=silent suppresses stderr emission without disabling recordToolTraceSafely persistence
new or changed tests:
- extend packages/os/tests/verify-run-state.test.js to replay a completed nonzero result
- extend packages/os/tests/code-call.test.ts for verify-mode default cap and nested facade-log suppression
- add/extend trace-site-inspector model/formatter coverage for estimated-token labeling
focused red command:
- bunx vitest run packages/os/tests/verify-run-state.test.js packages/os/tests/code-call.test.ts packages/os/tests/trace-site-inspector*.test.ts --reporter=dot --silent=passed-only --no-color
expected red failure:
- new assertions fail because failed verify results are not replayed, verify-mode output still defaults to 20k chars, nested tool.executed logs still reach stderr, and fallback token counts lack estimate metadata/labeling
no-test waiver: not applicable

- 2026-09-22 23:20:42 append: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/code-call/schema.ts`
- `packages/os/scripts/lib/code-call/service.ts`
- `packages/os/scripts/lib/code-call/snapshot.ts`
- `packages/os/scripts/lib/codemode/tools/index.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/verify-run-state.js`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/scripts/verify.js`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/tests/verify-run-state.test.js`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/lib/verify-run-state.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/tests/verification.test.js`

## Implementation status — 2026-09-22

Acceptance criteria completed:
- [x] Verify-mode code.call defaults to a 6,000-character stdout/stderr envelope while preserving full sidecar logs.
- [x] Top-level duplicate stderr is independently capped to 2,000 characters.
- [x] Verify-mode child processes force facade log emission to silent while trace persistence remains enabled.
- [x] `.task/**` bookkeeping mutations are excluded from code.call mutation snapshots so concurrent evidence/workpad updates do not invalidate a verify call.
- [x] Existing verify single-flight now replays an identical failed result for a bounded 30-second window, then allows an intentional retry.
- [x] Historical payload-derived token counts carry explicit `estimated` semantics and render with an `≈` prefix; recorded token counts remain exact.
- [x] Browser trace inspector bundle rebuilt from source.

Validation evidence:
- RED: focused TDD run initially failed 3 expected assertions (failed-result replay, compact verify cap, token estimate metadata).
- GREEN: `bunx vitest run packages/os/tests/verify-run-state.test.js packages/os/tests/code-call.test.ts packages/os/tests/trace-site-inspector-interactions.test.ts packages/os/tests/trace-site-inspector-os-owned.test.ts --reporter=dot --silent=passed-only --no-color` -> 4 files, 70 tests passed in 3.11s.
- `bun run --cwd packages/os typecheck` -> workspace script syntax checks passed.
- Trace-site Vitest subset -> 18 tests passed; one suite was intentionally rerun with its native Bun runner because it imports `bun:test`.
- `bun test packages/os/tests/trace-sites-browser-client.test.ts` -> 4 passed, 0 failed.
- `bun run --cwd packages/os build:observability-traces-runtime` -> inspector bundle rebuilt successfully.

Key decisions:
- Keep successful verify replay behavior unchanged. Failed identical results are only replayed for 30 seconds to collapse duplicate callers without permanently caching flaky/transient failures.
- Preserve full stdout/stderr in sidecar logs; compact only the agent-facing envelope.
- Use process-level `CONSUELO_FACADE_LOG_MODE=silent` only for verify-mode child execution; trace persistence is unaffected because logger emission and trace recording are separate.

- 2026-09-22 23:26:59 append: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`

## Canonical verify correction

Final validation uncovered that the `verify` facade actually runs `packages/workspace/scripts/verify.js`, while the pre-existing single-flight helper lived only under `packages/os`. The timed-out validation call was then retried by the harness, and process inspection showed two concurrent canonical `workspace verify --json` trees, directly reproducing the duplicate-gate bug.

Correction shipped in this task:
- Added the byte-identical verify-run-state helper to `packages/workspace/scripts/lib/verify-run-state.js` and updated parity classification to `same`.
- Wired canonical workspace `verify --json` to single-flight by repo/base/head/changeHash/arguments before review/test selection begins.
- Identical concurrent/retried callers now wait for/replay the same result rather than launching another test-selection tree.
- Failed results replay for only 30 seconds, collapsing immediate duplicate retries while still allowing a deliberate later rerun.
- `committedOnlyTests` is part of the identity so materially different test-selection modes never share a run.

Additional validation:
- Workspace single-flight tests: 2 files, 15 tests passed.
- OS focused regression tests: 4 files, 71 tests passed.
- Script parity audit: 1 passed; workspace/OS verify-run-state helper confirmed byte-identical.
- Final static review after workspace integration: 0 blocking issues across both `consuelo-os` and `openworkspace`.

- 2026-09-22 23:33:27 append: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`

## Final full-gate validation

Ran the task-worktree canonical `packages/workspace/scripts/verify.js --json` after the single-flight integration. The outer tool call timed out at ~60s and was retried by the harness; unlike the old behavior, the retry did **not** start another test-selection tree. Process inspection showed one expensive verify/test-selection owner plus one lightweight waiter, both sharing run identity `6230b03d...`. The durable run record then completed once with exit code 0 and both processes exited.

Final gate result:
- passed: true
- publishValid: true
- mode: full
- review: passed
- test selection: passed (17 selected suites)
- db guard: passed
- publish-valid verify stamp written for the task
- owner run: ~110s; duplicate retry reused the same run instead of starting a second suite

This directly validates the failure mode that originally produced overlapping ~100s verify/test runs.

- 2026-09-22 23:38:55 append: `.task/os/compact-verify-trace-output-and-dedupe-verification-runs/workpad.md`
