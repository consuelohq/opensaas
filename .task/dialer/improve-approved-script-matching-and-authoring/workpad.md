# Improve approved Script matching and authoring

branch: `task/dialer/improve-approved-script-matching-and-authoring`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2804/improve-approved-script-matching-and-authoring
github pr: https://github.com/consuelohq/opensaas/pull/2804
started: 2026-11-14

## acceptance criteria

- [x] Reviewed trigger authoring, exact source/rules approval, optimistic publication and immutable active-call version.
- [x] Generic phrase matching safety, manual-only semantics, bounded contextual input/admission and truthful captured-evidence checkpoints.
- [x] Reproducible fixed-corpus evaluation, explicit rejected literal-rule hypothesis, opt-in provider harness and durable spending reservations.
- [x] Actual component browser upload/edit/review/publish/reload and isolated Hono/PostgreSQL race proof.
- [ ] Real model quality passes unchanged recall/false/late gates; blocked on OpenRouter credits and separate paid-run approval.

## plan

1. Preserve exact published candidate and current main ancestry in this owned managed task.
2. Implement and independently review disjoint authoring, matching, transport and evaluation boundaries with Sol/Terra workers, at most three at once.
3. Run frozen-source package checks, strict review and full verify, then consolidate into the existing draft candidate.
4. Refresh provider metadata and obtain separate capped-run approval after the account is funded. Do not move to live permissions or QA before matching evidence is sufficient.

## current status

Source implementation is prepared for draft review; semantic matching quality is NOT accepted yet. Literal rules measured31/60fixed and10/24independent positive hits with24/24negative abstentions and zero wrong/late cues, so that hypothesis was rejected. Contextual selector and its opt-in synthetic harness are implemented and mechanically tested, not model-evaluated. No provider inference, main merge, deployment or live calls have occurred.

## files changed

- `packages/dialer-server/README.md`
- `packages/dialer-server/src/coaching-replay/README.md`
- `packages/dialer-server/src/coaching-replay/artifact.ts`
- `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- `packages/dialer-server/src/coaching-replay/compare.test.ts`
- `packages/dialer-server/src/coaching-replay/compare.ts`
- `packages/dialer-server/src/coaching-replay/observer.test.ts`
- `packages/dialer-server/src/coaching-replay/observer.ts`
- `packages/dialer-server/src/coaching-replay/production.ts`
- `packages/dialer-server/src/coaching-replay/runner.test.ts`
- `packages/dialer-server/src/coaching-replay/runner.ts`
- `packages/dialer-server/src/coaching/playbook-store.ts`
- `packages/dialer-server/src/coaching/playbooks.postgres.integration.test.ts`
- `packages/dialer-server/src/coaching/playbooks.ts`
- `packages/dialer-server/src/coaching/review-regressions.test.ts`
- `packages/dialer-server/src/coaching/script-engine.ts`
- `packages/dialer-server/src/routes/mercury.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring.ts`
- `packages/dialer-server/src/coaching-replay/browser-fixture-entry.ts`
- `packages/dialer-server/src/coaching-replay/browser-fixture.ts`
- `packages/dialer-server/src/coaching-replay/independent-cases.json`
- `packages/dialer-server/src/coaching-replay/independent.ts`
- `packages/dialer-server/src/coaching-replay/provider-artifact.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-artifact.ts`
- `packages/dialer-server/src/coaching-replay/provider-benchmark.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-benchmark.ts`
- `packages/dialer-server/src/coaching-replay/provider-budget.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-budget.ts`
- `packages/dialer-server/src/coaching-replay/provider-cli.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-cli.ts`
- `packages/dialer-server/src/coaching-replay/provider-config.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-config.ts`
- `packages/dialer-server/src/coaching-replay/provider-haiku.draft.json`
- `packages/dialer-server/src/coaching-replay/provider-ledger.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-ledger.ts`
- `packages/dialer-server/src/coaching-replay/provider-metadata.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-metadata.ts`
- `packages/dialer-server/src/coaching-replay/provider-replay.test.ts`
- `packages/dialer-server/src/coaching-replay/quality.ts`
- `packages/dialer-server/src/coaching-replay/rejected-phrase-baseline.json`
- `packages/dialer-server/src/coaching-replay/reviewed.test.ts`
- `packages/dialer-server/src/coaching/context-scheduler.ts`
- `packages/dialer-server/src/coaching/context-selector.ts`
- `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- `packages/dialer-server/src/coaching/openrouter-selector.ts`
- `packages/dialer-server/src/coaching/playbook-authoring.test.ts`
- `packages/dialer-server/src/coaching/script-context.test.ts`
- `packages/dialer-server/src/coaching/script-matching.test.ts`
- `packages/dialer-server/src/coaching/script-matching.ts`
- `packages/lead-connector/src/embed/mercury-authoring-controller.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring-controller.ts`


## workspace-owned: files changed

- `packages/dialer-server/src/coaching/playbook-authoring.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring-controller.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring-controller.ts`
- `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring.ts`

## workspace-owned: activity log

- 2026-11-14 04:05:51 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:10:05 fs.write: `packages/dialer-server/src/coaching/playbook-authoring.test.ts`
- 2026-11-14 04:11:00 fs.write: `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- 2026-11-14 04:11:18 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:17:39 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:18:40 fs.write: `packages/lead-connector/src/embed/mercury-authoring.ts`
- 2026-11-14 04:19:22 fs.write: `packages/lead-connector/src/embed/mercury-authoring-controller.ts`
- 2026-11-14 04:22:07 fs.write: `packages/lead-connector/src/embed/mercury-authoring-controller.test.ts`
- 2026-11-14 04:25:28 fs.write: `packages/dialer-server/src/coaching/playbook-authoring.test.ts`
- 2026-11-14 04:27:32 fs.write: `packages/dialer-server/src/coaching/playbook-authoring.test.ts`
- 2026-11-14 04:27:32 fs.write: `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- 2026-11-14 04:29:13 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:36:59 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:46:30 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 05:04:59 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 05:31:48 fs.write: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

## workspace-owned: validation evidence

- 2026-11-14 05:24:09 `review.run`: passed — OK
- 2026-11-14 05:30:28 `verify`: passed — OK

## key decisions

Keep approved wording closed-set; preserve strict generic reducer and truthful captured/commit checkpoints. Literal-recall thresholds and fixture labels remain unchanged. No automatic production provider activation. Preserve existing candidate and unrelated OS/main changes.

## notes for ko

Existing local consuelo_web credential authenticates, but its OpenRouter account has no usable credits. Old coaching/local OpenCode and Railway coaching credentials are invalid; other relevant Railway services have no OpenRouter key. Values were never displayed or committed. Provider evaluation needs funding and separate approval, proposed max108synthetic requests/$2 cap. Broader live permissions and QA remain queued.

## improvements noticed

Nx Cloud is not configured; use exact-head GitHub CI through OS. Managed task source publication must preserve local dependency-merge ancestry (existing DEV1668 workflow gap).

## issues and recovery

Reviewer-confirmed source/publication race, cursor/unknown/interim/freshness, manual-only, cancellation/resource accounting and budget defects were repaired test-first. OS browser pointer helper required native DOM-click fallback inside isolated fixture. Source and runtime proof levels remain explicit; no false model-quality or live-call claim.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Matching wave — DEV-1701 / DEV-1702

Scope: approved Script matching and reviewed trigger authoring before live permission/QA. User authorized 2–3 workers, Sol 6.1 xhigh design/implementation and Terra 6.1 xhigh mechanical validation. Root owns integration/publication; shared managed task with disjoint file ownership avoids redundant installs/PR proliferation. Preserve others. No main merge, deployment, calls, paid inference or live grants.

