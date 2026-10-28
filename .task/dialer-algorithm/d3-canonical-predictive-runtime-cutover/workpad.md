# D3 canonical predictive runtime cutover

branch: `task/dialer-algorithm/d3-canonical-predictive-runtime-cutover`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2023/d3-canonical-predictive-runtime-cutover
github pr: https://github.com/consuelohq/opensaas/pull/2023
started: 2026-08-15

## acceptance criteria

- [x] Replace the standalone runtime's legacy LeadConnector-outcome/`WhittleIndexService` ranking adapter with `PredictiveSelectionModel` backed by D2's canonical Postgres `PredictiveModelStore`.
- [x] Keep `contact_attempt_ledger` only as per-contact attempt state and as the count baseline needed to preserve lifetime attempt ordinals; response/timing/outcome evidence comes exclusively from `dialer_learning_observations`.
- [x] Preserve pre-D2 lifetime attempt indexing without backfilling legacy labels: canonical attempt number is `max(attempts_total - canonical_attempt_count, 0) + chronological canonical row_number`.
- [x] Pass an explicit model segment from runtime; standalone queue selection uses `queueId`, matching canonical telemetry's `campaignSegment || queueId` fallback semantics.
- [x] Runtime ranking never queries `consuelo_lead_connector_call_outcomes`, recomputes legacy local-time hazards, applies stale `0.8` decay, or instantiates `WhittleIndexService`.
- [x] Canonical stopping suppression applies before fanout, including a one-candidate predictive queue; all-suppressed selection yields the existing typed `NO_CALLABLE_TARGETS` failure before initiation.
- [x] With configured economics but no canonical response evidence, deterministic input/FIFO order is preserved; missing evidence is exploration/insufficient evidence, not a synthetic failure.
- [x] Canonical store/economics/database failure fails open to the current candidate order and emits the existing `dialer.predictive.fifo_fallback` event exactly once for the ranking operation.
- [x] D3 parity means stable queue/fanout/fallback contracts, not numerical equality with the scientifically-discarded legacy Whittle heuristic.
- [x] Real isolated Postgres/Redis proof demonstrates runtime ranking is driven by canonical observations even when compatibility outcome rows contain contradictory values, and proves legacy baseline ordinals `[3, 4]` from four lifetime attempts / two canonical observations.
- [x] Do not invent a retry scheduler in D3. `RetryDecisionModel` remains a provider-neutral core contract until the standalone runtime owns an explicit scheduling surface; queue/cadence policy remains unchanged.
- [x] Dialer, dialer-server, and LeadConnector focused/full tests, typechecks, builds, strict review, and isolated service-backed lab are green on the final publish state; canonical verify is the final pre-push gate below.
- [ ] Publish D3 into `stream/dialer-algorithm` only; do not merge the stream to `main` in this task.

## Test-first contract

behavior under test:
1. The runtime adapter may read `contact_attempt_ledger`, `dialer_learning_observations`, and `dialer_workspace_settings`, but never `consuelo_lead_connector_call_outcomes`, `core.*`, or `WhittleIndexService`.
2. Canonical Wilson evidence determines ranking: when candidate B's canonical optimistic response evidence exceeds candidate A's, B ranks first.
3. Runtime passes the queue id as the predictive segment id, so stored segment evidence and runtime selection address the same population.
4. Stopping suppression applies to next attempt > 2 when the Wilson upper bound is economically unprofitable; a suppressed candidate is absent from the returned dial targets even when it is the only target.
5. No canonical hazard/attempt evidence with valid economics preserves input order deterministically.
6. Missing/invalid economics or canonical-store failure returns FIFO input order and invokes the fallback logger once.
7. The isolated local lab can make compatibility outcomes contradict canonical observations without changing runtime ranking, proving the old table is no longer a decision input.
8. Static/runtime contract tests assert the standalone server contains no pre-D3 Whittle/legacy-outcome ranking path.

