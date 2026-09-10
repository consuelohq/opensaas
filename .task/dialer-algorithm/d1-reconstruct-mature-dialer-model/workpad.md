# D1 reconstruct mature dialer model

branch: `task/dialer-algorithm/d1-reconstruct-mature-dialer-model`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2007/d1-reconstruct-mature-dialer-model
github pr: https://github.com/consuelohq/opensaas/pull/2007
started: 2026-08-15

## acceptance criteria

- [x] Reconstruct the mature April predictive selection semantics from the shared dialer services plus the surviving Twenty adapters/queue flow.
- [x] Define a provider-neutral `@consuelo/dialer` model/store contract scoped by workspace + segment; no LeadConnector or Twenty types may appear in that contract.
- [x] Codify candidate selection as: existing eligibility/cadence suppression upstream, stopping-model suppression for observed unprofitable attempts after attempt 2, then Whittle ranking.
- [x] Preserve attempt-number learning, local hour/day hazard matching, fallback hazard behavior, workspace economics, callable-window urgency, sample-size exploration, stale-attempt decay, and deterministic FIFO tie-breaking.
- [x] Preserve the mature cadence contract already owned by `CadenceOptimizerService`: fresh/aged buckets, >=50-sample learned policy, economics threshold, and static fallback behavior.
- [x] Do not wire the new contract into `dialer-server`, change persistence, or change production behavior in D1; D2 owns Postgres persistence and D3 owns runtime cutover.
- [x] Focused model contract tests, existing dialer tests, typecheck/build, strict review, and canonical verify are green.

## Test-first contract

Behavior to lock before production edits:

1. A provider-neutral predictive store is queried with `workspaceId`, `segmentId`, and the candidates' next attempt numbers.
2. The selector uses the exact local hour/day/attempt hazard when available; otherwise it falls back to the best same-attempt hazard estimate.
3. A candidate is suppressed by the stopping model only when an observed probability exists, the next attempt is greater than 2, and expected connection value is below attempt cost. Missing history must not silently become a stop signal.
4. Remaining candidates are ranked by the existing `WhittleIndexService`, including callable-window urgency, sample-size exploration, stale-attempt decay (>48h => 0.8 factor), and FIFO tie-breaking.
5. Cadence remains provider-neutral and preserves the existing fresh/aged + learned/fallback behavior; D1 must not duplicate cadence logic in an adapter.

First RED test: `packages/dialer/src/services/predictive-selection-model.contract.spec.ts` imports the not-yet-existing provider-neutral model/store contract and asserts the behaviors above. Expected RED reason: missing `PredictiveSelectionModel` / predictive model contract exports.

## plan

1. Read April 11-12 timing/stopping/Whittle/cadence commits and current Twenty queue adapters; record mature selection order and inputs.
2. Write the focused RED contract test before implementation.
3. Add the smallest provider-neutral core model/store types and pure selector in `packages/dialer`; do not touch server persistence/runtime wiring.
4. Run focused tests, then the full dialer package validation, typecheck/build, strict review, and canonical verify.
5. Publish D1 for review; do not start D2 in this task.

## current status

- D1 implementation is complete and isolated to `@consuelo/dialer`; no `dialer-server`, LeadConnector, Postgres, Redis, or production wiring changed.
- April lineage confirms timing -> stopping -> Whittle -> learned cadence, with Twenty acting as persistence/queue adapter. The Apr 11 integration explicitly described stopping as WHETHER to retry and timing as WHEN; a later review rewrite removed concrete timing scheduling without listing that as an intended behavior change. D1 preserves the durable separation without reviving stale delay constants.
- New provider-neutral selection and retry contracts are green. Missing stopping history is restored to `null`/no evidence instead of synthetic 0% probability.
- Final validation is green: Dialer 181/181, dialer-server 142 passed + 1 expected local-service skip, LeadConnector 122/122; logger/dialer/dialer-server/LeadConnector builds and typechecks passed; strict review and canonical verify have zero findings and a publish-valid stamp.

## files changed

- `packages/dialer/MODEL.md`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/services/call-timing-model.service.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/services/retry-decision-model.contract.spec.ts`
- `packages/dialer/src/services/retry-decision-model.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`
- `packages/dialer/src/services/stopping-model.ts`
- `packages/dialer/src/types.ts`

## workspace-owned: files changed

- `packages/dialer/MODEL.md`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/services/call-timing-model.service.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/services/retry-decision-model.contract.spec.ts`
- `packages/dialer/src/services/retry-decision-model.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`
- `packages/dialer/src/services/stopping-model.ts`
- `packages/dialer/src/types.ts`

