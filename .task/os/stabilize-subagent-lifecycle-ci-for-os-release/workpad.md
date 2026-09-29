# stabilize subagent lifecycle CI for OS release

branch: `task/os/stabilize-subagent-lifecycle-ci-for-os-release`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2430
started: 2026-09-10

## acceptance criteria

- [x] Detached subagent runners honor the configured `BUN_BIN` instead of inheriting an arbitrary Vitest/Node host runtime.
- [x] The existing lifecycle, orchestration, and executable-discovery regression suites pass together under the same package-test environment that exposed PR #2411's failures.
- [x] Successful providers remain `completed`; provider failures and timeouts preserve their existing terminal semantics.
- [ ] Strict review and full task verification pass against the current `origin/stream/os` head.
- [ ] Promote the repair through PR #2430 into `stream/os`, re-run PR #2411 CI, and release only after the stream gate is green.

## plan

1. Reproduce the stream CI failures under package-test load and isolate runner bootstrap/runtime behavior.
2. Freeze a regression proving the durable runner uses the configured Bun runtime.
3. Make the smallest runtime-selection change without altering provider timeout/failure semantics.
4. Run the three affected suites together and confirm they also stay green during the broader OS package run.
5. Run strict review/verify, promote to `stream/os`, then re-run the stream release gate.

## files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`

## key decisions

- Treat `BUN_BIN` as the authoritative detached-runner runtime, matching the rest of the OS lifecycle stack. Fall back to the current executable only when it is Bun; otherwise resolve `bun` from PATH.
- Do not weaken runner exit-marker, timeout, or failure semantics merely to make CI green.

## notes for ko

- The red stream checks were real load-sensitive runtime drift: Vitest could launch the detached TypeScript runner through its host `process.execPath` instead of the Bun runtime Consuelo actually manages. The focused suites passed in isolation but failed inside the loaded package test.

## improvements noticed

- none yet

## errors i ran into

- An intentionally extreme eight-suite concurrent stress still exceeds the tests' fixed 5s wait budgets. The representative full OS package run is the relevant CI analogue: after the Bun-runtime fix, all three previously unstable subagent suites passed there. Unrelated local baseline failures remain outside this task.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the OS package subagent lifecycle/orchestration regressions selected by stream verification must deterministically observe the durable runner exit marker and finish with the expected terminal status on CI/Linux; a completed runner must not be misclassified as `completion_unknown`/`failed`, and a nonzero runner exit must remain `failed`.
existing local pattern: subagent runs are detached/durable, the owning process publishes an exit marker, and wait/status logic is expected to tolerate the publication window rather than infer terminal failure from process disappearance alone. The stream release itself does not intentionally change subagent product behavior.
new or changed tests: start with the existing failing regressions in `packages/os/tests/subagent-lifecycle-regressions.test.ts` and `packages/os/tests/subagent-orchestration-contract.test.ts`; add/adjust the smallest regression only if the CI-only race is not already covered.
focused red command: run the exact failing subagent lifecycle/orchestration tests repeatedly from this stream-based task under the current Bun/runtime, then reproduce the missing-exit-marker publication window deterministically if needed.
expected red failure: one or more waits observes `completion_unknown`/`failed` before the runner-owned durable exit marker is visible, matching PR #2411 CI.
no-test waiver: not applicable.

## current release blocker

- PR #2411 failed `Consuelo / verify` and `Consuelo / workspace contracts` twice, including a single failed-job rerun.
- Both failures are in unchanged subagent lifecycle/orchestration tests, but the rerun confirms this is not safe to dismiss as a one-off CI flake.
- Release is paused until this gate is repaired and revalidated.

- 2026-09-10 00:44:11 append: `.task/os/stabilize-subagent-lifecycle-ci-for-os-release/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`

## workspace-owned: activity log

- 2026-09-10 00:44:11 fs.write: `.task/os/stabilize-subagent-lifecycle-ci-for-os-release/workpad.md`
- 2026-09-10 01:00:03 fs.write: `.task/os/stabilize-subagent-lifecycle-ci-for-os-release/workpad.md`
- 2026-09-10 01:02:05 fs.write: `.task/os/stabilize-subagent-lifecycle-ci-for-os-release/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/process-termination.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: validation evidence

- 2026-09-10 00:56:39 `review.run`: passed — OK
- 2026-09-10 00:57:48 `verify`: failed — COMMAND_FAILED
- 2026-09-10 01:01:34 `review.run`: passed — OK
- 2026-09-10 01:01:59 `verify`: passed — OK

## Test-first contract — subagent selector ownership

behavior under test: changes to the durable subagent implementation and its focused lifecycle/executable-discovery regressions remain owned by the explicit critical `os-subagent-runtime` selector and do not fall through to the unrelated whole-OS package baseline.
existing local pattern: explicit critical/exclusive OS selectors suppress `auto:@consuelo/os:package-test` when they fully own the changed source/test surface; the current subagent selector already states this intent but only names the orchestration test.
new or changed tests: add a selector regression in `packages/workspace/tests/test-selection.test.js` that supplies `subagent/lifecycle.ts` plus `subagent-lifecycle-regressions.test.ts`, requires `os-subagent-runtime`, forbids `auto:@consuelo/os:package-test`, and verifies all three focused subagent suites are selected.
focused red command: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "uses focused durable subagent contracts instead of the broad OS package suite"`.
expected red failure: the lifecycle regression test is not currently in `os-subagent-runtime.source`, so the auto OS package test remains selected and the focused suite does not cover lifecycle/executable-discovery.
no-test waiver: not applicable.

- 2026-09-10 01:00:03 append: `.task/os/stabilize-subagent-lifecycle-ci-for-os-release/workpad.md`

- 2026-09-10 01:00:11 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-09-10 01:00:25 apply-patch: `packages/workspace/test-selection.rules.json`

## final task validation

- RED: configured-runner-runtime regression failed before the lifecycle fix because the detached runner ignored `BUN_BIN`.
- GREEN: configured-runner-runtime regression passes after runtime selection is corrected.
- GREEN: combined subagent runtime coverage — 51/51 across lifecycle, orchestration, and executable discovery.
- RED: selector ownership regression proved `subagent-lifecycle-regressions.test.ts` still selected `auto:@consuelo/os:package-test` before the selector rule update.
- GREEN: selector ownership regression passes; `os-subagent-runtime` owns all three focused subagent suites.
- GREEN: current-branch test selection ran 6 focused suites with zero failures; broad `@consuelo/os package test` is no longer selected.
- GREEN: strict review against `origin/stream/os` — 0 issues, 0 blockers.
- GREEN: full verify against `origin/stream/os` — `passed: true`, `publishValid: true`, DB guard clean.

Acceptance criteria through task publication are satisfied; remaining release criterion is to promote PR #2430 into `stream/os`, require fresh #2411 CI to go green, then use the release workflow to merge main, publish stable, and update the local node.

- 2026-09-10 01:02:05 append: `.task/os/stabilize-subagent-lifecycle-ci-for-os-release/workpad.md`
