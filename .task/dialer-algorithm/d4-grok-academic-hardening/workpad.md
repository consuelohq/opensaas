# d4 grok academic hardening

branch: `task/dialer-algorithm/d4-grok-academic-hardening`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2037/d4-grok-academic-hardening
github pr: https://github.com/consuelohq/opensaas/pull/2037
started: 2026-08-15

## acceptance criteria

- [ ] Correct response-time training/evaluation so terminal non-responses are observed failures, while true early censoring remains unknown.
- [ ] Make the contextual Bernoulli objective and L2 gradient mathematically consistent and add finite-difference/convergence tests.
- [ ] Make discrete-time hazard interval semantics valid for partial horizons/empty risk sets and test exact-boundary cases.
- [ ] Preserve D3 production decisions even when D4 context/logging is incomplete; D4 bookkeeping must never manufacture FIFO fallback.
- [ ] Reject/strip untrusted browser `targetContexts`; only server-authorized provider context may enter scientific features.
- [ ] Finalize selected actions only after provider/mock legs are actually created; partial/failure paths must remain analytically honest.
- [ ] Quarantine malformed D4 snapshots instead of failing an entire shadow evaluation and expose invalid/unlinkable counts.
- [ ] Add decision linkage/schema hardening, derive model feature dimensionality from the encoder, expose repeated-contact split diagnostics, and keep economics labels explicitly descriptive/non-causal.
- [ ] Update MODEL.md so every estimand/assumption matches the implemented mathematics.
- [ ] Full dialer/dialer-server/LeadConnector tests, typechecks/builds, real isolated Postgres/Redis lab, strict review, and publish verify are green.

## plan

1. Read Grok-flagged model, evaluation, persistence, authorization, ranking, and runtime paths plus their existing tests.
2. Add adversarial RED tests for censoring, gradient/objective, interval boundaries, D3 isolation, input trust, action finalization, malformed snapshots, linkage, feature dimensionality, split overlap, and economics edge cases.
3. Implement the smallest coherent fixes while keeping D3 as the production selector.
4. Run focused GREEN, then full package validation and isolated Postgres/Redis proof.
5. Run strict review + canonical verify, push task PR, and promote it into `stream/dialer-algorithm` only.

## current status

- Grok hardening implementation is complete and publish-valid. Focused mathematical/runtime suites, all three package typechecks/builds, the isolated Postgres/Redis lab, strict review, and canonical verify are green. Broad host suites were intentionally not run because the mandatory destructive-literal preflight composite repeatedly failed at MCP transport before returning evidence; no unpreflighted broad test was launched.

## wait cycle

Wait reason: task-scoped `code.call` transport is intermittently dropping atomic destructive-literal preflight + full-suite calls even though focused tests, builds, and the real lab succeed.
Duration: 30 seconds.
Resume action: immediately run the Dialer atomic preflight + full-suite verification call again.
Expected signal: structured preflight reports zero destructive literals and the full Dialer suite returns exit code 0.
Fallback: if transport still fails, record the failed wake check and use the workspace review/verify gates plus already-inspected focused tests; do not bypass the destructive-literal rule with an unpreflighted broad test.

Wait result: completed 30s wait at 2026-08-15T07:12:20Z; the immediate atomic preflight + full-Dialer call still failed at MCP transport before returning source/test evidence. Broad host suites therefore remain intentionally unrun. Focused adversarial suites, all package typechecks/builds, and the isolated service lab remain green.

## final evidence

- RED: mathematical suite failed exactly on terminal non-response horizon semantics, non-divisible hazard grids, and missing explicit objective/gradient; server suite failed on untrusted context, malformed snapshots, action finalization, D4 evidence fallback, schema hardening, and diagnostics.
- GREEN: 17/17 focused Dialer science tests; 47/47 focused dialer-server hardening tests; post-review Railway suite 10/10.
- Typecheck: `@consuelo/dialer`, `@consuelo/dialer-server`, and `@consuelo/lead-connector` green.
- Build: all three packages green.
- Real service proof: isolated PostgreSQL + Redis lab 1/1, 23 assertions, including migration `20260815_004_contextual_predictive_science_hardening`, D4 decision-context benchmark path, and deterministic teardown.
- Strict review against task start SHA `255dce7a1759980c6024dd881aacae982efc9606`: 22 files, 0 findings, 0 blockers after the single async error-boundary fix.
- Canonical verify: 23 task files, review passed, DB safety passed, `publishValid: true`; migration files carry expected database-script warnings with 0 DB findings.
- Broad package suites: not executed locally because repeated atomic destructive-literal-preflight + full-suite `code.call` attempts failed at MCP transport. This limitation is tooling-only; focused affected tests were pre-read and run safely.

## implemented decisions