Remote baseline: main 85cb752131b18d90aab16f9d2cf8f94dc71163b8 adds OS shortcuts/search. PR2798 candidate 291df61d5a6656a638cbb4213698234b6dd318d7 has 18 successful checks. Integrate immutable dependency into owned task, retain ancestries, no divergent stream backlog. Consolidate into existing candidate.

## Test-first contract

Behavior: tenant-approved aliases/context saved through reviewed publication drive correct closed-set cues; abstain on negated/historical/quoted/foreign-speaker contexts; preserve manual/urgent/stale evidence fences and immutable call version.
Local patterns: playbooks-engine.test.ts, review-regressions.test.ts, production replay, client-roundtrip.postgres.integration.test.ts, Mercury authoring DOM/controller tests.
New tests: focused adversarial matcher red; trigger review save/preview/publish/reload/CAS; unchanged 72-case corpus plus separate held-out adversarial cases fixed before implementation.
Red commands to freeze with workers before production edits. Existing baseline: 1/60 positive detections, 12/12 negative abstentions.
Expected red: missed paraphrases and no ordinary reviewed-trigger authoring. No waiver.
Acceptance: meaningful fixed-corpus recall gain without false negative-case interruptions; approved source fidelity/scope/cursor fences; client → Hono → isolated PG → ScriptSession; authoring browser proof; focused/package tests, strict review, verify, exact-head CI.
Plan: Sol matcher and Sol authoring disjoint, Terra independent validation once contract frozen; max three workers. Review/fix/consolidate/update Linear honestly.

- 2026-11-14 04:05:51 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

## workspace-owned: files read

- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-improve-approved-script-matching-and-authoring/packages/dialer-server/src/coaching/playbooks.ts`
- `packages/dialer-server/package.json`
- `packages/dialer-server/src/coaching/playbook-store.ts`
- `packages/dialer-server/src/coaching/playbooks-engine.test.ts`
- `packages/dialer-server/src/coaching/playbooks.postgres.integration.test.ts`
- `packages/dialer-server/src/coaching/script-matching.ts`
- `packages/dialer-server/src/coaching/scripts.ts`
- `packages/dialer-server/src/routes/mercury.ts`
- `packages/lead-connector/package.json`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring.ts`
- `packages/lead-connector/src/embed/mercury-feed-api.ts`

## Matcher worker — test-first contract

Owns script-engine.ts and new script-matching.ts/test only. Behavior: approved authored phrases match whole tokens after grammatical contraction and conservative plural normalization; negative wording inside an authored alias is affirmative evidence for that alias, external clause negation/history/quotes abstain. Same-role recent context is final, same scope/epoch, at or before current cursor and within30s, last6 turns, without joining phrases across turns. Unknown roles abstain. Ranking: priority first; explicit nextCardIds only prefers equal-priority eligible matches; deterministic cardId fallback. Repeat same-card evidence must not restart dwell. Preserve source/cursor/policy/manual/urgent/Off/terminal fences.

Pattern: playbooks-engine.test.ts and review-regressions.test.ts, Bun table-driven domain tests and ScriptSession regressions. New test file script-matching.test.ts freezes adversarial examples independently of replay fixtures; no gold corpus read. Focused red command: bun test packages/dialer-server/src/coaching/script-matching.test.ts. Expected red: contraction/plural misses, cross-clause false suppression, stale/foreign/joined context admitted, transition tie preference ignored. No waiver.

- 2026-11-14 04:10:05 write: `packages/dialer-server/src/coaching/playbook-authoring.test.ts`

### Replay owner — frozen initial red

Frozen independent synthetic 36-case file SHA-256 `f9636b98b4512d102bb46013d8e4f7567f32b6090c0fb5d798184614cf58fde6`. Original 72-scenario fixture was not changed. On seed 17, replay test trace `trc_a730db4d8f95` failed target at all 1/5/20 isolated scopes with 10/60 fixed hits; injected wrong and false-interrupt observer tests passed. Detailed pre-change run `trc_926a95defa27` at 1 scope: heading rules fixed 1 hit, 59 misses, 12 correct abstentions, independent 0 hits, 24 misses, 12 correct abstentions. Reviewed rules fixed 10 hits, 50 misses, 2 false interruptions, 10 correct abstentions; independent 5 hits, 19 misses, 3 false interruptions, 9 correct abstentions. No positive wrong-card verdicts. Virtual timestamps are separate from measured wall latency. Provisional synthetic cases are not population accuracy, multi-user, service, or live proof. Mock selector is unevaluated as a model.

- 2026-11-14 04:11:00 append: `packages/lead-connector/src/embed/mercury-authoring.test.ts`

- 2026-11-14 04:11:11 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
## Trigger authoring worker — initial contract and red proof (2026-11-14)
Owned compiler/store/routes and embed authoring/hooks/tests; root owns publication/integration; matcher and replay/evaluator owned independently. No hidden domain dictionary or gold-fixture reads.
Contract agreed with root: preview receives optional complete CardRule[]; returns compiled preview + SHA256 reviewToken + current publication ordinal. Publish requires complete reviewed rules + token + explicit approval and source/ordinal CAS. Canonical candidate token binds source text/revision, normalized rules and next publication ordinal. Reload recovers rules from last publication only for unchanged saved source; explicit [] stays manual-only. Unpublished edits are temporary in-memory preview state and must be re-reviewed after any form edit; source edits invalidate approval. No migration or industry/company precedence added.
Test-first evidence before implementation: code.call trc_afc13fe9bef9 ran bun test packages/dialer-server/src/coaching/playbook-authoring.test.ts: 0 pass/4 fail (missing token, absent binding/reload contract, missing validation and sparse synthetic alias vocabulary). One fake-database query matcher was too broad and will be corrected before green. code.call trc_9c9fe15a095a ran bun test packages/lead-connector/src/embed/mercury-authoring.test.ts: existing6 pass/new2 fail (no editable form/full rule projection or approval invalidation).

- 2026-11-14 04:11:18 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

- 2026-11-14 04:11:27 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
### Matcher red evidence

Before production edits: bun test packages/dialer-server/src/coaching/script-matching.test.ts →15pass/25fail (40tests), trc_9f431a563af7. Added3 general concern-resolution abstention regressions after root reported category-level issue only (no held-out text read), reran same command →15pass/28fail (43tests), trc_fbbd75d97589. Failures include contractions/plurals, cross-clause negation, quote/history, unresolved-context boundaries and transition tie preference. Tool recovery: fs.apply_patch rejected absolute patch path; retried same scoped patch with relative path successfully.

- 2026-11-14 04:12:38 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`
- 2026-11-14 04:14:14 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
- 2026-11-14 04:14:23 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`

