# d4 contextual predictive science

branch: task/dialer-algorithm/d4-contextual-predictive-science
stream: stream/dialer-algorithm
pr: https://github.com/consuelohq/opensaas/pull/2029

taskSession: tsk_6a860bc06520

## acceptance criteria
- [x] Keep D3 canonical predictive selection as the production control; D4 challenger output must not change which contacts are dialed.
- [x] Persist an immutable, versioned decision-time feature snapshot for canonical learning observations without storing contact name, email, raw tags, or other unnecessary PII.
- [x] Capture richer observable context already available at decision time: attempt state, spacing/recency, queue/segment context, candidate opportunity status/value, dial profile/position, and timezone provenance. Never label a workspace fallback as a contact-sourced timezone.
- [x] Add an additive standalone Postgres migration for D4 observation/decision science; do not rewrite D2 history or fabricate a legacy backfill.
- [x] Log predictive decisions with policy/model/schema version, eligible/ranked/suppressed/selected candidates, D3 predicted evidence, and policy mode. Deterministic D3 decisions record selection probability as null rather than manufacturing useful off-policy support.
- [x] Expose response-time/survival-ready domain observations from attempted/response/observed-until timestamps with explicit event/censor semantics.
- [x] Add provider-neutral contextual and discrete-time response-hazard challengers plus offline evaluators that score richer snapshots in shadow mode only, including Brier/log loss, calibration, chronological holdout, and drift diagnostics.
- [x] Candidate-specific economics are evaluated from immutable opportunity value plus configured close-rate/cost inputs without altering D3 production stopping/ranking.
- [x] Document scientific claims and non-claims: observational prediction, censoring limitations, descriptive economics, no causal uplift claim, no sequential-confidence claim from fixed-sample intervals, no Whittle-index claim, and no off-policy claim without genuine stochastic propensities/overlap.
- [x] Strict task-scoped workspace review passes. The repository-wide audit was executed and its pre-existing global script/docs/index drift is documented below rather than attributed to D4.
- [x] Full task verify gate passes before publish. Focused/full tests, typechecks, and service-backed database/Redis proof are green.

## plan
1. Lock the observation/decision contracts and test them red: immutable V2 context, truthful timezone provenance, survival row semantics, deterministic-policy propensity semantics, and additive migration.
2. Carry provider-neutral candidate context from LeadConnector queue candidates through the standalone call-start boundary into parallel telemetry and canonical persistence without PII.
3. Add D4 decision-science persistence and keep D3 authoritative; emit/log the challenger result without feeding it back into selection.
4. Implement a small regularized contextual probability challenger plus time-ordered evaluation/calibration/drift helpers, with deterministic fixtures and explicit insufficiency behavior.
5. Update MODEL.md with the D4 statistical boundary and promotion criteria; validate focused tests, typechecks, DB/runtime behavior, review, and verify before publishing.

## Test-first contract

behavior under test:
- D4 records the exact non-PII feature context available when a candidate was considered/attempted, preserves honest timezone provenance, and creates survival-ready observations.
- D4 records deterministic D3 policy decisions without pretending they provide stochastic propensities.
- D4 challenger/evaluator remains shadow-only and produces reproducible proper scoring/calibration/drift evidence from time-ordered fixtures.

