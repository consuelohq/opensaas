# D2 scientific predictive learning persistence

branch: `task/dialer-algorithm/d2-scientific-predictive-learning-persistence`
stream: `stream/dialer-algorithm`
pr: https://github.com/consuelohq/opensaas/pull/2016
started: 2026-08-15

## acceptance criteria

- [x] Add an additive standalone Postgres migration for canonical, provider-neutral predictive-learning observations; do not use Twenty or LeadConnector table names in the model schema.
- [x] Persist one idempotent observation per dialer group leg using stable dialer-domain identity, segment, contact, attempted timestamp, local hour/day captured at observation time, and an explicit outcome class: response, non-response, or censored.
- [x] Treat winner-race/manual/ambiguous termination as censored rather than a Bernoulli failure; keep censored attempts in chronological attempt ordering but exclude them from success-rate denominators.
- [x] Derive attempt ordinal chronologically from `(attempted_at, group_id, position)` rather than callback arrival order.
- [x] Implement a workspace + segment scoped Postgres `PredictiveModelStore` that returns Bernoulli sufficient statistics and 95% Wilson score intervals for attempt and local hazard estimates.
- [x] Correct D1 scientific overclaims: the production-neutral selector must no longer call the ad-hoc economic score a Whittle index, must remove the uncalibrated 0.8 stale penalty and batch-constant urgency bonus from the predictive ranking path, and must expose uncertainty-aware priority scoring instead.
- [x] Stopping must be conservative under uncertainty: after the minimum-attempt guard, stop only when the Wilson upper confidence bound is below the break-even response probability; missing/uncensored-insufficient evidence must not become a zero-probability stop signal.
- [x] Timing/fallback selection must penalize lucky tiny bins by ranking evidence with the lower confidence bound when interval metadata exists.
- [x] Learned cadence profitability must use count-preserving aggregate evidence when available; hardcoded age/double-dial defaults remain explicitly policy fallbacks rather than being described as learned science.
- [x] Keep the existing runtime ranking path operational until D3. D2 may dual-write canonical learning observations, but must not cut production selection to the new store.
- [x] Do not backfill the canonical model from legacy parallel outcomes because legacy rows cannot distinguish competing-risk censoring; document this as an intentional scientific-integrity choice.
- [x] Focused mathematical tests, SQL/store contract tests, migration/idempotency tests, full Dialer + dialer-server + LeadConnector tests/typechecks/builds, strict review, canonical verify, and isolated Postgres/Redis lab integration are green.

## Test-first contract

Behavior to lock before production edits:

1. **Wilson estimator:** for integer `0 <= successes <= trials`, estimates stay in `[0,1]`, lower <= point <= upper, interval width shrinks with increasing equally-proportioned sample size, and known reference cases match the Wilson closed form at 95% confidence.
2. **Priority model:** predictive ranking uses an uncertainty-aware optimistic expected-net-value score; higher upper confidence bound increases priority, increasing cost decreases priority, and the new D1 selector does not apply the old arbitrary stale decay or batch-constant urgency term.
3. **Conservative stopping:** for attempt > 2, a point estimate below break-even is not enough to stop when its Wilson upper bound still crosses break-even; stopping occurs only when the upper bound is below break-even. Missing evidence remains `null`/continue.
4. **Censoring classification:** a non-winner leg terminated by winner-take-all without response evidence is censored; an explicit human-like answered leg is positive even if it loses the atomic winner race; machine/no-answer/busy/failed are observed non-responses; manual/ambiguous cancellation is censored.
5. **Canonical persistence:** duplicate telemetry for the same `(workspace, group, position)` is idempotent; canonical insertion gates the legacy ledger/outcome write so retries cannot double-count attempts.
6. **Chronological ordinal:** the Postgres store computes attempt number with a window ordered by event time and stable tie-breakers, independent of callback insertion order; censored rows consume an attempt ordinal but do not enter Bernoulli denominators.
7. **Local hazard:** stored local hour/day are computed at observation time in the configured IANA timezone, including DST behavior; store aggregation never recomputes historical local time from a later workspace setting.
8. **No biased backfill:** the D2 migration creates canonical structures without copying `consuelo_lead_connector_call_outcomes` into them.

Initial RED commands:

- `bun test packages/dialer/src/services/binomial-estimate.spec.ts packages/dialer/src/services/predictive-priority.contract.spec.ts packages/dialer/src/services/stopping-model.spec.ts`
  - Expected RED: Wilson estimator / predictive priority service do not exist and stopping does not accept interval evidence.
- `bun test packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts packages/dialer-server/src/runtime/lead-connector-learning.test.ts packages/dialer-server/src/database/migrations.test.ts`
  - Expected RED: canonical learning table/store/censoring contract do not exist.

