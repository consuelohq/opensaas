# stabilize detached subagent exit marker publication

branch: `task/os/stabilize-detached-subagent-exit-marker-publication`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2433
started: 2026-09-10

## acceptance criteria

- [x] Reproduce the failing stream gate from GitHub logs and distinguish product/runtime defects from hosted test-harness contention before changing production lifecycle semantics.
- [x] The focused durable-subagent selector runs its three process-heavy contract files without cross-file parallelism, while intentional concurrency remains covered inside the lifecycle suite itself.
- [x] The existing lifecycle/orchestration/executable-discovery contracts pass under the selector exactly as CI invokes them.
- [x] Strict review and full verify pass against current `origin/stream/os`.
- [ ] Promote this repair into `stream/os`, require fresh stream CI to reach zero failures/pending checks, then release stable and update the local node without clobbering unrelated dirty work.

## plan

1. Inspect the exact hosted CI failures, current lifecycle/runner handshake, Bun version, and selector execution model.
2. Reproduce with the hosted Bun version locally and test whether the failure is deterministic in product code.
3. If product semantics reproduce, fix the exit-marker handshake. If they do not and evidence isolates cross-file process contention, serialize only the focused runtime contract files.
4. Run the selector-owned suites exactly as CI does, then strict review and full verify.
5. Promote to `stream/os`, require fresh CI green, then merge/release stable and update local Consuelo OS.

## files changed

- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## key decisions

- Do not weaken durable runner failure/timeout semantics without a deterministic product-level red regression.
- GitHub used Bun 1.4.2; the exact Bun 1.4.2 locally passes all 51 affected tests, so Bun-version drift alone is not the defect.
- The selector invokes three process-heavy Vitest files together with default cross-file parallelism on a shared 2-core hosted runner. The same tests are green in isolation and locally under both Bun 1.3.14 and 1.4.2. Treat selector-level cross-file contention as the current highest-confidence release blocker; serialize this focused contract only.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- A diagnostic Bun 1.4.2 archive was downloaded inside task metadata to match GitHub exactly; it was removed before any publish step and will not be committed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: when the detached subagent runner process disappears before its durable exit marker is observed, wait/status must tolerate the runner-owned marker publication window and recover terminal completion/failure from the marker or bounded output tail instead of immediately synthesizing `completion_unknown`/`failed`.
existing local pattern: the runner owns `exit.json`; lifecycle already distinguishes a missing marker from a terminal provider result, and the failing regressions explicitly cover bounded-tail recovery, inherited-secret completion, and durable orchestration under load.
new or changed tests: strengthen the nearest lifecycle regression to deterministically delay `exit.json` visibility after runner process exit (or reproduce the existing fallback path directly), then require wait to keep the run nonterminal long enough to observe/recover the real result. Preserve provider nonzero exit and timeout semantics.
focused red command: `bun x vitest run packages/os/tests/subagent-lifecycle-regressions.test.ts -t "waits for a late durable exit marker after runner process exit"`.
expected red failure: current `attachRunnerExitFallback` writes a synthetic failed exit marker as soon as the runner process disappears, winning the race against the real marker and producing `completion_unknown`/`failed`.
no-test waiver: not applicable.

## release context

- PR #2411 was merged by another concurrent workflow at 2026-09-10T00:32:51Z while its two subagent CI checks were still failing; that SHA has not been intentionally released by this workflow.
- Follow-up stream PR #2432 contains the verified Bun-runtime/selector repair plus a separately verified unpaid-cloud-provisioning fix, but its fresh CI reproduced the same load-sensitive exit-marker race.
- Release remains blocked until this task makes the durable runner terminal handshake deterministic and #2432/follow-up stream CI is green.
- Superseded implementation hypothesis: exact Bun 1.4.2 and all 51 runtime contracts pass locally, so no production exit-marker semantic change is justified by the available evidence. The repair is isolated to how the process-heavy contract files are scheduled on CI.

## Test-first contract — hosted subagent selector isolation

behavior under test: `os-subagent-runtime` must run lifecycle, orchestration, and executable-discovery contract files serially at the file level so unrelated detached-process fixtures cannot starve each other on the hosted runner; concurrency behavior remains exercised by tests inside `subagent-lifecycle-regressions.test.ts`.
existing local pattern: test-selection rules own exact critical suites and may specify Vitest CLI execution flags. `os-subagent-runtime` already exclusively owns these three files to avoid the broad OS package baseline.
new or changed tests: extend the existing `uses focused durable subagent contracts instead of the broad OS package suite` selector regression to require `--no-file-parallelism` in the runtime suite command.
focused red command: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "uses focused durable subagent contracts instead of the broad OS package suite"`.
expected red failure: current selector command contains all three test files but omits `--no-file-parallelism`, so Vitest runs their detached-process fixtures concurrently on CI.
no-test waiver: not applicable.

## validation

- RED: selector regression failed because `--no-file-parallelism` was absent.
- GREEN: selector regression passes with file-level serialization.
- GREEN: serialized lifecycle/orchestration/executable-discovery command passes 51/51 tests.
- GREEN: repository test-selection gate passes every selected suite with zero failures.
- GREEN: strict review reports 0 issues and 0 blockers.
- GREEN: full verify against `origin/stream/os` reports `passed: true`, `publishValid: true`, DB guard clean.

- 2026-09-10 01:11:16 append: `.task/os/stabilize-detached-subagent-exit-marker-publication/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-10 01:11:16 fs.write: `.task/os/stabilize-detached-subagent-exit-marker-publication/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/subagent/process-termination.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/workspace/scripts/test-selection.js`

- 2026-09-10 01:17:15 apply-patch: `.task/os/stabilize-detached-subagent-exit-marker-publication/workpad.md`
- 2026-09-10 01:17:18 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-10 01:17:27 apply-patch: `packages/workspace/test-selection.rules.json`

## workspace-owned: validation evidence

- 2026-09-10 01:18:26 `review.run`: passed — OK
- 2026-09-10 01:18:51 `verify`: passed — OK

- 2026-09-10 01:18:59 apply-patch: `.task/os/stabilize-detached-subagent-exit-marker-publication/workpad.md`