existing local pattern:
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts` and `predictive-selection-science.spec.ts` define scientific selector contracts.
- `packages/dialer/src/domain/learning-observation.spec.ts` defines censoring/local-time semantics.
- `packages/dialer-server/src/runtime/lead-connector-learning.test.ts`, `predictive-target-ranking.test.ts`, `learning/postgres-predictive-model-store.contract.test.ts`, and `database/migrations.test.ts` define canonical persistence/runtime boundaries.

new or changed tests:
- Extend domain learning tests for response-time survival construction and timezone provenance.
- Add contextual challenger/evaluation science tests in `packages/dialer/src/services`.
- Extend migration + LeadConnector learning tests for versioned decision context and decision log schema.
- Extend standalone ranking/runtime tests to prove decision logging/shadow evaluation is additive and D3 order remains authoritative.
- Add server authorization proof that source context is captured from the server-authorized provider preview and excludes name/phone.
- Add decision-log proof that deterministic D3 propensities remain null and actual selection is finalized separately.
- Add shadow-evaluator proof that training precedes chronological holdout and tiny samples remain explicitly insufficient.

focused red command:
- `bun test packages/dialer/src/domain/learning-observation.spec.ts packages/dialer/src/services/contextual-response-model.spec.ts packages/dialer/src/services/predictive-evaluation.spec.ts packages/dialer-server/src/database/migrations.test.ts packages/dialer-server/src/commercial-target-authorization.test.ts packages/dialer-server/src/runtime/lead-connector-learning.test.ts packages/dialer-server/src/runtime/predictive-target-ranking.test.ts packages/dialer-server/src/learning/predictive-decision-log.test.ts packages/dialer-server/src/learning/contextual-shadow-evaluation.test.ts`

expected red failure:
- New D4 exports/types/tables/context persistence/evaluator do not exist yet, so new tests fail on missing symbols and missing migration/SQL fields while existing D3 assertions stay green.

red evidence:
- Preflight scanned all 9 focused test files for DROP/TRUNCATE/DELETE FROM/rm -rf/process.exit and found zero destructive patterns.
- Focused red run exited 1 as expected: missing `buildResponseTimeObservation`, contextual/evaluation modules, D4 migration ID, decision-log module, shadow evaluator, `rankPredictiveTargetsWithDecision`, target-context capture, and D4 observation columns. Existing LeadConnector learning initialization test passed.
- No production code had been edited before this red run.

no-test waiver: not applicable

## current status
- Implementation and scientific documentation are complete pending workspace review/audit/verify and publish.
- D3 remains the runtime control. The legacy `rankPredictiveTargets` API preserves its original target object shape and ordering semantics; D4 metadata is carried only through the explicit decision-aware runtime path.
- D4 source context is captured from the server-authorized LeadConnector queue preview. Current normalized provider data supplies opportunity value/status and pipeline/stage identity but no trustworthy contact timezone, so current runtime normally records `workspace_fallback` provenance rather than inferring from phone area code.
- D4 adds two shadow-only challengers: an L2-regularized contextual Bernoulli response model and a discrete-time response-hazard model with interval-specific baseline hazards and censor-safe person-period expansion.
- D4 evaluation uses chronological holdout, proper probabilistic scores, calibration bins, PSI drift monitoring, explicit insufficient-data states, D3 comparability only where D3 has real probability evidence, and censor-safe fixed-horizon scoring. The docs explicitly state remaining complete-case/informative-censoring limitations.
- Candidate economics use immutable opportunity value plus workspace close-rate/cost and are labeled descriptive/non-causal. The observed-response diagnostic is a `responseWeightedNetValueProxy`, not realized booked revenue.
- Service-backed isolated Postgres/Redis lab passed with the new `20260815_003_contextual_predictive_science` migration and full teardown.
- Strict `review.run` against `origin/stream/dialer-algorithm` is clean: 0 blocking issues, 0 failed test suites, 0 documentation opportunities.
- Full `verify` is green and publish-valid. DB safety inspection reports only the expected migration-script warnings for `migrations.ts` and its test, with zero findings.

## key decisions
- D4 is a shadow science layer, not a production policy cutover.
- Feature snapshots are immutable decision-time facts; current CRM state must never be joined later as if it were historical state.
- Do not infer contact timezone from phone area code in this task.
- Do not put arbitrary text, names, emails, raw tag sets, or LLM-derived lead-quality features into the first contextual model.
- Do not assign deterministic D3 1/0 action probabilities and call them usable propensity support; record policy mode and nullable propensity honestly.
- Capture queue opportunity context only from the server-authorized LeadConnector preview, not browser-supplied metadata.
- Keep contact-local timezone as a D4 feature/provenance signal; D3 production timing lookup remains on its existing workspace-time contract during D4.
- Preserve D3 canonical `local_hour`/`local_day_of_week` as workspace-local. Contact-local time belongs only to the D4 decision snapshot until a future production cutover owns that estimand explicitly.
- Separate the predictive ranking decision from the action actually taken after caller-ID capacity/fanout resolution. Final selected contact IDs are written later and workspace-scoped.
- Treat decision-log persistence as auxiliary: logging/finalization failures emit explicit runtime events but do not change D3 ranking or block calls. Canonical model-store failure remains the distinct FIFO-fallback condition.
- Do not compare the fixed-horizon survival probability directly with D3 response probability because they are different estimands.
- Do not score D3 `hazardSource = missing` placeholders as zero-probability forecasts in control comparisons.
- Keep high-cardinality pipeline/stage identity in the immutable snapshot but out of the first low-dimensional challenger. A future hierarchical/partially-pooled model can use those fields once sample volume supports it.

## issues and recovery
- Initial `task.start` call used an invalid boolean `github` value and full branch `startFrom`; retried with the supported `startFrom: stream` shape and created task/PR successfully.
- First workpad overwrite attempt omitted `force`; retried with explicit overwrite rather than appending duplicate sections.
- Workspace `dev` tooling was not discoverable through the current typed tool index. Used the repository's existing isolated local-dialer-lab integration instead: it launches ephemeral Postgres/Redis, uses no production credentials/providers, runs standalone migrations/benchmarks, and tears down deterministically.
- Repository-wide `audit --scripts --docs --index` is non-green on baseline drift outside this task: script parity mismatches, thousands of stale legacy doc paths, and a stale workspace index. The task diff does not touch those audit inventories/docs except D4 model documentation, and strict task review reports no D4 documentation opportunity or pre-existing issue in the affected projects.
- First strict review found six D4 async error-boundary findings plus three Jest suite-load failures caused by using `bun:test` imports in a Jest-owned package. Added explicit error mapping, removed the package-inconsistent imports, reproduced the three specs under the authoritative Jest config (3/3 suites, 9/9 tests), and reran strict review clean.
- Full dialer suite initially exposed one exact-object assertion after D4 added diagnostic probability fields to suppressed candidates; verified the stopping decision was unchanged and updated only the expected diagnostic shape.
- Full dialer-server suite initially exposed one exact SQL-values assertion; verified legacy behavior was unchanged and updated the expected three nullable D4 fields for pre-D4 telemetry.
- During implementation review, caught and fixed a potential scientific regression where contact-local time could have changed D3 canonical timing-bin semantics. Canonical D3 columns remain workspace-local; D4 contact-local time is isolated in `decision_context`.

## notes for Ko
- D4 PR is #2029. Promotion of any challenger into production selection is intentionally deferred until evaluation evidence exists.
- Current promotion evidence is intentionally infrastructure/science readiness only. No challenger has been promoted or allowed to influence call selection.
- Validation: authoritative dialer Jest review suite green; targeted new Jest specs 3/3 suites and 9/9 tests; dialer Bun suite 213/213 from the implementation pass; dialer-server 165 pass + 1 default-skipped lab test; explicit service-backed lab rerun 1/1 pass; both package typechecks green; strict review green; verify green/publish-valid.

## improvements noticed
- A provider-normalized, sourced contact timezone would materially improve the timing model later; the current LeadConnector normalized contract does not expose one.
- Future statistical work should evaluate hierarchical partial pooling for pipeline/stage/workspace effects rather than naive sparse one-hot cells.
- If censoring appears informative, add and validate a censoring model before claiming IPCW-adjusted fixed-horizon evaluation.
- Before any contextual-bandit/OPE work, introduce an explicitly stochastic logging policy with genuine action probabilities and verify support/overlap.

## final changed files
- 36 substantive files across `@consuelo/dialer` and `@consuelo/dialer-server`, plus `packages/dialer/MODEL.md` and task metadata/verify evidence.
- Core: predictive context/types, D3 diagnostic evidence, contextual Bernoulli challenger, discrete-time response-hazard challenger, survival observation helper, probabilistic evaluation helpers.
- Server: authorized source-context capture, additive D4 migration, predictive decision/action log, contextual and response-time shadow evaluators, decision-aware ranking adapter, canonical observation persistence, Railway action-finalization wiring, Twilio metadata transport.
- Tests: focused scientific contracts, migration/persistence/runtime/transport coverage, authoritative Jest compatibility, isolated Postgres/Redis lab assertion.

- 2026-08-15 05:39:37 write: `.task/dialer-algorithm/d4-contextual-predictive-science/workpad.md`

## files changed

- `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer/src/services/contextual-response-model.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.spec.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.ts`
- `packages/dialer/src/services/predictive-evaluation.ts`

## workspace-owned: files changed

- `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer/src/services/contextual-response-model.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.spec.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.ts`
- `packages/dialer/src/services/predictive-evaluation.ts`

## workspace-owned: activity log

- 2026-08-15 05:39:37 fs.write: `.task/dialer-algorithm/d4-contextual-predictive-science/workpad.md`
- 2026-08-15 05:39:49 apply-patch: `packages/dialer/src/types.ts`
- 2026-08-15 05:39:54 apply-patch: `packages/dialer/src/services/predictive-selection-model.ts`
- 2026-08-15 05:39:59 apply-patch: `packages/dialer/src/domain/learning-observation.ts`
- 2026-08-15 05:40:11 write: `packages/dialer/src/services/contextual-response-model.ts`
- 2026-08-15 05:40:11 fs.write: `packages/dialer/src/services/contextual-response-model.ts`
- 2026-08-15 05:40:23 write: `packages/dialer/src/services/predictive-evaluation.ts`
- 2026-08-15 05:40:23 fs.write: `packages/dialer/src/services/predictive-evaluation.ts`
- 2026-08-15 05:41:07 fs.write: `packages/dialer-server/src/learning/predictive-decision-log.ts`
- 2026-08-15 05:41:52 fs.write: `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- 2026-08-15 05:42:10 fs.write: `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- 2026-08-15 05:46:48 fs.write: `packages/dialer/src/services/discrete-time-response-hazard.spec.ts`
- 2026-08-15 05:47:10 fs.write: `packages/dialer/src/services/discrete-time-response-hazard.ts`
- 2026-08-15 05:47:38 fs.write: `packages/dialer-server/src/learning/response-time-shadow-evaluation.test.ts`
- 2026-08-15 05:48:09 fs.write: `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/commercial-target-authorization.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/jest.config.mjs`
- `packages/dialer/package.json`
- `packages/dialer/project.json`
- `packages/dialer/src/application/parallel-application.spec.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/domain/parallel-group.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/ports/dialer-call-start.ts`
- `packages/dialer/src/ports/parallel-compatibility.ts`
- `packages/dialer/src/services/call-timing-model.spec.ts`
- `packages/dialer/src/services/contextual-response-model.spec.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-selection-model.contract.spec.ts`
- `packages/dialer/src/services/stopping-model.ts`

## workspace-owned: validation evidence

- 2026-08-15 05:53:09 `audit`: failed — COMMAND_FAILED
- 2026-08-15 05:53:48 `review.run`: passed — OK
- 2026-08-15 05:54:15 apply-patch: `packages/dialer-server/src/learning/predictive-decision-log.ts`
- 2026-08-15 05:54:15 apply-patch: `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- 2026-08-15 05:54:15 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-08-15 05:54:21 apply-patch: `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- 2026-08-15 05:54:21 apply-patch: `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`
- 2026-08-15 05:54:45 apply-patch: `packages/dialer/src/services/contextual-response-model.spec.ts`
- 2026-08-15 05:54:45 apply-patch: `packages/dialer/src/services/discrete-time-response-hazard.spec.ts`
- 2026-08-15 05:54:45 apply-patch: `packages/dialer/src/services/predictive-evaluation.spec.ts`
- 2026-08-15 05:55:09 `review.run`: passed — OK
- 2026-08-15 05:55:23 apply-patch: `.task/dialer-algorithm/d4-contextual-predictive-science/workpad.md`
- 2026-08-15 05:55:43 `verify`: passed — OK
- 2026-08-15 05:55:53 apply-patch: `.task/dialer-algorithm/d4-contextual-predictive-science/workpad.md`
- 2026-08-15 05:56:07 `verify`: passed — OK