## plan

1. Audit D1/D0 mathematics and identify estimator, censoring, calibration, and naming assumptions.
2. Write RED mathematical and persistence contracts before production edits.
3. Add Wilson/count-preserving core primitives and replace the D1 predictive path with scientifically named priority scoring while preserving compatibility exports outside that path.
4. Add the canonical observation migration, censoring-aware dual write, and Postgres predictive store.
5. Update the deterministic local lab to seed canonical observations and verify estimator recovery, chronological ordering, censoring, and idempotency against isolated Postgres/Redis.
6. Run focused and broad safe validation, strict review, canonical verify, then publish D2 into the stream only.

## current status

- Implementation and validation are complete; ready to publish into `stream/dialer-algorithm` only.
- D1's provider-neutral predictive path now uses uncertainty-aware optimistic expected net value rather than the legacy ad-hoc `WhittleIndexService`; that legacy service remains only for the pre-D3 compatibility runtime and is explicitly documented as not a formal Whittle index.
- D2 canonical observations distinguish `response`, `non_response`, and `censored`; competing-winner and ambiguous terminations no longer become synthetic Bernoulli failures.
- Attempt ordinal is derived chronologically with a stable SQL window before censoring is excluded from Bernoulli denominators.
- New telemetry is dual-written through the canonical observation insert as the idempotency gate. D3 still owns runtime model cutover.
- No legacy model backfill is performed because old outcome rows cannot recover competing-risk censoring labels.
- Final validation: Dialer 200/200; dialer-server 148/148 with one expected opt-in lab skip in the ordinary suite; LeadConnector 122/122; all three typechecks/builds green; strict review 0 findings/0 failed suites; canonical verify `publishValid: true`; final opt-in isolated Postgres/Redis lab 1/1 with 20 assertions.

## key decisions

- Use Wilson score intervals because the response target is Bernoulli and the closed-form interval behaves sensibly at small n and at 0/1 boundaries without pretending small samples are precise.
- Use the upper interval bound for conservative economic stopping and optimistic ranking; use the lower interval bound for evidence-backed timing-window choice.
- Keep legacy outcome persistence only as a D3 compatibility mirror; the canonical observation is the idempotency gate and scientific source of truth.
- Do not backfill legacy outcomes into canonical learning because the legacy schema cannot recover which parallel losses were censored.
- Preserve static cadence defaults as policy fallbacks; do not relabel them as statistically learned behavior.

## notes for ko

- D2 intentionally improved D1's statistical claims and decision math before persistence was wired. D3 still owns the runtime selection cutover; D2 does not change the production ranking source.
- The canonical schema retains response and observation-end timestamps so a future survival/time-to-response model can be evaluated without having discarded the raw censoring evidence.

## improvements noticed

- `dialer_workspace_settings` currently has no model timezone column; D2 will capture the configured runtime timezone into each observation's local hour/day instead of making historical bins depend on future configuration changes.
- The current global callable-window urgency bonus is identical for all candidates in a ranking batch and therefore cannot provide the claimed within-batch ordering signal.

## issues and recovery

- First `task.start` used the literal stream branch as `startFrom`; the tool accepts `startFrom: stream`, so the corrected call was used.
- First workpad overwrite omitted `force`; retried with `force: true` without touching production files.
- The first RED invocation sent `bun test ...` as Bun source through `code.call`; it failed in runner plumbing and was not counted as behavioral RED. Retried with `Bun.spawnSync`, which produced the expected missing-contract/model failures.
- Generic `container.exec` could not mount the OS-managed task worktree (`ENOENT`), so repository execution used the authenticated workspace runner. This was a tooling-surface limitation, not a code failure.
- Wilson 10/10 produced a floating-point upper endpoint infinitesimally below the point estimate; interval endpoints are now clamped to contain the observed point exactly.
- A terminal `no-answer` with AMD `unknown` could otherwise be classified human-like under one profile; response classification now requires actual `answeredAt` evidence.
- The local lab used position 0 before D2; canonical observations require positive dialer leg positions, so the lab was corrected to position 1.
- Broad dialer-server validation found one old D0 telemetry test asserting the four-value compatibility write. It was updated to assert the canonical idempotency CTE and full evidence tuple.
- Strict review's Jest runner initially rejected four new specs that imported `bun:test`; the specs were made runner-neutral and then passed both Bun and strict review.

## files changed

- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/src/domain/learning-observation.spec.ts`
- `packages/dialer/src/domain/learning-observation.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/services/binomial-estimate.spec.ts`
- `packages/dialer/src/services/binomial-estimate.ts`
- `packages/dialer/src/services/cadence-optimizer.service.ts`
- `packages/dialer/src/services/cadence-optimizer.spec.ts`
- `packages/dialer/src/services/call-timing-model.service.ts`
- `packages/dialer/src/services/call-timing-model.spec.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-priority.contract.spec.ts`
- `packages/dialer/src/services/predictive-priority.service.ts`
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/services/predictive-selection-science.spec.ts`
- `packages/dialer/src/services/retry-decision-model.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`
- `packages/dialer/src/services/stopping-model.ts`
- `packages/dialer/src/services/whittle-index.service.ts`
- `packages/dialer/src/types.ts`

## workspace-owned: files changed

- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/src/domain/learning-observation.spec.ts`
- `packages/dialer/src/domain/learning-observation.ts`
- `packages/dialer/src/services/binomial-estimate.spec.ts`
- `packages/dialer/src/services/binomial-estimate.ts`
- `packages/dialer/src/services/call-timing-model.spec.ts`
- `packages/dialer/src/services/predictive-priority.contract.spec.ts`
- `packages/dialer/src/services/predictive-priority.service.ts`
- `packages/dialer/src/services/predictive-selection-model.ts`
- `packages/dialer/src/services/predictive-selection-science.spec.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`

## workspace-owned: activity log

- 2026-08-15 04:24:36 fs.write: `.task/dialer-algorithm/d2-scientific-predictive-learning-persistence/workpad.md`
- 2026-08-15 04:26:20 fs.write: `packages/dialer/src/services/binomial-estimate.spec.ts`
- 2026-08-15 04:26:21 fs.write: `packages/dialer/src/services/predictive-priority.contract.spec.ts`
- 2026-08-15 04:26:21 fs.write: `packages/dialer/src/domain/learning-observation.spec.ts`
- 2026-08-15 04:26:31 fs.write: `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- 2026-08-15 04:26:56 fs.write: `packages/dialer/src/services/stopping-model.spec.ts`
- 2026-08-15 04:26:58 fs.write: `packages/dialer-server/src/database/migrations.test.ts`
- 2026-08-15 04:27:07 fs.write: `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- 2026-08-15 04:28:46 fs.write: `packages/dialer/src/services/predictive-selection-science.spec.ts`
- 2026-08-15 04:28:47 fs.write: `packages/dialer/src/services/call-timing-model.spec.ts`
- 2026-08-15 04:29:18 fs.write: `packages/dialer/src/services/binomial-estimate.ts`
- 2026-08-15 04:29:19 fs.write: `packages/dialer/src/services/predictive-priority.service.ts`
- 2026-08-15 04:29:20 fs.write: `packages/dialer/src/domain/learning-observation.ts`
- 2026-08-15 04:29:53 fs.write: `packages/dialer/src/services/predictive-selection-model.ts`
- 2026-08-15 04:31:15 fs.write: `packages/dialer-server/src/learning/postgres-predictive-model-store.ts`
- 2026-08-15 04:33:34 fs.write: `packages/dialer/MODEL.md`

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/learning/postgres-predictive-model-store.contract.test.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- `packages/dialer-server/src/runtime/lead-connector-learning.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/package.json`
- `packages/dialer/src/domain/parallel-profile.ts`
- `packages/dialer/src/ports/parallel-compatibility.ts`
- `packages/dialer/src/services/cadence-optimizer.spec.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- `packages/dialer/src/services/retry-decision-model.contract.spec.ts`
- `packages/dialer/src/services/stopping-model.spec.ts`
- `packages/dialer/src/services/whittle-index.service.ts`
- `packages/dialer/src/types.ts`
- `packages/lead-connector/package.json`

## workspace-owned: validation evidence

- 2026-08-15 04:36:49 `review.run`: passed — OK
- 2026-08-15 04:36:58 apply-patch: `packages/dialer/src/domain/learning-observation.spec.ts`
- 2026-08-15 04:36:58 apply-patch: `packages/dialer/src/services/binomial-estimate.spec.ts`
- 2026-08-15 04:36:58 apply-patch: `packages/dialer/src/services/predictive-priority.contract.spec.ts`
- 2026-08-15 04:36:58 apply-patch: `packages/dialer/src/services/predictive-selection-science.spec.ts`
- 2026-08-15 04:37:21 `review.run`: passed — OK
- 2026-08-15 04:37:36 `verify`: passed — OK
- 2026-08-15 04:39:11 apply-patch: `.task/dialer-algorithm/d2-scientific-predictive-learning-persistence/workpad.md`
- 2026-08-15 04:39:19 apply-patch: `.task/dialer-algorithm/d2-scientific-predictive-learning-persistence/workpad.md`
- 2026-08-15 04:39:26 apply-patch: `.task/dialer-algorithm/d2-scientific-predictive-learning-persistence/workpad.md`
- 2026-08-15 04:39:35 `verify`: passed — OK