existing local pattern:
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts` is the runtime persistence-boundary contract.
- `packages/dialer-server/src/runtime/railway.test.ts` proves queue runtime composition and fallback behavior.
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts` is the isolated real Postgres/Redis service-backed proof.

new or changed tests:
- Rewrite `predictive-target-ranking.test.ts` around canonical store delegation, stopping, missing evidence, and error fallback.
- Update Railway predictive fixtures/tests to answer canonical store SQL and assert queue-id segment semantics.
- Extend the local lab integration proof so contradictory legacy outcomes cannot alter canonical runtime ranking.

focused red command:
- `bun test packages/dialer-server/src/runtime/predictive-target-ranking.test.ts packages/dialer-server/src/runtime/railway.test.ts`

expected red failure:
- Current adapter still queries `consuelo_lead_connector_call_outcomes`, uses `WhittleIndexService`, ignores canonical model evidence/stopping, and does not accept/pass an explicit `segmentId`.

no-test waiver: not applicable.

## plan

1. Freeze D3 runtime cutover contracts with focused RED tests.
2. Replace the ranking adapter with canonical `PredictiveSelectionModel` + `createPostgresPredictiveModelStore`, retaining the attempt ledger only for candidate state.
3. Wire `queueId` as `segmentId` in Railway and preserve explicit FIFO fallback logging on canonical-store failure.
4. Extend the isolated lab to prove canonical decisions are independent from contradictory compatibility outcomes.
5. Run focused GREEN, full package tests/typechecks/builds, strict review, canonical verify, and a final real Postgres/Redis integration run.
6. Push D3, promote it into `stream/dialer-algorithm`, then clean the task worktree. Do not touch `main`.

## current status