- 2026-11-14 04:15:04 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`
### Replay owner — first blind pack comparison

With expanded pack and matcher, `trc_8de78d25d33c` produced the same outcomes at 1/5/20 isolated scopes: fixed 23/60 hits, 37 misses, 12/12 negative abstentions; independent 7/24 hits, 17 misses, 10/12 abstentions, 2 false interruptions; wrongVisible 2, lateVisible 0. Fixed family misses: affordability 7, existing 9, employer 9, family 4, beneficiary 4, application 4. Independent family misses: 4, 4, 3, 1, 2, 3 respectively; false interruptions were affordability and family. Heading baseline `trc_9612ce4aeca0`: fixed 4/60 and independent 1/24, 24/24 abstentions. Wall settle p95 in one reviewed run ranged 0.21–0.29 ms at one scope, 1.43–1.94 ms at five, 5.86–6.05 ms at twenty, local in-process measurements only; fixture cue offsets are virtual. Gate `trc_79c92d286d32` red at 23 fixed hits; planted observer checks passed. One newly authored alias per family confirmed production lane integration in `trc_431dc2bdd69c`. Mock selector remains explicitly unevaluated. No real multi-user, service or carrier acceptance implied.

- 2026-11-14 04:17:25 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
## Coordinator review and fixed evaluator contract

Original baseline trc_90880ac35a15: unchanged72 scenarios, heading-only1/60positive,12/12negative abstentions at1/5/20. Independent36cases frozen before new pack/engine inspection: SHA256 f9636b98b4512d102bb46013d8e4f7567f32b6090c0fb5d798184614cf58fde6. Reviewed-lane gates: ≥45/60 fixedpositive, ≥18/24 independentpositive; zero wrongVisible/lateVisible and12/12abstentions per cohort. Direct-scope concurrency is not multi-user/server/carrier proof. Labels synthetic hypotheses, not human-adjudicated insurance truth.

Root review findings sent for test-first repairs: post-alias denial and temporal present-holding with dated acquisition; preserve spouse's current negative decision as relevant. Evaluator detects wrong-then-correct contamination even with final hit. Heading lane retained to distinguish configured authoring from unconfigured semantics. Firstblind newpack remained red:23/60fixed,7/24independent,2independentfalseinterruptions; category-only feedback, no goldphrases supplied, expectedoutputs unchanged.

Authoring contract: preview optional complete rules; canonical compiledcandidate+source revision+publication ordinal bound by64hexreviewToken; publish complete reviewedrules/token/approval; CAS/per-callV1pins preserved. Savedsource vs unsavedtriggeredits distinguished; editsinvalidateapproval. Same savedrevision inherits latestpublishedrules, explicit[] manual-only retained. Bound-candidate design needs no migration. Explicit lifeinsurance example action required so benchmark rules are productreachable.

- 2026-11-14 04:17:39 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

- 2026-11-14 04:18:40 write: `packages/lead-connector/src/embed/mercury-authoring.ts`

- 2026-11-14 04:19:00 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
- 2026-11-14 04:19:13 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`
- 2026-11-14 04:19:22 write: `packages/lead-connector/src/embed/mercury-authoring-controller.ts`

### Matcher implementation and handoff

### Independent review repair — latest explicit phrase state

### OpenRouter transport review repair — physical settlement and provider identity

Omitted-latest-input follow-up contract: before a queued/admitted selector captures timeline, its latest included trusted final must exactly equal current epoch/sequence; unknown latest finals and interim speech cannot advance a proposal cursor while only older trusted text is sent. Valid unknown final speech is a same-scope/epoch context boundary: later trusted finals cannot borrow earlier pre-unknown requirements or transcript context. Root approved minimal shared-helper +engine repairs, no fixture-label changes. Frozen red trc_49ae401e2af7=3expectedfailures (old required context admitted, unknown final replayed old text, queued interim launched on old input). Tests also require trusted-final recovery and fresh post-boundary context.

Final runtime review repair evidence: hard20cap red1pass/5fail trc_487721135bcb ->green6/0 trc_0cc2567f1fcc. Freshness-preservation red3pass/8fail trc_7da50f0236e2 ->green combined163tests450assertions trc_fcf6531f60fb, keeping explicit plain/terminal-period acknowledgements and rejecting quoted/signed/question/exclamation variants. Omitted-latest-input red3/0 ->green3tests15assertions trc_0c40d18a5c29. After final formatting, runtime+matcher+existing engine/review suites trc_0ea4c913818b=150pass/370assertions; full dialer-server tsc trc_37d4f5b5ef07 clean commandExitCode0. Previous tsc-only failure was Bun test.each including an optional done callback in rest-argument inference; two explicit string parameters preserve fixtures/assertions and compile cleanly. Adapter16tests remained green before these independent runtime changes; root reruns combined whole stack.

All reviewer-owned production frozen05:15:42. Read-only review covered context scheduler/catalog/benign-delta admission, captured/current evidence and source/policy/base/worker fences, unknown/interim omission, queue/physical promise lifecycle, manual-only authority and configured request caps. No further confirmed findings after approved repairs. Scheduler implementation unchanged. Continuous novel speech remains conservatively discarded; deterministic guards and mocked outputs do not establish semantic quality, actual provider behavior, service/multi-user acceptance or live permission. No actual provider/network/key access, calls, deployment or publication from this reviewer. Root retains independent repair review, exact frozen-head gates and paid-run approval.

Freshness follow-up contract: repeatedFinal and benign rep acknowledgements must preserve quote structure, currency/signs and meaningful punctuation; only NFC/case/whitespace equivalence is mechanically repeatable. Root confirmed selector could commit a captured paraphrase after the same words became quoted (trc_6c745725f9ac). Targeted new tests red trc_7da50f0236e2=3pass/8expectedfailures across quotes, amount signs/currency and punctuated/quoted rep yes; existing exact-repeat/case/whitespace/NFC and question safety cases retained. Keep authored phrase normalization unchanged. Explicit plain/terminal-period acknowledgement spellings retain frozen Understood. behavior without globally deleting punctuation.

Runtime follow-up contract: hard per-call inference ceiling is20 independently of global120starts/min. Root assigned minimal script-engine.ts +script-context.test.ts repair after reviewer found Math.min(120,configured) admitted21calls with configured100. Invalid NaN/Infinity/negative/noninteger limits must reject before any jobs; explicit0 disables context. Focused red command bun test packages/dialer-server/src/coaching/script-context.test.ts -t 'request limit' ->1pass/5expectedfailures trc_487721135bcb (21actualrequests, invalid values not rejected). Global scheduler and all other frozen runtime behavior untouched by this cap repair.

Repair evidence: distinct provider request-tag/response-name test red trc_635a6a61fd41 ->green trc_a5fddee621d6; final-read cancellation observer cases red trc_108321999290 ->green trc_bb746977fe2b. Physical promise tests red trc_99111b54fb89 ->green trc_db942ada2664; test observation uses an event-loop turn after abort so nested rejection/finally propagation has completed, and controlled fetch/body cancellation is explicitly released in finally. select now represents actual fetch/body work plus underlying cancel settlement, while engine owns bounded logical deadlines and held-slot quarantine. Caller's AbortSignal identity is snapshotted and every awaited body read / ordinary observer / output is fenced; native cancellation failures map to typed ABORTED without raw error text.

Root additionally authorized optional immutable maxPriceUsdPerMillionTokens{prompt,completion}, explicitly passed by benchmark as{1,5}USD/M; copied finite nonnegative values bind sourceVersion and provider.max_price. Price test red trc_f847ac970f8d ->green trc_9a0379abc28b. There are no hardcoded model/provider/price defaults. Fixed string messages and request-key assertions prohibit remote cache_control/prompt_cache_breakpoint options; broader cache-write worst-reservation remains evaluator policy, not transport. No ordinary usage observer fires after abort, so unknown cost retains reservation.

Production frozen04:59:57; test-only formatting/final stalled-body deadline coverage frozen05:00:57. Combined adapter16 +matcher77 tests trc_acf3021126a2=93pass/234assertions, but facade reported concurrent provider-budget.ts owner write as verify mutation; root reruns frozen-tree gates. Earlier complete adapter15tests92asserts clean trc_3ce382cb9a89. Adapter test fixtures now explicitly typed without any; script-matching.test.ts changes limited to root-authorized rest-argument type annotations/formatting. Constructor/metadata signature sent to evaluator for exact dry preflight with fixture synthetic key/local injected fetch, no actual provider or credentials. Root retains final review/gates, paid approval and all publication.

