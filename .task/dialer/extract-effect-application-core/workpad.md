# extract effect application core

branch: `task/dialer/extract-effect-application-core`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/1593
previous pr: https://github.com/consuelohq/opensaas/pull/1592
stream pr: https://github.com/consuelohq/opensaas/pull/1569
started: 2026-07-23

## acceptance criteria

- [x] Preserve PR #1592's lifecycle contract unchanged.
- [x] Introduce pure domain modules for groups, calls, transitions, profiles, and telemetry.
- [x] Introduce Effect application programs for start, callback processing, termination, cleanup retry, and lookup.
- [x] Introduce explicit provider/state/lock/telemetry/clock/id ports with deterministic test Layers.
- [x] Introduce typed provider, state, cleanup, transition, and timeout failures; preserve Effect interruption semantics with a durable failure finalizer.
- [x] Keep atomic winner and telemetry claims as store operations.
- [x] Preserve initialization callback retention, workspace ownership, durable cleanup failures, and conference winner/loser semantics.
- [x] Preserve the imperative `ParallelDialerService`, `InMemoryParallelStore`, existing package exports, and Twenty/API adapters through compatibility wrappers.
- [x] Pass dialer tests/typecheck/build, affected Twenty/API adapter tests, and repository review.
- [ ] Merge PR #1593 into `stream/dialer`; no live call is placed.

## plan

1. Record the unchanged PR #1592 baseline and inspect current Effect patterns.
2. Add pure-domain and Effect application tests first; run them red.
3. Extract the smallest transport-independent core while keeping the imperative façade stable.
4. Run the unchanged lifecycle contract and full package/adapter regression suites.
5. Review, verify, publish, merge to `stream/dialer`, and prepare branch-three handoff.

## Test-first contract

- Behavior under test:
  - pure callback transitions produce deterministic state/actions without provider or store access;
  - application programs accept deterministic test Layers;
  - provider, state, cleanup, transition, timeout, and interruption failures remain typed;
  - retry policy retries only retryable provider failures;
  - timeout/interruption during provider creation leaves a persisted, non-corrupt failed group;
  - existing atomic winner/telemetry, callback retention, workspace ownership, cleanup reconciliation, and conference semantics remain unchanged.
- Existing local pattern:
  - `packages/dialer/src/services/parallel-lifecycle.contract.spec.ts` is the authoritative lifecycle contract;
  - `packages/os/scripts/lib/code-call/service.ts` demonstrates small `Effect.gen` programs, typed `Effect.fail`, `Effect.ensuring`, and imperative `Effect.runPromise` wrappers.
- New tests:
  - `packages/dialer/src/domain/parallel-transition.spec.ts`;
  - `packages/dialer/src/application/parallel-application.spec.ts`.
- Focused red command:
  - `bunx jest --config jest.config.mjs src/domain/parallel-transition.spec.ts src/application/parallel-application.spec.ts --runInBand` from `packages/dialer`.
- Expected red failure:
  - required domain/application/port/error modules do not exist yet; after scaffolding assertions should fail until Effect orchestration and typed failure behavior are implemented.
- No-test waiver: none.

## current status

- Task started from the freshly merged `stream/dialer` at PR #1592's merge state.
- Unchanged lifecycle baseline passed before edits: 1 suite, 7/7 tests.
- Pure domain transitions, Effect application programs, typed ports/errors, Twilio and memory infrastructure Layers, and an imperative compatibility façade are implemented.
- Final local regression packet is green; publish verification and stream merge remain.

## discovery evidence

- `ParallelDialerService` is 926 lines and currently mixes pure decisions, Twilio access, state serialization, time/ID generation, retry/cleanup orchestration, TwiML, and the in-memory adapter.
- PR #1592 already provides the correct lifecycle behavior and atomic store contracts; this branch must reorganize ownership rather than redesign behavior.
- `packages/dialer` does not yet depend on Effect; repository Effect version is `^3.21.3`.
- Current OS Effect patterns live under `packages/os/scripts/lib/*`, not the stale `packages/os/src/tools/*` paths in the task brief.
- The available stream does not yet contain the parallel deployment-provider modules, so code-call/fs/stream patterns are the source of truth.
- No existing repository code uses `Context.Tag`/`Layer.succeed` on this stream; this branch will use them narrowly for meaningful dialer capabilities as explicitly required, not for pure utilities.