- Runtime cutover implementation and final publish-state package validation are complete; canonical verify is the remaining pre-push gate.
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts` is provider-neutral, uses `PredictiveSelectionModel`, and has no `WhittleIndexService`, compatibility-outcome query, or LeadConnector package dependency.
- Railway passes resolved `queueId` as the canonical predictive `segmentId`.
- Canonical stopping is enforced before fanout; all-suppressed queues fail with `NO_CALLABLE_TARGETS` before provider/mock initiation.
- Real isolated Postgres/Redis evidence proves canonical ranking wins against an intentionally contradictory compatibility model and preserves lifetime attempt ordinals across the D2 observation boundary.
- The standalone server still has no retry-scheduling surface consuming `RetryDecisionModel.preferredWindow`; D3 intentionally does not manufacture one.
- Final publish-state evidence before canonical verify: Dialer 200/200; dialer-server 154/154 with one expected opt-in lab skip in the ordinary suite; LeadConnector 122/122; all three typechecks green; all three builds green; strict review 0 findings / 0 failed suites; opt-in isolated Postgres/Redis lab 1/1 with 21 assertions.

## key decisions

- Preserve `contact_attempt_ledger` attempt totals because D2 intentionally did not backfill canonical observations. The canonical store uses the count difference `attempts_total - canonical_attempt_count` only as the pre-canonical ordinal baseline; it does not use legacy outcomes as statistical evidence.
- Use `queueId` as the standalone runtime segment because canonical telemetry stores `campaignSegment?.trim() || queueId`, and this runtime path has queue identity but no separate campaign-segment field.
- Missing canonical evidence with valid economics should remain deterministic FIFO through equal optimistic scores; actual persistence/economics failure uses the explicit fallback path.
- Scientific differences from the legacy Whittle score are intentional and should not be hidden behind a parity requirement.

## files changed

- `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/src/services/whittle-index.service.ts`

## workspace-owned: files changed

- `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`

## workspace-owned: activity log

- 2026-08-15 04:47:36 fs.write: `.task/dialer-algorithm/d3-canonical-predictive-runtime-cutover/workpad.md`
- 2026-08-15 04:48:03 fs.write: `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- 2026-08-15 04:48:27 fs.write: `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- 2026-08-15 04:49:34 fs.write: `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- 2026-08-15 04:49:56 fs.write: `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- managed by workspace tooling.

## workspace-owned: validation evidence

- none yet.
- 2026-08-15 04:56:18 `review.run`: passed — OK
- 2026-08-15 final package tests: Dialer 200 pass / 0 fail; dialer-server 154 pass / 1 expected skip / 0 fail; LeadConnector 122 pass / 0 fail.
- 2026-08-15 final typechecks: Dialer, dialer-server, and LeadConnector all passed.
- 2026-08-15 final builds: Dialer, dialer-server, and LeadConnector all passed.
- 2026-08-15 05:00 strict `review.run`: passed with 0 findings and 0 failed suites.
- 2026-08-15 05:00 isolated Postgres/Redis lab: 1 pass / 0 fail / 21 assertions; canonical attempt 2 beats contradictory compatibility attempt 1 and legacy baseline ordinals resolve to [3, 4].
- 2026-08-15 05:00:25 `review.run`: passed — OK
- 2026-08-15 05:00:56 `verify`: passed — OK

## notes for ko

- D3 is the standalone predictive-selection cutover. It deliberately does not add a new retry scheduler; that would be a separate product/runtime change rather than a safe cutover.

## improvements noticed

- `callableWindowEndHour` remains in the provider-neutral selection input for contract compatibility, but D2 correctly removed the old batch-constant urgency score; D3 should pass it through without reintroducing that heuristic.

## issues and recovery

- The workspace steering advertised a string-replace mutation that this task runner did not expose. The attempted mutation failed before touching files; edits continued through supported `fs.apply_patch`/`fs.write`.
- The first Railway composition test rejected any SQL text containing the compatibility table name, which also blocked schema initialization. The contract was narrowed to reject only decision-time `FROM consuelo_lead_connector_call_outcomes` reads.
- The all-suppressed integration assertion initially inspected `Effect.runPromise`'s `FiberFailure` wrapper directly. It was strengthened to inspect `runPromiseExit`/`Cause.failureOption` and assert the exact typed `NO_CALLABLE_TARGETS` failure.
- Final scientific sweep found that using raw lifetime `attempts_total` with D2's canonical row number would misindex contacts with pre-D2 history. Added the ledger-minus-canonical baseline offset, contract RED/GREEN evidence, and real Postgres proof before publish.

---

## publish checklist

```bash
bun run task:push -- --message "feat(dialer): cut predictive runtime to canonical model" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-15 04:47:36 write: `.task/dialer-algorithm/d3-canonical-predictive-runtime-cutover/workpad.md`

- 2026-08-15 04:48:03 write: `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`

- 2026-08-15 04:48:27 write: `packages/dialer-server/src/runtime/predictive-target-ranking.ts`

## workspace-owned: files read

- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/errors/dialer-errors.ts`
- `packages/dialer/src/ports/dialer-call-start.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/types.ts`

- 2026-08-15 04:57:32 apply-patch: `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- 2026-08-15 04:57:48 apply-patch: `packages/dialer-server/src/learning/postgres-predictive-model-store.ts`
- 2026-08-15 04:58:06 apply-patch: `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- 2026-08-15 04:58:06 apply-patch: `packages/dialer-server/src/lab/local-dialer-lab.ts`
- 2026-08-15 04:58:20 apply-patch: `packages/dialer/MODEL.md`
- 2026-08-15 04:58:20 apply-patch: `packages/dialer/src/services/whittle-index.service.ts`
- 2026-08-15 04:58:31 apply-patch: `packages/dialer/MODEL.md`

- 2026-08-15 04:58:46 apply-patch: `.task/dialer-algorithm/d3-canonical-predictive-runtime-cutover/workpad.md`

- 2026-08-15 05:00:44 apply-patch: `.task/dialer-algorithm/d3-canonical-predictive-runtime-cutover/workpad.md`