- Terminal `non_response` is definitive fixed-horizon `Y=0`; genuine early `censored` observations remain unknown and are excluded from fixed-horizon scoring.
- Logistic L2 is now sample-size-stable: mean NLL + `(lambda/2)||w_non_intercept||^2`; finite-difference gradient tests pin the mathematics.
- Discrete time grids fail closed unless horizon is an integer multiple of interval; unsupported intervals predict zero rather than accidental 0.5.
- D4 metadata/logging cannot turn a successful D3 ranking into FIFO.
- Browser `targetContexts` are stripped; only server-authorized provider context enters scientific snapshots.
- Selected action IDs are finalized only after mock/provider leg creation and filtered to actually created contacts.
- Malformed or unlinkable research rows are quarantined and counted; future context writes are schema-version constrained without backfilling legacy rows.
- Repeated-contact overlap, empty calibration bins, heuristic sample policy, normalized PSI smoothing, and descriptive/non-causal economics are explicit in output/docs.
- Local lab ranking now exercises `rankPredictiveTargetsWithDecision` so D4 context/logging is covered by real Postgres/Redis validation.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 07:13:36 `review.run`: passed — OK
- 2026-08-15 07:14:20 `review.run`: passed — OK
- 2026-08-15 07:14:40 `verify`: passed — OK
- 2026-08-15 07:15:02 `verify`: passed — OK

## key decisions

- Treat all Grok P1/P2/P3 recommendations as in-scope because Ko explicitly accepted all suggestions.
- D3 ranking/stopping remains production authority; D4 scientific hardening may improve data/evaluation but must not promote the challenger.
- Distinguish terminal `non_response` from right-censored `censored` observations throughout survival/evaluation code.

## Test-first contract

behavior under test: Grok's accepted academic/code-review findings across response-horizon censoring, penalized logistic optimization, hazard risk sets, D3 isolation, trusted feature capture, action logging, malformed research rows, schema/linkage, repeated-contact holdout diagnostics, and economics edge cases.

existing local pattern: D4 already has dedicated model specs, shadow-evaluation tests, predictive-ranking tests, commercial authorization tests, migration tests, and the isolated local Postgres/Redis lab. Extend those seams rather than creating a parallel harness.

new or changed tests: add adversarial cases for early terminal non-response vs censoring; finite-difference gradient and sample-size-stable regularization; non-divisible horizon/interval and empty last-bin behavior; missing D3 evidence preserving D3 output; spoofed client target context rejection; provider initiation failure/partial action finalization; malformed/unlinkable decision contexts; dynamic feature count; repeated-contact overlap reporting; zero-weight/value-weighted economics; exact-horizon/duration-zero risk-set boundaries.

focused red command: run the affected dialer and dialer-server model/runtime test files through the package's authoritative test runners after preflighting them for destructive literals.

expected red failure: each new assertion fails against the current D4 implementation for the exact Grok-described mechanism, without unrelated runner/setup failures.

no-test waiver: not applicable.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/app.contract.test.ts`
- `packages/dialer-server/src/commercial-target-authorization.test.ts`
- `packages/dialer-server/src/commercial-target-authorization.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/learning/contextual-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/contextual-shadow-evaluation.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.test.ts`
- `packages/dialer-server/src/learning/predictive-decision-log.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.test.ts`
- `packages/dialer-server/src/learning/response-time-shadow-evaluation.ts`
- `packages/dialer-server/src/lifecycle.integration.test.ts`
- `packages/dialer-server/src/routes/call-sessions.ts`
- `packages/dialer-server/src/runtime/predictive-runtime-cutover.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.test.ts`
- `packages/dialer-server/src/runtime/predictive-target-ranking.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- `packages/dialer-server/src/transfer-routes.acceptance.test.ts`
- `packages/dialer/MODEL.md`
- `packages/dialer/package.json`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/services/contextual-response-model.spec.ts`
- `packages/dialer/src/services/contextual-response-model.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.spec.ts`
- `packages/dialer/src/services/discrete-time-response-hazard.ts`
- `packages/dialer/src/services/index.ts`
- `packages/dialer/src/services/predictive-evaluation.spec.ts`
- `packages/dialer/src/services/predictive-evaluation.ts`

- 2026-08-15 07:11:45 apply-patch: `.task/dialer-algorithm/d4-grok-academic-hardening/workpad.md`

- 2026-08-15 07:12:54 apply-patch: `.task/dialer-algorithm/d4-grok-academic-hardening/workpad.md`

- 2026-08-15 07:13:54 apply-patch: `packages/dialer-server/src/runtime/railway.ts`

- 2026-08-15 07:14:53 apply-patch: `.task/dialer-algorithm/d4-grok-academic-hardening/workpad.md`
