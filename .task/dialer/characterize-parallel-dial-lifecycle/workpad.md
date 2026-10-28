# Characterize parallel dial lifecycle

branch: `task/dialer/characterize-parallel-dial-lifecycle`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1592/characterize-parallel-dial-lifecycle
github pr: https://github.com/consuelohq/opensaas/pull/1592
started: 2026-07-23

## acceptance criteria

- [ ] Preserve the conference multiline contract: customer legs begin muted, exactly one human-like answer wins, losers terminate, and the winner is unmuted.
- [ ] Add deterministic lifecycle coverage for duplicate/out-of-order callbacks, simultaneous answers, machine answers, terminal completion, and active-state TTL retention.
- [ ] Persist an initializing group before provider calls so callbacks during creation are not dropped.
- [ ] Make winner and telemetry claims explicit atomic store operations.
- [ ] Record provider cleanup failures durably instead of silently swallowing them while keeping callbacks idempotent.
- [ ] Persist workspace ownership and expose workspace-scoped lookup/termination contracts for authenticated adapters.
- [ ] Keep Twenty GraphQL/REST behavior compatible; no Hono, Effect restructuring, or LeadConnector code in PR 1.
- [ ] Pass focused dialer tests, affected server adapter tests, typecheck, review, and publish verification.

## plan

1. Characterize the current lifecycle and store contract with focused tests.
2. Run the focused suite red and confirm each failure represents a real gap.
3. Make the smallest package and adapter changes needed.
4. Run broader dialer/server validation and inspect scope.
5. Publish PR #1592, merge it into `stream/dialer`, and provide the next-branch handoff.

## Test-first contract

- Behavior under test: transport-independent parallel-group creation and callback lifecycle, including callbacks during initialization, atomic winner/telemetry claims, workspace ownership, and observable cleanup failures.
- Existing local pattern: `packages/dialer/src/services/parallel-dialer.spec.ts` with a fake Twilio client and `InMemoryParallelStore`.
- New tests: add `parallel-lifecycle.contract.spec.ts`; update adapter fixtures only where the package contract changes.
- Focused red command: `bunx jest packages/dialer/src/services/parallel-lifecycle.contract.spec.ts --runInBand` using the repository Jest configuration.
- Expected red failures: callback cannot resolve a group during provider creation; telemetry claim is not store-atomic; cleanup errors disappear; group lacks workspace ownership/scoped access.
- No-test waiver: none.

## current status

- Task started from current `stream/dialer`.
- Discovery confirms multiline mechanics already live in `packages/dialer`; the main risks are lifecycle persistence and duplicated adapter orchestration.
- No production code edited yet.

## key decisions

- Keep the conference/winner algorithm intact before the Effect/Hono extraction.
- Extend the existing `ParallelStore` contract rather than introduce a new package in PR 1.
- Treat `packages/api` and Twenty services as compatibility adapters; do not consolidate them yet.

## discovery evidence

- `initiateGroup` writes call mappings before the group and writes the group only after every provider call is created, so a fast callback can observe a mapping without group state.
- `markTelemetryEmittedIfAbsent` is a service read/check/write; the store contract has no atomic telemetry claim.
- `terminateCall` and `unmuteConferenceParticipant` swallow provider errors.
- `ParallelGroup` has queue/user ownership but no workspace ownership.
- Existing tests cover winner selection, machine rejection, duplicate callbacks, loser termination, conference mute behavior, TTL retention, and completion; PR 1 closes the uncovered gaps.

## files changed

- none yet

## notes for ko

- No live calls are planned in PR 1. This is deterministic lifecycle hardening before standalone server extraction.
- LeadConnector naming is out of scope for this branch.

## improvements noticed

- `packages/api` still duplicates parallel lifecycle and telemetry behavior; remove it only after the shared application path and Hono server exist.

## issues and recovery

- A discovery probe guessed a nonexistent Redis-store filename; recovered by enumerating actual package files.
- A repository scan used a 300 ms timeout; reran narrowly with the correct budget.
- The first workpad write included an unsupported flag and the second required explicit overwrite; recovered with the minimal forced write.

---

## publish checklist

- [ ] focused red captured
- [ ] focused green captured
- [ ] affected package/server suites pass
- [ ] typecheck passes
- [ ] `review.run` clean
- [ ] `verify` publish-valid
- [ ] merged into `stream/dialer`

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`
- `packages/dialer/src/services/parallel-dialer.ts`
- `packages/dialer/src/services/parallel-dialer.spec.ts`
- `packages/dialer/src/types.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- `packages/api/src/routes/parallel.ts`

- 2026-07-23 17:22:52 write: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-23 17:22:52 fs.write: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`
- 2026-07-23 17:24:38 fs.write: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`
- 2026-07-23 17:38:04 fs.write: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`
- 2026-07-23 17:50:01 fs.write: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`

## focused red evidence

Command: `bunx jest --config jest.config.mjs src/services/parallel-lifecycle.contract.spec.ts --runInBand` from `packages/dialer`.

Result: 6 tests executed; 4 failed and 2 passed.