## workspace-owned: activity log

- 2026-08-15 04:01:48 fs.write: `.task/dialer-algorithm/d1-reconstruct-mature-dialer-model/workpad.md`
- 2026-08-15 04:02:11 fs.write: `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- 2026-08-15 04:03:05 fs.write: `packages/dialer/src/services/predictive-selection-model.ts`
- 2026-08-15 04:11:27 fs.write: `packages/dialer/src/services/call-timing-model.service.ts`
- 2026-08-15 04:11:33 fs.write: `packages/dialer/src/services/stopping-model.ts`
- 2026-08-15: audited April model commits and current Twenty queue/persistence adapters.
- 2026-08-15: started D1 from `stream/dialer-algorithm` after D0 merged.

## workspace-owned: validation evidence

- 2026-08-15 04:08:29 `review.run`: passed — OK
- 2026-08-15 04:10:05 `review.run`: passed — OK
- 2026-08-15 04:10:52 `verify`: failed — COMMAND_FAILED
- 2026-08-15 04:11:51 `verify`: passed — OK

## key decisions

- D1 adds an executable provider-neutral model boundary but does not cut runtime traffic over to it.
- The mature selection order is cadence/attempt eligibility -> stopping suppression -> Whittle ranking.
- Missing stopping probability is not equivalent to zero-probability evidence; mature queue selection only stops on observed probability.
- The provider-specific LeadConnector outcome table is not part of the future predictive model contract.
- The durable retry architecture is: stopping/economics decides WHETHER; hazard timing supplies a preferred WHEN window; cadence decides HOW OFTEN/spacing; runtime/provider adapters schedule the concrete legal call.
- D1 intentionally does not restore the Apr 11 five-minute delay or later 30-second jitter. Those are runtime policy, not the model contract.
- Provider outcomes are normalized at the model boundary as human-answered vs no-human-answer; richer raw/provider outcomes remain eligible as future D4 signals without leaking provider types into the SDK.

## notes for ko

- D1 is deliberately behavior-contract work. D2 should implement `PredictiveModelStore` on Consuelo-owned Postgres and evolve D0 fixtures toward provider-neutral attempt/hazard observations. D3 should replace the current LeadConnector-specific runtime ranking path and prove parity before Twenty deletion.
- D1 does not require Railway/Twilio/GHL runtime proof because no runtime/persistence/provider wiring changed; D0 already proved the local Postgres/Redis harness on the stream baseline.

## improvements noticed

- The legacy `TimingModelStore` omits workspace scope even though the Twenty adapter accepted it as an implementation-only extra argument. D1's new predictive store makes workspace scoping explicit; D2 should implement that store directly rather than preserve the legacy mismatch.
- Current `dialer-server` ranking still reads LeadConnector-specific learning tables by design; D3 is the cutover gate, not D1.

## issues and recovery

- The stream-specific `packages/workspace/streams/dialer-algorithm/AGENTS.md` path is absent in this task worktree; used the durable `packages/workspace/streams/dialer/AGENTS.md` product architecture guidance plus current code/history.
- First strict-review re-run returned one transient 502; one retry succeeded with 0 D1-owned findings.
- `origin/stream/dialer-algorithm` is one already-merged main commit behind (OS #2004) because main advanced after stream initialization. The task itself has that main commit as an ancestor; task finish/stream promotion must reconcile the base so no unrelated OS diff is carried as D1 work.

---

## publish checklist

```bash
bun run task:push -- --message "feat(dialer): codify mature predictive model" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-15 04:01:48 write: `.task/dialer-algorithm/d1-reconstruct-mature-dialer-model/workpad.md`

- 2026-08-15 04:02:11 write: `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`

- 2026-08-15 04:03:05 write: `packages/dialer/src/services/predictive-selection-model.ts`

## workspace-owned: files read

- `packages/dialer/src/services/call-timing-model.service.ts`
- `packages/dialer/src/services/call-timing-model.spec.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/services/retry-decision-model.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`
- `packages/dialer/src/services/stopping-model.ts`
- `packages/dialer/src/types.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/retry-policy.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/retry-policy.ts`

- 2026-08-15 04:11:27 write: `packages/dialer/src/services/call-timing-model.service.ts`

- 2026-08-15 04:11:33 write: `packages/dialer/src/services/stopping-model.ts`