Root assigned reviewer ownership of openrouter-selector.ts/test after transport owner completion. Confirmed contracts before production edits: request provider tags and response provider names are distinct immutable allowlists (verified anthropic / Anthropic); cancellation after any awaited body read cannot emit an ordinary metadata callback or selection; select() represents actual fetch/body settlement, so a local signal deadline cannot hide physically unsettled work from the engine global-four budget. Engine alone supplies the bounded logical outcome and preserves unknown-cost worst-case reservation. Red/green command: bun test packages/dialer-server/src/coaching/openrouter-selector.test.ts. Tests use controlled synthetic fetch/streams only, no provider/network/keys. Update ignored-abort test to verify signal aborted while physical promise remains pending until explicit test release; preserve prompt cooperative ABORTED. Root owns combined integration review/gates and paid-run approval.

Final cross-alias contract from coordinator review: aliases on one card share a reviewed meaning, so newest explicit current alias occurrence must determine the card state; alias-array order cannot permit an older positive after a newer denial. At the same clause/token end, prefer the longest approved phrase so a specific authored negative-intent alias (does not fit my budget) is not suppressed by its shorter overlapping generic alias. Tests added/frozen before production edit, trc_69354fb5a975=73pass/4expected failures. No dictionary, semantic inference, evaluation fixtures, or threshold changes.

Final reviewer repair handoff: cross-alias focused green trc_fb8f62bbaaa2=77pass/139assertions. Manual-only follow-up plus prior suites trc_9d748127465b=101pass/230assertions. Capacity falsification uncovered repeated identical aliases across512cards: valid365407Brules,16Ktext, p95~77ms even mostly unrelated and15repeated-matching iterations timed out at30s (trc_d804ba748424). Added exact phrase-evidence memo scoped to each analyzed turn, caching misses as well and keyed by normalized token sequence; no global retention. Same bounded diagnostic green trc_efe8e8503f9e: warm p95 2.71ms mostly unrelated,9.59ms repeatedly matching aliases. After final formatting, matcher+existing engine+review regressions trc_e29ec476633d=106pass/260assertions. Matcher production frozen04:35:57, only script-matching.ts/test changed under this review repair ownership; root owns independent review/full gates/publication.

Read-only authoring review covered compiler, publication store/source-CAS, Hono parser/body limit, client bounded parser/form/renderer, controller, and embed wiring. Confirmed materialized eligible_source FOR UPDATE rechecks revision/archive/author access with publication CAS. Found misleading nextCardIds restriction copy; authoring owner corrected it to equal-rank tie preference with renderer regression. Found blank-alias selector mismatch; engine guard above repaired it while retaining manual-card context/routing rows. Literal empty-list serialization can differ after unchanged Review, but automatic semantics now remain manual-only. No further source/token/version finding from inspected frozen code. Did not independently rerun PG/browser/broad package gates or read independent gold corpus. Generic recall advice sent to root only: bounded optional article/copula/auxiliary variants with ordered approved content tokens may help; no bag matching, hidden domain terms, or threshold weakening. No recall changes implemented here.

Manual-only follow-up contract: blank approved aliases must prevent both deterministic and optional selector automatic prompts; omitted rules still get heading defaults, explicit rules=[] remains manual-only. Actual mocked ScriptSession red repro trc_9c5b1e6cc180 produced selector-approved Beta from empty aliases on unrelated wording. Added focused selector-session regression and default-heading preservation test before production change. Initial red trc_2fcaaa804453=70pass/2fail included an unrelated constructed empty rule in the empty-list case; corrected test premise to inspect only compiled rules, frozen red trc_93030e892955=71pass/1fail. Authoring owner notified to check unchanged-Review [] preservation without dropping meaningful manual-card context/routing. No threshold/oracle/corpus edits.

Reviewer ownership reassigned by coordinator: script-matching.ts and script-matching.test.ts only; no overlapping authoring/evaluation changes. Confirmed repro trc_95ac087d693a: an earlier positive required phrase survives its later explicit denial; the same utterance also matches a positive phrase followed by its negation. Test-first contract: latest explicit, unquoted, current assertion of each approved phrase wins within the current turn and bounded same-speaker context. Historical/reported/quoted mentions do not create affirmative requirements; revised segments replace stale revisions. Preserve negative-to-positive corrections, manual/priority/selector/policy fences and frozen-rule cache. Focused red/green command: bun test packages/dialer-server/src/coaching/script-matching.test.ts. Expected red is an automatic card or eligible selector despite a current explicit retraction. No waiver.

Repair evidence: focused contract trc_e002e1633a11 =61pass/8expected failures before production edits; trc_800f2b16946a =69pass/98assertions after. Phrase state searches newest clauses/occurrences first; latest explicit current retraction suppresses the phrase and newest explicit required-context state wins. A repeated phrase with a new conjunction/subject starts a new assertion, preserving negative-to-positive correction without dropping global reporting guards. Historical/reported/quoted mentions are neutral. Existing scope/epoch/revision/role/window/cache and engine reducer fences untouched. Formatted both owned files; focused matcher+prior engine+review suites trc_0620f3ab527c =98pass/219assertions. Post-repair local boundary timing trc_d207ffc188a8:512cardsx32aliases,460191rulebytes,20distinctscopes,16000charturns, warm p95=1.96ms/max2.29ms; cold17.64ms. No broad package checks, live calls, APIs, publication or deployments from this reviewer. Root owns combined frozen-tree gates and independent review of this repair.

Changed only owned script-engine.ts, new script-matching.ts and script-matching.test.ts (plus this append-only workpad). Engine reexports existing matcher entrypoints; selection accepts optional currentCardId for approved nextCardIds preference only after priority ties. Core card/policy/source/evidence/captured-cursor reducer fences unchanged. Generic English contraction/plural normalization is symmetric; no inferred industry vocabulary or replay fixtures used. Required phrases need affirmative same-role context; forbidden phrases remain conservative raw occurrence guards. Explicit current holding survives a dated relative clause. Quotes (including unclosed quotes and contraction apostrophes), historical/reporting, external prefix or post-alias auxiliary negation, and explicit resolved/satisfied predicates abstain.

Validation sequence: original red15pass/28fail →43green trc_5edfd3aa1931. Review examples added7red (trc_db9d3c8fc2c8) →50matcher plus prior suites79green (trc_21e139ab8806). Generic satisfied-context additions50pass/3fail trc_f57e94758e02 →53green trc_a110544ffc4d. Self-review caught prototype-key contraction lookup: new constructor regression54pass/1fail TypeError trc_5a032059d532 →final55green/73assertions trc_a00846287673, including mutable shallow-frozen rule cache safety. All owned files formatted with repository Prettier.

Boundary measurement used valid512cards×32aliases, canonical rules484755bytes, source39312bytes,20distinct scopes, repeated selectScriptRule on56char and16000char turns. Before optimization p95=20.10ms/284.63ms (trc_7cfe9d6e0aab). Added WeakMap pretokenization only for deeply frozen published rules and per-clause word-set absence checks. Same benchmark afterward p95=1.49ms/2.63ms; long-turn max2.81ms, cold first short select21.08ms (trc_9f9a278d5da9). Facade reported concurrent compare.test.ts write as verify mutation; benchmark itself did not mutate files. Root handles frozen-tree final gates.

Package tsc trc_bdeb2650e908 reported only concurrent authoring API/fixture contract mismatches; no matcher diagnostics. Final combined prior+matcher84tests:82pass/2fail (trc_463133f0873d), only review-regressions preview wire fixtures after concurrent authoring parser changes; root and authoring owner notified. Earlier same prior suites passed79tests before those parser edits.