Expected failures reproduced:
- callback during creation was dropped (`winnerSid` remained null)
- concurrent telemetry claims both returned true
- provider cleanup failure was not recorded
- workspace-scoped access method did not exist

Already-green contracts:
- simultaneous human callbacks retained exactly one durable winner in the current in-memory execution model
- an answered callback after terminal completion was ignored

- 2026-07-23 17:24:38 append: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 17:33:10 `review.run`: passed — OK
- 2026-07-23 17:35:30 `review.run`: passed — OK
- 2026-07-23 17:36:28 `review.run`: passed — OK
- 2026-07-23 17:37:31 `review.run`: passed — OK
- 2026-07-23 17:39:39 `verify`: failed — COMMAND_FAILED
- 2026-07-23 17:43:01 `review.run`: passed — OK
- 2026-07-23 17:44:50 `review.run`: passed — OK
- 2026-07-23 17:47:04 `verify`: failed — COMMAND_FAILED
- 2026-07-23 17:47:09 `verify`: failed — COMMAND_FAILED
- 2026-07-23 17:49:44 `verify`: passed — OK

## implementation completed

- Parallel groups are persisted before provider call creation begins.
- Each created provider leg is registered through the store contract while preserving callback mutations that occur during later leg creation.
- Group callback mutations are serialized through the store's explicit group-lock contract.
- Telemetry emission uses an explicit atomic store claim.
- Provider termination and conference-unmute failures are persisted as retryable cleanup failures; `retryPendingCleanup` reconciles them.
- Groups persist `workspaceId`; authenticated Twenty/API reads and termination use workspace-scoped contracts.
- Existing conference behavior remains unchanged: customer legs start muted, one winner is claimed, losers terminate, and the winner is unmuted.

## focused green evidence

- `packages/dialer`: 11 suites, 140 tests passed.
- New lifecycle contract: 7/7 passed, including initialization callback retention, concurrent winner/telemetry claims, terminal callback ordering, workspace ownership, failed loser termination, and failed winner unmute reconciliation.
- `packages/dialer` typecheck passed.
- `packages/dialer` build passed.
- Twenty compatibility adapters: 2 suites, 35 tests passed.
- Standalone API parallel route: 1 suite, 3 tests passed.
- No live call was placed in this PR.

## review evidence

- Final `review.run`: 0 issues introduced by this change.
- Inherited environment/project baseline remains:
  - shared worktree `node_modules/@consuelo/dialer` points at canonical-main declarations until merge/build
  - unrelated API suites (`ghl`, `local-presence`, `subscription`) fail in the broad package review
  - Twenty ESLint plugin artifacts are absent from this task worktree
  - broad Twenty typecheck retains its existing project-wide failures
- Focused source-backed tests and local dialer build/typecheck prove the changed contracts.

## files changed

- `packages/dialer/src/types.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/services/parallel-dialer.ts`
- `packages/dialer/src/services/parallel-dialer.spec.ts`
- `packages/dialer/src/services/parallel-lifecycle.contract.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- `packages/api/src/routes/parallel.ts`

## acceptance status

- [x] Preserve the conference multiline contract.
- [x] Add deterministic lifecycle coverage for callback ordering, simultaneous answers, machines/terminal behavior, and TTL retention through the combined package suites.
- [x] Persist initializing group state before provider calls.
- [x] Make winner and telemetry claims explicit atomic store operations.
- [x] Persist retryable provider cleanup failures.
- [x] Persist workspace ownership and workspace-scoped authenticated access.
- [x] Preserve Twenty GraphQL/REST compatibility without Hono, Effect restructuring, or LeadConnector work.
- [x] Focused tests, package build/typecheck, and changed-code review pass.

- 2026-07-23 17:38:04 append: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`

## final verification

- Full API Jest suite: 12 suites, 258 tests passed.
- Test-selection registry corrected so `api-package` invokes the package's declared Jest configuration instead of Bun's incompatible native test runner.
- Test-selection contract: 7/7 passed.
- Full Twenty server selection: 445 suites and 3,516 tests passed; 2 suites and 10 tests skipped by the existing project configuration.
- Final `review.run`: 0 introduced issues, 0 related pre-existing blockers, 0 failed suites.
- Final `verify`: passed, full mode, publish-valid stamp written to `.task/dialer/characterize-parallel-dial-lifecycle/verify.json`.
- No live call was placed.

## publish checklist

- [x] focused red captured
- [x] focused green captured
- [x] affected package/server suites pass
- [x] typecheck/build pass for changed dialer package
- [x] `review.run` clean for changed code
- [x] `verify` publish-valid
- [ ] task branch published and merged into `stream/dialer`

## next branch

- Branch: `task/dialer/extract-effect-application-core`
- Goal: reorganize the proven lifecycle into pure domain modules, Effect application programs, explicit ports, typed errors, and infrastructure adapters without changing behavior.
- Start from the freshly merged `stream/dialer`.
- First tests: move the lifecycle contract unchanged to the new application boundary and add typed-error/port-substitution tests before implementation.
- Non-goals: no Hono server, no Railway deployment, no LeadConnector extraction or embed work, no live calling.

- 2026-07-23 17:50:01 append: `.task/dialer/characterize-parallel-dial-lifecycle/workpad.md`