## key decisions

- Keep the old public service as an imperative compatibility façade that runs the new Effect programs.
- Keep domain transitions pure and return explicit provider cleanup actions; provider/store execution stays in application programs.
- Keep winner and telemetry claims in `ParallelStateStore`; never emulate atomicity with application read/check/write.
- Move the in-memory store and Twilio implementation behind infrastructure adapters while retaining old re-exports.
- Use Effect services only for provider, state, clock, ID, lock, and telemetry capabilities; pure profile/transition/telemetry helpers remain ordinary functions.
- Preserve external Effect interruption as interruption rather than disguising it as an ordinary typed failure; `onInterrupt` durably marks and cleans the initializing group, while provider timeout is a typed retryable `DialerTimeoutError`.
- Do not automatically retry call creation because a timed-out provider request may already have created a real call; retry classification is exposed through typed errors, while cleanup retries are explicit and only retry retryable cleanup records.

## notes for ko

- This branch does not change GraphQL, REST, Hono, Railway, Cloudflare, LeadConnector, or frontend behavior.
- No live call will be placed.

## improvements noticed

- The task batch wrapper did not propagate the outer task session to child `fs.read` calls; direct task-scoped reads were used instead.
- The prompt's Effect example paths were stale relative to `stream/dialer`; current implementations live under `packages/os/scripts/lib`.

## issues and recovery

- Initial multi-read batch failed with `AMBIGUOUS_TASK_SELECTION`; no files changed. Recovered by using direct calls with `taskSession: tsk_da266468f486`.
- Two one-line Bun search probes had malformed braces; no files changed. Recovered with typed `fs.search` and smaller read programs.

## files changed