Limitations: deterministic reviewed-alias matcher, not semantic inference. English grammar scope heuristics conservatively abstain on ambiguous denials/reported/historical wording, and dated holdings without an explicit current assertion may abstain. Benchmark is local synthetic timing, not service/provider latency. No live calls, paid APIs, grants, deployment or publication performed by this worker. Root retains independent corpus evaluation, full static/review/verify and publication ownership.

- 2026-11-14 04:22:07 write: `packages/lead-connector/src/embed/mercury-authoring-controller.test.ts`

### Replay owner — authoring PostgreSQL proof and race

Actual client → Hono → isolated PostgreSQL result `trc_cd8b488e4860` passed 37 assertions. It covers arbitrary authored trigger persistence/reload and cue, rule/token tampering, source edits invalidating old review (including command updated to new revision), active V1 pin after V2 and projection restart, manual-only authority, cross-user/stale token controls, and durable outbox. A deterministic second connection held an uncommitted edit while the publication compiled old source; the INSERT rendezvous observed PostgreSQL lock waiting, then after editor commit publication rejected and no row was inserted. Before fix, same test `trc_ccc14765fb3e` failed: expected rejected, received published. This is a local fixture proof, no provider or actual call. Dialer-server TypeScript check passed `trc_e1125803ebf7`. The fixture browser server uses production renderer/controller/API and isolated local PostgreSQL; browser run and process cleanup are tracked separately.

- 2026-11-14 04:23:58 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:24:25 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
- 2026-11-14 04:25:17 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`
- 2026-11-14 04:25:28 append: `packages/dialer-server/src/coaching/playbook-authoring.test.ts`

- 2026-11-14 04:25:46 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`

- 2026-11-14 04:27:14 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:27:32 append: `packages/dialer-server/src/coaching/playbook-authoring.test.ts`

- 2026-11-14 04:27:32 append: `packages/lead-connector/src/embed/mercury-authoring.test.ts`

### Replay owner — second blind comparison

Frozen 32-phrase/topic pack plus retraction matcher `trc_582333659b99`: identical across 1/5/20 scopes. Fixed 28/60 positive hits, 32 misses; independent 12/24 hits, 12 misses; both cohorts 12/12 negative abstentions. Wrong cards, wrong visible, late visible and false interruptions all zero. Fixed misses by family affordability/existing/employer/family/beneficiary/application: 7/7/7/4/4/3; independent 4/3/2/1/1/1. Settle wall p95 in this local run: about 0.23ms at one, 1.75–2.07ms at five, 7.17–7.18ms at twenty; virtual cue offsets and real-world latency are separate. Gate `trc_9f3b4c5fbbbb` remains red: 28 < 45 fixed, while the second cohort is 12 < 18. Independent labels unchanged, mock selector explicitly unevaluated.

## Trigger authoring worker — implementation and final focused evidence
Final production refreeze 2026-11-14 04:28:21 UTC (last production edit 04:28:04). Root/Terra/reviewer notified before final isolated-browser bundle. No commits/publication/task creation by worker.
Implemented complete reviewed CardRule authoring in the ordinary saved-script preview: aliases, required/forbidden recent-context phrases, speaker, priority and next-heading references are progressively disclosed; next cards correctly described as equal-rank preferences. Input/change clears approval synchronously; publish also checks form values to catch programmatic/autofill edits without events. A new preview key prevents stale checkbox/form reuse. Unpublished trigger edits are explicitly temporary; reload restores the last publication only for unchanged source. The actual embed delegates to reusable mercury-authoring-controller handlers; DOM tests exercise those handlers and readScriptFile, renderer, API and redraw preservation.
Explicit opt-in life-insurance example triggers use the existing example endpoint. The synthetic/review-required label is shown; only matching visible card IDs are replaced and other authored triggers survive. Six independently authored topic vocabularies are frozen at 32 explicit aliases each. No replay/gold scenario text was read and no implicit synonym/industry registry was added. Arbitrary uploaded cards still need tenant-authored triggers. RULES_VERSION is script-rules-v2; CardRule shape unchanged.
Server preview returns {preview, reviewToken, expectedPublishedVersion}; publish requires complete rules, matching SHA256 canonical candidate, current source/ordinal fences and explicit approval. Token is an equality fence, not authentication. Source edits/new publication ordinals/changed normalized rules invalidate review. Publication retains complete source-linked compiled rules and active-call pins are untouched. Publication now locks its eligible saved-source row in the single INSERT statement with a materialized SELECT FOR UPDATE CTE, serializing source edits/archive against the CAS. This followed Terra real-Postgres deterministic stale-source race RED trc_ccc14765fb3e; fix trace trc_35598976cf2e, Terra owns the same race GREEN and full actual Hono/Postgres roundtrip evidence.
Bounds: existing 100KB source, 512-card projection, 3–4 points and 4MiB authoring response transport retained. Rules enforce 32 phrases per field, raw AND canonical NFKC length <=80, unique phrases, no required/forbidden contradiction, known unique next cards <=16, priority0–100, known speaker and rule fields, aggregate512KiB; routes reject unknown command fields and body>1MiB. New Unicode expansion regressions first failed (2fail trc_e6ead2ff2b72) then passed.
Final focused command: bun test packages/lead-connector/src/embed/mercury-authoring-controller.test.ts packages/lead-connector/src/embed/mercury-authoring.test.ts packages/dialer-server/src/coaching/playbook-authoring.test.ts =>20pass/0fail/115assertions, trc_f5191a8844e2. Covers exact preview/publish binding, canonical equivalent rules, stale tokens/config/source/ordinal, explicit manual-only rules/reload, malformed/unknown/oversized config, source upload and actual UI handlers, opt-in example mapping, approval invalidation, stale selection/forms, canonical Unicode bounds, and routing copy. Existing review-regressions11tests also green trc_743640e8987e (combined19pass with initial8UItests). Package typechecks passed for lead-connector trc_1b6220fe3411 and dialer-server trc_5825ec0c54d9. Prettier ran only owned changed files (trc_e5a3f431b150, final touched files trc_0106ec695645).
Owned changes: packages/dialer-server/src/coaching/playbooks.ts; playbook-store.ts; playbook-authoring.test.ts (new); playbooks.postgres.integration.test.ts (contract fixtures); review-regressions.test.ts (review-envelope fixtures); packages/dialer-server/src/routes/mercury.ts; packages/lead-connector/src/embed/mercury-authoring.ts; mercury-authoring.test.ts; mercury-authoring-controller.ts (new); mercury-authoring-controller.test.ts (new); internal-main.ts. No script-engine/matcher/replay files edited.
Remaining acceptance limits: root owns final integrated browser/real-Postgres/regression/review/verify/publication evidence. DEV-1701 remains open for broader industry/company/tenant override registry/glossary and extraction work, and any unmet blind matching/holdout thresholds. No claim of live carrier or arbitrary-script semantic inference.

- 2026-11-14 04:29:13 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

- 2026-11-14 04:30:32 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
- 2026-11-14 04:30:48 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`

- 2026-11-14 04:31:05 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:31:05 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`

- 2026-11-14 04:32:34 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`

- 2026-11-14 04:33:03 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 04:33:03 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`
- 2026-11-14 04:35:20 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`
- 2026-11-14 04:35:48 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`