- `.task/dialer/extract-effect-application-core/workpad.md`
- `packages/dialer/package.json`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/types.ts`
- `packages/dialer/src/application/cleanup-actions.ts`
- `packages/dialer/src/application/get-call-session.ts`
- `packages/dialer/src/application/parallel-application.spec.ts`
- `packages/dialer/src/application/process-provider-callback.ts`
- `packages/dialer/src/application/retry-pending-cleanup.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/application/terminate-call-session.ts`
- `packages/dialer/src/domain/parallel-call.ts`
- `packages/dialer/src/domain/parallel-group.ts`
- `packages/dialer/src/domain/parallel-profile.ts`
- `packages/dialer/src/domain/parallel-transition.spec.ts`
- `packages/dialer/src/domain/parallel-transition.ts`
- `packages/dialer/src/domain/telemetry.ts`
- `packages/dialer/src/errors/dialer-errors.ts`
- `packages/dialer/src/infrastructure/memory/parallel-state-store.ts`
- `packages/dialer/src/infrastructure/memory/runtime.ts`
- `packages/dialer/src/infrastructure/twilio/call-provider.ts`
- `packages/dialer/src/ports/call-provider.ts`
- `packages/dialer/src/ports/caller-id-lock-store.ts`
- `packages/dialer/src/ports/clock.ts`
- `packages/dialer/src/ports/id-generator.ts`
- `packages/dialer/src/ports/parallel-state-store.ts`
- `packages/dialer/src/ports/telemetry.ts`
- `packages/dialer/src/services/parallel-dialer.ts`
- `yarn.lock`

## implementation result

- The 926-line imperative `ParallelDialerService` is now a compatibility façade over Effect programs and infrastructure Layers.
- Pure domain functions own callback state transitions, AMD classification, winner plans, group cleanup bookkeeping, stale detection, and telemetry calculations.
- Named Effect programs own start, callback processing, termination, cleanup reconciliation, and lookup, with spans and structured log annotations.
- Provider, state, clock, ID, caller-ID lock, and telemetry capabilities are explicit ports. Winner and telemetry claims remain atomic state-store operations.
- The existing Promise-based `ParallelStore` contract is adapted into Effect rather than removed, preserving Redis/Twenty/API consumers.
- The legacy in-memory store moved into `infrastructure/memory` and remains re-exported.
- Twilio access moved into `infrastructure/twilio` with typed retryable/non-retryable provider failures.
- `@consuelo/dialer` now declares Effect and its own TypeScript toolchain, and its package build/typecheck scripts work directly.

## final validation evidence

- TDD red: new domain/application suites failed before implementation because the required modules and explicit Effect dependency did not exist.
- Focused green: 3 suites, 20/20 tests (`parallel-transition`, Effect application, unchanged lifecycle contract).
- Full dialer: 13 suites, 153/153 tests.
- PR #1592 lifecycle contract: unchanged and green, 7/7 tests.
- Twenty compatibility adapters: 2 suites, 35/35 tests.
- Legacy `packages/api` parallel adapter: 1 suite, 3/3 tests.
- `yarn workspace @consuelo/dialer typecheck`: passed.
- `yarn workspace @consuelo/dialer build`: passed.
- `review.run --strict --mine --no-tests`: zero introduced, related, or pre-existing findings in scope.
- Full `verify`: passed, publish-valid; review, tests, and database risk checks all green.
- No live Twilio call was placed.

## publish checklist

- [x] unchanged PR #1592 baseline captured
- [x] focused red captured
- [x] focused green captured
- [x] affected package/server/API suites pass
- [x] dialer typecheck/build pass
- [x] `review.run` clean
- [x] `verify` publish-valid
- [ ] published and merged into `stream/dialer`

- 2026-07-23 18:11:58 write: `.task/dialer/extract-effect-application-core/workpad.md`

## workspace-owned: files changed

- `.task/dialer/extract-effect-application-core/workpad.md`
- `packages/dialer/src/application/cleanup-actions.ts`
- `packages/dialer/src/application/get-call-session.ts`
- `packages/dialer/src/application/parallel-application.spec.ts`
- `packages/dialer/src/application/process-provider-callback.ts`
- `packages/dialer/src/application/retry-pending-cleanup.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/application/terminate-call-session.ts`
- `packages/dialer/src/domain/parallel-call.ts`
- `packages/dialer/src/domain/parallel-group.ts`
- `packages/dialer/src/domain/parallel-profile.ts`
- `packages/dialer/src/domain/parallel-transition.spec.ts`
- `packages/dialer/src/domain/parallel-transition.ts`
- `packages/dialer/src/domain/telemetry.ts`
- `packages/dialer/src/errors/dialer-errors.ts`
- `packages/dialer/src/infrastructure/memory/parallel-state-store.ts`
- `packages/dialer/src/infrastructure/memory/runtime.ts`
- `packages/dialer/src/infrastructure/twilio/call-provider.ts`
- `packages/dialer/src/ports/call-provider.ts`
- `packages/dialer/src/ports/caller-id-lock-store.ts`
- `packages/dialer/src/ports/clock.ts`
- `packages/dialer/src/ports/id-generator.ts`
- `packages/dialer/src/ports/parallel-state-store.ts`
- `packages/dialer/src/ports/telemetry.ts`
- `packages/dialer/src/services/parallel-dialer.ts`

## workspace-owned: activity log

- 2026-07-23 18:11:58 fs.write: `.task/dialer/extract-effect-application-core/workpad.md`
- 2026-07-23 18:13:03 fs.write: `packages/dialer/src/domain/parallel-transition.spec.ts`
- 2026-07-23 18:13:33 fs.write: `packages/dialer/src/application/parallel-application.spec.ts`
- 2026-07-23 18:13:48 fs.write: `.task/dialer/extract-effect-application-core/workpad.md`
- 2026-07-23 18:14:34 fs.write: `packages/dialer/src/errors/dialer-errors.ts`
- 2026-07-23 18:14:39 fs.write: `packages/dialer/src/domain/parallel-call.ts`
- 2026-07-23 18:14:44 fs.write: `packages/dialer/src/domain/parallel-profile.ts`
- 2026-07-23 18:14:53 fs.write: `packages/dialer/src/domain/parallel-group.ts`
- 2026-07-23 18:15:06 fs.write: `packages/dialer/src/domain/parallel-transition.ts`
- 2026-07-23 18:15:10 fs.write: `packages/dialer/src/domain/telemetry.ts`
- 2026-07-23 18:15:16 fs.write: `packages/dialer/src/ports/call-provider.ts`
- 2026-07-23 18:15:22 fs.write: `packages/dialer/src/ports/parallel-state-store.ts`
- 2026-07-23 18:15:27 fs.write: `packages/dialer/src/ports/clock.ts`
- 2026-07-23 18:15:30 fs.write: `packages/dialer/src/ports/id-generator.ts`
- 2026-07-23 18:15:36 fs.write: `packages/dialer/src/ports/caller-id-lock-store.ts`
- 2026-07-23 18:15:40 fs.write: `packages/dialer/src/ports/telemetry.ts`
- 2026-07-23 18:16:14 fs.write: `packages/dialer/src/application/cleanup-actions.ts`
- 2026-07-23 18:16:26 fs.write: `packages/dialer/src/application/start-parallel-session.ts`
- 2026-07-23 18:16:33 fs.write: `packages/dialer/src/application/process-provider-callback.ts`
- 2026-07-23 18:16:39 fs.write: `packages/dialer/src/application/terminate-call-session.ts`
- 2026-07-23 18:16:46 fs.write: `packages/dialer/src/application/retry-pending-cleanup.ts`
- 2026-07-23 18:16:51 fs.write: `packages/dialer/src/application/get-call-session.ts`
- 2026-07-23 18:17:21 fs.write: `packages/dialer/src/infrastructure/memory/parallel-state-store.ts`
- 2026-07-23 18:17:30 fs.write: `packages/dialer/src/infrastructure/twilio/call-provider.ts`
- 2026-07-23 18:17:39 fs.write: `packages/dialer/src/infrastructure/memory/runtime.ts`
- 2026-07-23 18:18:10 fs.write: `packages/dialer/src/services/parallel-dialer.ts`

## workspace-owned: files read

- `packages/dialer/tsconfig.json`
- `packages/workspace/scripts/task-push.js`

## focused red evidence

Command: `bunx jest --config jest.config.mjs src/domain/parallel-transition.spec.ts src/application/parallel-application.spec.ts --runInBand` from `packages/dialer`.

Result: 2 suites failed before executing tests, as expected for the pre-implementation contract.

Failures:

- `parallel-transition` domain module does not exist.
- `effect` is not resolvable from `packages/dialer`, confirming it must be added as an explicit runtime dependency rather than borrowed transitively from OS/workspace.
- The application, port, and typed error modules referenced by the test do not exist yet.

No production code had been edited when this red was captured.

- 2026-07-23 18:13:48 append: `.task/dialer/extract-effect-application-core/workpad.md`

- 2026-07-23 18:14:34 write: `packages/dialer/src/errors/dialer-errors.ts`

- 2026-07-23 18:14:39 write: `packages/dialer/src/domain/parallel-call.ts`

- 2026-07-23 18:14:44 write: `packages/dialer/src/domain/parallel-profile.ts`

- 2026-07-23 18:14:53 write: `packages/dialer/src/domain/parallel-group.ts`

- 2026-07-23 18:15:06 write: `packages/dialer/src/domain/parallel-transition.ts`

- 2026-07-23 18:15:10 write: `packages/dialer/src/domain/telemetry.ts`

- 2026-07-23 18:15:16 write: `packages/dialer/src/ports/call-provider.ts`

- 2026-07-23 18:15:22 write: `packages/dialer/src/ports/parallel-state-store.ts`

- 2026-07-23 18:15:27 write: `packages/dialer/src/ports/clock.ts`

- 2026-07-23 18:15:30 write: `packages/dialer/src/ports/id-generator.ts`

- 2026-07-23 18:15:36 write: `packages/dialer/src/ports/caller-id-lock-store.ts`

- 2026-07-23 18:15:40 write: `packages/dialer/src/ports/telemetry.ts`

- 2026-07-23 18:16:14 write: `packages/dialer/src/application/cleanup-actions.ts`

- 2026-07-23 18:16:26 write: `packages/dialer/src/application/start-parallel-session.ts`

- 2026-07-23 18:16:33 write: `packages/dialer/src/application/process-provider-callback.ts`

- 2026-07-23 18:16:39 write: `packages/dialer/src/application/terminate-call-session.ts`

- 2026-07-23 18:16:46 write: `packages/dialer/src/application/retry-pending-cleanup.ts`

- 2026-07-23 18:16:51 write: `packages/dialer/src/application/get-call-session.ts`

- 2026-07-23 18:17:21 write: `packages/dialer/src/infrastructure/memory/parallel-state-store.ts`

- 2026-07-23 18:17:30 write: `packages/dialer/src/infrastructure/twilio/call-provider.ts`

- 2026-07-23 18:17:39 write: `packages/dialer/src/infrastructure/memory/runtime.ts`

- 2026-07-23 18:17:51 apply-patch: `packages/dialer/package.json`
- 2026-07-23 18:17:51 apply-patch: `packages/dialer/src/types.ts`
- 2026-07-23 18:18:10 write: `packages/dialer/src/services/parallel-dialer.ts`

- 2026-07-23 18:19:49 apply-patch: `packages/dialer/src/infrastructure/memory/parallel-state-store.ts`
- 2026-07-23 18:20:00 apply-patch: `packages/dialer/src/infrastructure/memory/parallel-state-store.ts`
- 2026-07-23 18:21:02 apply-patch: `packages/dialer/src/application/retry-pending-cleanup.ts`
- 2026-07-23 18:21:02 apply-patch: `packages/dialer/src/services/parallel-dialer.ts`
- 2026-07-23 18:21:02 apply-patch: `packages/dialer/src/application/parallel-application.spec.ts`
- 2026-07-23 18:21:28 apply-patch: `packages/dialer/package.json`
- 2026-07-23 18:21:28 apply-patch: `packages/dialer/src/application/start-parallel-session.ts`
- 2026-07-23 18:21:28 apply-patch: `packages/dialer/src/application/process-provider-callback.ts`
- 2026-07-23 18:21:28 apply-patch: `packages/dialer/src/application/terminate-call-session.ts`
- 2026-07-23 18:21:28 apply-patch: `packages/dialer/src/application/retry-pending-cleanup.ts`
- 2026-07-23 18:21:28 apply-patch: `packages/dialer/src/application/get-call-session.ts`
- 2026-07-23 18:21:39 apply-patch: `packages/dialer/src/index.ts`

- 2026-07-23 18:23:12 apply-patch: `packages/dialer/src/application/parallel-application.spec.ts`
- 2026-07-23 18:25:14 apply-patch: `packages/dialer/src/services/parallel-dialer.ts`

## workspace-owned: validation evidence

- 2026-07-23 18:25:47 `review.run`: passed — OK
- 2026-07-23 18:26:28 apply-patch: `packages/dialer/src/infrastructure/memory/parallel-state-store.ts`
- 2026-07-23 18:26:28 apply-patch: `packages/dialer/src/infrastructure/twilio/call-provider.ts`
- 2026-07-23 18:27:10 `review.run`: passed — OK
- 2026-07-23 18:27:57 apply-patch: `.task/dialer/extract-effect-application-core/workpad.md`
- 2026-07-23 18:28:15 `verify`: failed — COMMAND_FAILED
- 2026-07-23 18:28:21 apply-patch: `packages/dialer/src/services/parallel-dialer.ts`
- 2026-07-23 18:28:30 `review.run`: passed — OK
- 2026-07-23 18:28:42 `verify`: passed — OK
- 2026-07-23 18:28:48 apply-patch: `.task/dialer/extract-effect-application-core/workpad.md`
- 2026-07-23 18:28:54 `verify`: passed — OK