- 2026-11-14 04:36:29 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
## Trigger authoring worker — final authorized domain vocabulary pass
Root reopened ONLY the product-visible synthetic example aliases in playbooks.ts after blinded matching quality remained below its frozen gates (root-reported prior28/60fixed and12/24independent, no false prompts). No API/UI/controller/source-point/priority/engine/replay edits in this pass; no corpus/gold texts read. Alias principles were sent before editing: use distinct intent-bearing possession/source/strain/decision/recipient/qualification constructions, not bare generic insurance nouns; prune contractions/plurals and simple substring redundancy; retain explicit negative cost predicates because canonical polarity distinguishes them from unqualified budget phrases. The revised pack broadens have/carry/got personal/term/whole-life possession and in-place coverage; employer/company/group sources; financial-strain/price/cadence questions; joint decisions; payout recipients; application/medical concerns. Still a synthetic example requiring tenant review, never an implicit industry/company inference registry.
Final pack frozen2026-11-14 04:36:09UTC,32aliases per each6topics. SHA256(JSON.stringify(SYNTHETIC_LIFE_INSURANCE))=d0766935d31365972b78d6a0bf508576316851500915641e3d3736a9963357ed (hash trace trc_4523e78fc2a6). Focused authoring+existing engine suites25pass/0fail/111assertions (test portion trc_bfcd29e7a66c); the following hash diagnostic initially used a relative import from code.call's temporary program and failed, then succeeded with cwd-qualified module import in trc_4523e78fc2a6. Root/Terra notified for one final blind evaluation with labels/gates unchanged. No additional alias tuning planned.
If that gate remains red, preserve measured limits and manual fallback, keep DEV-1701 open, and scope the next independently evaluated semantic candidate-selection/authoring-registry work instead of growing a hidden or benchmark-specific synonym list. No assertion of arbitrary uploaded-script semantic understanding.

- 2026-11-14 04:36:59 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

### Replay owner — final frozen reproducibility

Trace `trc_2d9452341098`; Bun 1.3.14, seed 17; canonical SHA-256 of JSON.stringify(SYNTHETIC_LIFE_INSURANCE) `d0766935d31365972b78d6a0bf508576316851500915641e3d3736a9963357ed`; script-engine.ts SHA-256 `5d999d8b8cc355660d40005be52121306c24e7e01af571a2a875ea3922f59b70`; script-matching.ts SHA-256 `3eca1b18aea99c72c78eb1ac6f53a664f28f18806effe9edea64d47b01ca5890`; original fixtures.ts Git blob `1804de6079e69cb8f9894cfc6ccd8da856f06015`; independent JSON SHA-256 `f9636b98b4512d102bb46013d8e4f7567f32b6090c0fb5d798184614cf58fde6`. All reports private owner-only and contain controlled IDs/counters only.

Reviewed rules at each 1/5/20: fixed 31 hits/29 misses/12 abstentions; independent 10 hits/14 misses/12 abstentions; zero wrongVisible, lateVisible, false interruptions. Fixed family misses affordability/existing/employer/family/beneficiary/application 6/7/5/3/4/4; independent 4/3/2/1/1/3. Heading lane fixed 4/60 and independent 1/24 with 24/24 negative abstentions. Reviewed settle p95 wall values fixed/independent 0.194/0.189 ms (1), 2.144/1.709 ms (5), 7.951/8.062 ms (20). In-process timings, not user/network/audio latency; mock selector unevaluated. Final goal gate `trc_c42252c21dad` RED at 31 < 45 fixed; independent 10 < 18 separately observed; standalone planted observer checks passed. No claim of population, provider, multi-user, or live quality.

- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/rules-1/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/rules-5/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/rules-20/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/mock-selector-1/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/mock-selector-5/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/mock-selector-20/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/reviewed-rules-1/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/reviewed-rules-5/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/reviewed-rules-20/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/heading-independent-1/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/heading-independent-5/replay-v1.json`
- `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/coaching-final-replay-FA1dAF/heading-independent-20/replay-v1.json`


### OpenRouter selector transport — test-first contract

The selector sends only a scoped approved catalog and bounded final transcript evidence through a strictly configured, tool-free OpenRouter structured-output request. It accepts only locally validated existing card, associated slot, and exact evidence IDs/revisions, with explicit null abstention; rejects malformed provider responses and bounded-resource violations. No provider calls in tests. Follow Bun test and existing ClosedSetSelector patterns. Focused test: `bun test packages/dialer-server/src/coaching/openrouter-selector.test.ts`; expected red is missing transport module before implementation. Mock fetch covers request schema/routing, valid and adversarial output, configuration isolation, deadlines, cancellation, size limits, and secret redaction.

- 2026-11-14 04:41:25 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
### Context runtime owner — test-first contract

Closed-set semantic input receives only bounded trusted titles, approved point text and source revisions plus authored matching constraints. Pure mock tests establish mechanical safety, never semantic recall. New script-context.test.ts will first fail catalog/freshness/fair-admission assertions under the existing engine. Cover 20-call FIFO drain at four concurrent requests without requiring new text, one in-flight per call, interval-delayed meaningful deltas, silence/repeat skips, deadline/budgets, unchanged captured evidence and explicit captured/commit cursor records, priority/manual/off/revocation/terminal cancellation. Novel customer deltas conservatively require a new checkpoint rather than pretending an old inference observed them. Keep generic conversation reducer strict, core capacity limits and frozen rules/authoring unchanged. Focused red command: bun test packages/dialer-server/src/coaching/script-context.test.ts.

- 2026-11-14 04:42:50 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:43:18 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:43:43 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:44:39 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:44:56 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:45:16 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:45:32 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:45:48 apply-patch: `packages/dialer-server/README.md`
Context runtime red trace trc_b08846d2e751: 5 failures reproduced meaningful-catalog, harmless-final checkpoint, fair queue and interval starvation. One pretest incorrectly assumed final segments can be revised: core explicitly rejects that input; corrected to assert input rejection and reject forged evidence revision2 instead. Root authorized narrow existing regression text change to a novel second customer final, retaining its actual stale-meaning safety intent while identical consecutive finals are explicitly admissible. Physical scheduler slots remain occupied until provider promises settle even after logical deadline; noncooperative adapters fail closed rather than accumulating unknown work.

## Method decision — semantic context continuation

Final independently authored phrase pack remained below precommitted semantic-recall gates:31/60 fixed positives and10/24 independent positives, both12/12negativeabstentions, zero wrong/latevisible prompts, identical at1/5/20 isolated scopes (trc_2d9452341098; explicit redqualitygate trc_c42252c21dad). Literal-rule hypothesis rejected; do not tune labels/windows or call this matching-ready. Full reproducibility and private12reports are in evaluator appendix.

Continuing approved DEV1702 with a narrow closed-set contextual selector: Sol owns scheduler/catalog/captured-evidence checkpoint; Terra owns strict tool-less OpenRouter transport; Terra evaluator prepares opt-in synthetic-only quality runner. Max3workers. No actual provider requests/credentials/paidinference authorized by this continuation; root will request approval only after concrete reviewed code and bounded run plan. No production/livepermissions/mainmerge.

Generic card reducer stays strict. Guarded benign-delta selector commit is validated against its immutable captured timeline and exact current base/policy/source/worker/scope/evidence guards; patch cursor stays capturedtruthfully. Explicit private checkpoint pairs captured+commit cursors and admission reason, no silent rebase. Novel meaningful newer customer/rep speech still discards; continuous semantic freshness not claimed. Bound fair admission4active/64queued; noncooperative underlying tasks retain unsettled capacity until known settled. Manualonly aliases[] stays ineligible for automaticpaths.

Official technical docs checked November14 UTC: OpenRouter structured outputs (strict json_schema and endpoint-specific support; require_parameters true) and provider routing (explicit provider only, no fallbacks, denydata collection). Existing deprecated packages/coaching not reused; packages/agent generic Pi/CRM runtime is inappropriate dependency for this tool-less classifier. Pi integration/evaluatedproviderquality not claimed by mocktests.

Browser progress: real isolated fixture upload/save/preview succeeded in a separate QA profile. Shared profile failed SingletonLock; OS browser.raw with BOTH --session mercury-matching-qa and --profile /tmp/mercury-matching-qa-browser-20261114 avoids touching signed-in GHL. Native disclosure click helper did not open details in first stale bundle; final-source browser acceptance intentionally deferred while matchinggate red. Fixture Bun/PG cleanly stopped; no live calls.

- 2026-11-14 04:46:30 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

- 2026-11-14 04:46:31 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:46:46 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:47:03 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
### OpenRouter selector transport — results

Initial red: focused Bun test failed because the adapter module did not exist (trace trc_f389676e796e). Additional amount-preservation regression red showed numeric coverage values were masked (trc_6953a71a1088), then green (trc_970dade88660). Focused suite green: 10 tests, 74 assertions, including mock-only request/schema, validation, malicious payload, deadline, cancellation, bounded streaming, redacted errors, metadata, scope, and numeric amount checks (trc_ea467b329cce). No HTTP requests, credentials, provider-quality evaluation, or activation. Package typecheck during concurrent work surfaced local typing issues now fixed plus other agents' in-progress errors; final typecheck and review/verify belong to coordinator after freeze. Formatted-number masking is partial and cannot establish transcript privacy; provider use depends on the separate data-handling boundary.

Adversarial red trc_28fa596c08f1 caught queue-expiry automatic re-admission and led to explicit expired/cancelled/finished outcomes with no expiry retry. New rep tests initially supplied extra participant/leg keys in closed speaker-provenance envelope; corrected valid fixtures. Exact repeated normalized utterances preserve question polarity; any rep question is non-benign.

- 2026-11-14 04:51:50 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
Further adversarial red trc_03f48e6a7e11 caught a repeated currently visible priority rule failing to cancel older semantic work; urgent/ranked rule evidence now cancels even when its approved card layout is unchanged. Bounds fixture corrected to respect the existing256-character approved-slot limit and exceed static48KiB via legal reviewed rules rather than invalid point lengths.

- 2026-11-14 04:52:14 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:53:08 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
Off capability red trc_5cfc4f0007e1 exposed an inherited control ordering bug: absent manual-reference permission returned before setting mode off, allowing later inference. Off now unconditionally stops capture/coaching and then selects appropriate manual/unavailable display status; other manual actions still require manual-reference admission.

- 2026-11-14 04:53:32 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:54:11 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
Unchanged-layout checkpoint red trc_c7f14a65f82a: a validated selector result for already selected approved slots left manual/unavailable status stale. Accepting unchanged automatic evidence now restores live approved status, with no new changed-slot CardPatch or dwell reset. That verify envelope also detected a concurrent peer write to coaching-replay/provider-budget.ts; this worker did not touch replay files.

- 2026-11-14 04:55:22 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
### Context runtime owner — final implementation and proof limits

Owned implementation: script-engine.ts integrates new context-selector.ts (typed source-linked trusted catalog and conservative checkpoints) and context-scheduler.ts (physical request admission and bounded FIFO lifecycle). New script-context.test.ts has24 mock-only contracts. Narrow root-authorized review-regressions.test.ts change uses a novel second final for the stale-meaning test; frozen matching tests, corpus, authoring, compiler/store/UI and conversation core remain untouched.

ClosedSetSelector.select input now includes catalog metadata (workspaceId local only, playbookId, publishedVersion, sourceRevision, industryPackVersion, companyPolicyVersion), approved card title/slotIds/slots with exact point text/documentId/revision, reviewed matching aliases/required/forbidden/speaker/priority, and six trusted final turns {id,revision,role,text}, signal. Output remains existing cardId|null, associated slotIds, exact captured evidence IDs/revisions. Static catalog is bounded32cards/48KiB and cached only by deeply immutable compiled object identity; transcript bound8000characters. Oversized input abstains without provider work.

Physical scheduler bound4active +64waiting, one job per session, FIFO drain on settlement,120starts/rollingminute,30-second queue lease with explicit expiry and no automatic expiry retry; per-call default20starts and maximum120. Default meaningful-delta interval15seconds (capped30seconds), deadline5seconds. Deadline/cancel settle the UI flush but never free a physical slot until the provider select promise settles; all4 noncooperative promises leave later work queued then explicitly unavailable, avoiding unbounded unknown work. Provider adapter must preserve actual fetch/bodywork promise settlement. Superseding urgent/ranked rule evidence cancels older semantic work even when its card layout stays unchanged. Off always disables future inference even without manual-reference permission.

Generic reduceCard remains cursor-strict. A proposal reduces against its captured immutable timeline and is adopted only after current scope/epoch/card revision/worker/policy revision+admission/source versions/evidence and bounded delta guards. Captured CardPatch cursor stays truthful. onSelectorCheckpoint and lastSelectorCheckpoint retain an immutable {patchId,capturedCursor,commitCursor,deltaCursors,admissionReason,outcome} record without transcript text. Same-party exact normalized last-utterance repeats preserve question polarity; blank finals and a finite trusted-rep acknowledgement list can be benign. Any rep question or novel customer/meaningful rep speech invalidates old evidence. This deliberately does not solve arbitrary continuous novel-speech freshness; it schedules the next meaningful checkpoint conservatively. Validated unchanged automatic layout restores live approved status without a new changed-slot patch or dwell reset.

Diagnostics aggregate requests, selectorDiscards, selectorFailures, selectorCheckpoints, selectorQueueRejected, selectorQueued, transportUnsettled, and scheduler active/waiting/startedInWindow/failures. Mock evidence proves mechanics, not semantic quality, provider latency, production permissions, carrier delivery, or multi-process global limits. No provider calls, credentials, live activation, publication or deployment performed. Pi inspection found packages/agent AgentService/PiSession+before-turn coaching/transcript extensions oriented to free-form coaching and general tool/context injection, with optional peer/heavy dependency graph; no actual Pi extension integration or inference determinism is claimed.

Final focused command bun test script-context.test.ts playbooks-engine.test.ts script-matching.test.ts review-regressions.test.ts (full coaching paths) passed130tests/319assertions in2.55s, trace trc_01e45c6907ae. Same trace full dialer-server TypeScript check red due frozen script-matching.test.ts185/199 Bun variadic tuple typing and peer OpenRouter fixture speaker literal widening; no owned runtime/type diagnostics. Root/transport review owners notified. Broader review/verify, provider benchmark and service/browser evidence remain root-owned.

packages/dialer-server/src/coaching/script-engine.ts SHA256 613fe055207f89d30107c384c26139f5d154e89b9c823c744f9e393da56ed727
packages/dialer-server/src/coaching/context-selector.ts SHA256 a285ea6faa3fd9b06afea67d3b377c6b5bf8520ec8cd1407857f4842614edade
packages/dialer-server/src/coaching/context-scheduler.ts SHA256 5e35b257a8614d536f624c618ae6994009ffe6e39eaf8fa6622d561071864f8a
packages/dialer-server/src/coaching/script-context.test.ts SHA256 b3247bf920162ea87532bfe2f06a7b8440b86c96ba7b94872bc77c4255962b76
packages/dialer-server/src/coaching/review-regressions.test.ts SHA256 1ba86378a63fa0272962fce770e83c25b56a83d75e5ffd25d4272b660e89fcb6

- 2026-11-14 04:55:42 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:56:38 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:57:26 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:57:49 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-14 04:58:41 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-14 04:59:24 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
- 2026-11-14 05:00:43 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`

- 2026-11-14 05:01:40 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
## Coordinator browser proof — 2026-11-14

Final actual renderer/controller/client + Hono + isolated PostgreSQL localhost63500: uploaded custom Markdown via real file input/readScriptFile; saved, previewed, checked approval, edited alias to emerald umbrella; approval reset and publish disabled. Review plus fresh approval publishedV1. Full page reload plus preview restored alias with approval unchecked. Explicit synthetic example applied only one matching card, source points unchanged. Screenshot inspected: /tmp/opensaas-screenshots/mercury-reviewed-authoring-reload-20261114.png. OS pointer helper sometimes returned Done without activation; actual DOM .click via browser.eval triggered native disclosures/submission. Component functionality proof, not full GHL auth/pointer/visual acceptance. Own QA browser closed; BunPID44150/PG stopped, port unreachable, temporary DB dirs zero (trc_65146a59a52f). Signed-in GHL untouched. No calls/model requests.

Presence-only credential checks: OPENROUTER_API_KEY env and canonical Keychain service absent; another service may exist. No key values read/printed. User clarification pending; paid synthetic run still needs separate concrete approval.

- 2026-11-14 05:04:59 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

- 2026-11-14 05:05:09 apply-patch: `packages/dialer-server/src/coaching/script-context.test.ts`

- 2026-11-14 05:05:37 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 05:05:37 apply-patch: `packages/dialer-server/src/coaching/script-engine.ts`
- 2026-11-14 05:08:35 apply-patch: `packages/dialer-server/src/coaching/script-context.test.ts`

- 2026-11-14 05:09:01 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 05:09:01 apply-patch: `packages/dialer-server/src/coaching/context-selector.ts`
- 2026-11-14 05:09:59 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
### Replay owner — contextual evaluation scaffolding

Phrase-only hypothesis remains rejected at frozen 31/60 and 10/24; the same 45/60 and 18/24, zero wrong/late/false-interrupt gates now run explicitly offline rather than breaking ordinary unit CI. Hash-protected baseline and separately planted wrong/late/missed cases prove the gate and observer. Context lane uses integrated reviewed rules plus selector with all visible approved/manual changes, including unchanged-card approval and wrong-then-correct contamination; focused red `trc_57ecc83ccf86` and mock green `trc_5079047b7e66`. Wall-window and virtual measurements remain separate.

Explicit dated draft `packages/dialer-server/src/coaching-replay/provider-haiku.draft.json` sets Anthropic Haiku 4.5, 108 maximum attempts, four shared physical slots, no fallback/cache/retries, server prompt/completion maxima, and proposed $2 cap; it is not an approval or model default. Local-fake-only serialization `trc_c73e8636416f` produced 108 requests, 7,637–8,896 bytes each, 943,504 bytes total. Full-context worst reservation $0.40256 per request; 108 worst $43.47648. At most four initially fit the proposed cap; validated same-request cost can release surplus, missing/aborted/untrusted cost retains reserve, and the cap may stop the run early. Public endpoint metadata must be refreshed before execution, and separate explicit user approval and secure credential provision are required. No provider call, network access, or secret read occurred in this phase.

Replay source formatted and frozen `trc_c3744772fc23`; `bun test packages/dialer-server/src/coaching-replay` with provider/PG opt-ins unset: 39 pass, 1 opt-in PG skip, 0 fail `trc_02876627e22b`. Isolated PostgreSQL 37-assertion proof reran green `trc_2f060a8469a6`. Source hashes in `trc_b1726d57ec6a`; provider CLI SHA-256 `9b80043b889d9263bdc21753fccc609c1c2363ad0f967e75e82518930d45ff25`, benchmark `dca89626ab03bbf471beb36ea5432107f5285e82259aec30b676f87da0aa0d80`, budget `9ae9594fd1257ca5005b58cf7dcb3bde09067787fe2083ce8bd54b51d457643e`, draft `ae90711a28ca227648176b25484796e57aecff5bf42c98e058b6a1e7f1fd9350`. Browser component proof was driven by root and fixture/PG cleanup verified `trc_65146a59a52f`; it is not full CRM authentication or visual QA.

- 2026-11-14 05:14:37 apply-patch: `packages/dialer-server/src/coaching/script-matching.test.ts`
- 2026-11-14 05:14:37 apply-patch: `packages/dialer-server/src/coaching/script-context.test.ts`

- 2026-11-14 05:15:05 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
- 2026-11-14 05:15:05 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`
- 2026-11-14 05:15:05 apply-patch: `packages/dialer-server/src/coaching/script-engine.ts`
- 2026-11-14 05:15:18 apply-patch: `packages/dialer-server/src/coaching/script-matching.ts`

- 2026-11-14 05:16:24 apply-patch: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`

### Replay owner — strict review mechanical cleanup

Addressed 21 strict static findings in replay and OpenRouter transport/tests with typed caught values, explicit error propagation and equivalent stdout/stderr JSON/fixture output; no selector behavior, quality targets, labels, provider configuration or oracle changed. No new behavior-specific TDD was required for this nonfunctional static cleanup; existing replay, transport, failure/redaction and CLI refusal tests protect the affected behavior. Strict review `bun run review -- --strict --base origin/main --json` returned zero own findings `trc_e1286c482dbb`. Focused `bun test packages/dialer-server/src/coaching-replay packages/dialer-server/src/coaching/openrouter-selector.test.ts`: 56 pass, 1 opt-in PostgreSQL skip, 0 fail; dialer-server TypeScript check passed `trc_5556f2b35afb`. Earlier standalone isolated PostgreSQL proof was 37 assertions, and root reported prior all-package checks at 1,164 passes (server 530, lead connector 317, dialer 270, conversation 47; 123 DB skips) with four typechecks/builds green; root owns final fresh gates. No provider call, network or secret access.

## Frozen-source final local validation

Whole package checks: conversation47, Dialer270, server530, LeadConnector317 = 1,164 passed, zero failures; server123 opt-in DB cases skipped. Server current-source rerun trc_d826ca5ceb9e; other package traces trc_87964bd4c083,trc_80a678cccca0,trc_f8503653a10b. Separate actual local Hono/Postgres authoring race proof37assertions trc_2f060a8469a6. Four package typechecks/builds and compiled Node import smoke green trc_cc7e934dab29; mechanical follow-up replay/transport56pass and server tsc green trc_5556f2b35afb. Strict review zero trc_e1286c482dbb. Full managed verify publish-valid:9registry suites,DBguard3risks/0findings,trc_d480cecb29e0. Source is prepared, not production-released or model-quality-certified.

Public-metadata-only preflight trc_5a1af116b37c:108synthetic serialized requests,7637–8896bytes, no inference; modelHaiku4.5/Anthropic,512maxoutputtokens,4active admission, proposed$2aggregatecap with$0.40256worst reservation/request and refunds only on valid known cost. Fingerprint4903da3daf16c13b5f679ac8c34782a271655a09f64d9cce4812a7e23368e704; private directory /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/mercury-context-reviewed-plan-zYAZbI. Regenerate if any source/config/runtime/output directory changes. Real model quality remains unexecuted.

Credential lookup completed as requested: valid local consuelo_web key, account no usable credits; local coaching/OpenCode and Railway coaching keys invalid. Other relevant Railway services have no key. Read-only checks only, no credential values printed/stored in source, no Railway setting/deploy/billing changes. Need funded OpenRouter account and separate paid-run approval before model evaluation. Linear1701/1702/1707 remain open.

Publication mechanics: managed file-push requires remote ancestry equal localHEAD; scoped OS git push will first transmit only the previously verified dependency merge87577ee17875c171392a9dc0b74c786cccf963ba (candidate291df61 + current-main85cb7521 + taskbootstrap) non-forced, preserving all parents. All new source files then publish via task.push with this full verification stamp. Consolidate this task PR into existing draft2798, never main/shared divergentstream.

- 2026-11-14 05:31:48 append: `.task/dialer/improve-approved-script-matching-and-authoring/workpad.md`
