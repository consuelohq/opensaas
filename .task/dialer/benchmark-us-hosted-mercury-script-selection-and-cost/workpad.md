# Benchmark US-hosted Mercury Script selection and cost

branch: `task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2809/benchmark-us-hosted-mercury-script-selection-and-cost
github pr: https://github.com/consuelohq/opensaas/pull/2809
started: 2026-11-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/dialer-server/src/coaching-replay/README.md`
- `packages/dialer-server/src/coaching-replay/provider-artifact.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-artifact.ts`
- `packages/dialer-server/src/coaching-replay/provider-benchmark.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-benchmark.ts`
- `packages/dialer-server/src/coaching-replay/provider-cli.ts`
- `packages/dialer-server/src/coaching-replay/provider-config.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-config.ts`
- `packages/dialer-server/src/coaching-replay/provider-metadata.test.ts`
- `packages/dialer-server/src/coaching-replay/provider-metadata.ts`
- `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- `packages/dialer-server/src/coaching/openrouter-selector.ts`
- `packages/dialer-server/src/coaching-replay/PROVIDER-EVALUATION.md`


## workspace-owned: files changed

- `packages/dialer-server/src/coaching-replay/PROVIDER-EVALUATION.md`

## workspace-owned: activity log

- 2026-11-16 18:34:07 fs.write: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`
- 2026-11-16 18:43:29 fs.write: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`
- 2026-11-16 18:44:37 fs.write: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`
- 2026-11-16 18:49:05 fs.write: `packages/dialer-server/src/coaching-replay/PROVIDER-EVALUATION.md`
- 2026-11-16 18:59:33 fs.write: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`
- 2026-11-16 19:05:56 fs.write: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`

## workspace-owned: validation evidence

- 2026-11-16 18:52:32 `review.run`: passed — OK
- 2026-11-16 18:53:50 `review.run`: passed — OK
- 2026-11-16 18:57:21 `review.run`: passed — OK
- 2026-11-16 19:01:27 `review.run`: passed — OK
- 2026-11-16 19:08:27 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Scope and acceptance — funded benchmark resumption (2026-11-16)

Ko resumed the prepared DeepSeek benchmark after funding OpenRouter and requested US inference providers, cost-per-useful-result analysis, and a possible GPT-6 Luna comparison depending on first-run cost. First-run bound remains maximum108 synthetic requests and$2 total; do not assume a fresh$2 for every model or retry. No production deployment, live call/capture/permissions, credential rotation or billing changes. Keep original72+36 frozen cases, positive windows, targets and denominators intact. Provider/model identity, no-fallback routing, unknown-cost reservations and immutable source/config fingerprints remain authoritative.

Current draft#2798 is still d6a82f64b6efd78152fac8059a28c18930f0ede8 with18checks complete/0failed/0pending. This new task starts on currentmain2bacf5e1bac66d85825d178985d4cc5b52bb307c; merge the pinned candidate only as a dependency for isolated evaluation, not the divergent shared stream. US company requirement will be met by explicit allowlist (Wafer and DeepInfra are listed US-headquartered by OpenRouter); prefer exact wafer/us for the first run. Premium OpenRouter in-region gateway requires Business/Enterprise and is separate from selecting a US inference endpoint; no plan upgrade is authorized.

Credential blocker: all previously saved local keys are invalid or report zero available credits as of trc_0fe98dafd9be /trc_7ac8398a6c2d. Ko was asked to save the funded-workspace key in Keychain service OPENROUTER_API_KEY using a hidden prompt; never put keys in args/logs/repo/Linear. Continue public metadata, current harness inspection and safe private preflight while waiting. No paid inference has occurred.

## Test-first contract

behavior under test: exact published selector on frozen synthetic transcripts, recorded real provider quality/timing/cost; all controls unchanged.
existing local pattern: coaching-replay provider-cli/config/budget/ledger and frozen quality oracle from candidate#2798.
new or changed tests: none yet; run existing focused harness tests and public-only preflight before any paid execution. Add a focused failing regression before any source repair if inspection reveals a real defect.
focused red command: not applicable to execution-only evaluation; preserved literal baseline is scientifically rejected31/60 original and10/24 independent positives.
expected red failure: no relabelling or softened latency/quality threshold is permitted to turn a bad model run green.
no-test waiver: no production source edit planned; provider quotes/private config and evidence collection are reversible experiment inputs, not feature implementation. Source changes require a new explicit test-first entry.

- 2026-11-16 18:34:07 append: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`

## Nov 16 first paid run and focused scope update

Paid Wafer US first attempt completed with 71 physical requests /108 logical cases; 19 validated output/usage reports, 52 unknown charge reservations, 37 budget refusals. No retries or fallback. Private fingerprint b54c85c6ad1e3476f0840718d7ec7939d178ba63dd083f2139b8886db73b4554. Original artifact immutable. Account balance delta approximately $0.002366432, not request-level reconciliation. Known settled cost $0.000655339; outstanding reserved ceiling $1.976246272. This is INCONCLUSIVE provider-quality evidence, not a model win/fail ranking.

Confirmed source defect: onProviderMetadata is called only after output validation, so invalid but billed selections cannot settle validated same-request cost and the diagnostic error is generic. Scope now includes a focused regression-first repair: preserve strict cue validation, separate numeric attempt/accounting diagnostics, retain unknown/aborted costs, record cache/reasoning counts only when actually reported. No arbitrary content or generation text in artifacts. No changes to frozen oracles, request prompt/schema, deadlines, provider routing, or production activation. Additional paid diagnostics/Luna approval requested asynchronously ($1 shared / up to116 requests), not yet granted; no new inference until it arrives.

- 2026-11-16 18:43:29 append: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`

Second confirmed preflight gap (root ownership provider-metadata.ts/test only): fresh Luna/OpenAI metadata includes pricing.overrides at272000 input tokens. Existing metadata guard only checks base prices, so full-context reservation ignores higher prompt/cache-write/output tiers. Regression-first repair must preserve exact base routing-price verification while conservatively reserving maximum documented tier rates; malformed overrides fail closed. This does not authorize another paid run. Provider observer worker owns transport/benchmark/artifact/CLI files and tests separately.

- 2026-11-16 18:44:37 append: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`

- 2026-11-16 18:44:53 apply-patch: `packages/dialer-server/src/coaching-replay/provider-metadata.test.ts`
- 2026-11-16 18:45:06 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-16 18:45:06 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.test.ts`
- 2026-11-16 18:45:20 apply-patch: `packages/dialer-server/src/coaching-replay/provider-metadata.ts`
- 2026-11-16 18:45:47 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-16 18:46:19 apply-patch: `packages/dialer-server/src/coaching-replay/provider-artifact.ts`
- 2026-11-16 18:46:19 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.ts`
- 2026-11-16 18:46:19 apply-patch: `packages/dialer-server/src/coaching-replay/provider-cli.ts`
- 2026-11-16 18:46:50 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.ts`
- 2026-11-16 18:47:50 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-16 18:47:50 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.test.ts`
- 2026-11-16 18:47:50 apply-patch: `packages/dialer-server/src/coaching-replay/provider-artifact.test.ts`
- 2026-11-16 18:48:49 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-16 18:48:49 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.test.ts`
- 2026-11-16 18:48:49 apply-patch: `packages/dialer-server/src/coaching-replay/provider-artifact.test.ts`
- 2026-11-16 18:49:05 write: `packages/dialer-server/src/coaching-replay/PROVIDER-EVALUATION.md`

- 2026-11-16 18:49:12 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-16 18:49:12 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-16 18:49:12 apply-patch: `packages/dialer-server/src/coaching-replay/provider-artifact.ts`
- 2026-11-16 18:49:12 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.ts`
- 2026-11-16 18:49:19 apply-patch: `packages/dialer-server/src/coaching-replay/README.md`
- 2026-11-16 18:50:56 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.test.ts`
- 2026-11-16 18:51:14 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.ts`
- 2026-11-16 18:51:14 apply-patch: `packages/dialer-server/src/coaching-replay/provider-artifact.ts`
- 2026-11-16 18:52:21 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`

- 2026-11-16 18:52:38 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-16 18:52:38 apply-patch: `packages/dialer-server/src/coaching-replay/provider-artifact.ts`
- 2026-11-16 18:52:52 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`

- 2026-11-16 18:55:48 apply-patch: `packages/dialer-server/src/coaching-replay/provider-config.test.ts`
- 2026-11-16 18:55:48 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`
- 2026-11-16 18:56:06 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-16 18:56:06 apply-patch: `packages/dialer-server/src/coaching-replay/provider-config.ts`
- 2026-11-16 18:56:18 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.ts`
- 2026-11-16 18:56:18 apply-patch: `packages/dialer-server/src/coaching-replay/provider-config.test.ts`
- 2026-11-16 18:56:18 apply-patch: `packages/dialer-server/src/coaching/openrouter-selector.test.ts`

Follow-up DeepSeek diagnostic (approved NEW $1 scope) ran8/8 physical requests: all HTTP200/finish stop; stages accepted4,slots3,evidence1. All8 costs reconciled, spent$0.000297800, unknown/reserved0; no refusal/fallback/retry. Input12132, cached8960 (8 actual reports), output188, reasoning0 (reported); this8-case diagnostic is not full-cohort model quality. Artifact fingerprint b576db5401ff774ebcb7d5dcb96a4ebc1af16f664a6ea98c2c8ec93d8a5cd1b5 preserved.

Fresh Luna/Bedrock US East preflight requires$0.2891724 worst-context reservation per request and has$0.69 cap, hence2 affordable simultaneous requests (preflight explicitly reports2). Existing benchmark scheduler unconditionally admits4 and would immediately budget-refuse jobs despite known cheap successful requests. Add focused red→green budget-aware physical scheduler admission derived from the reviewed cap/reservation, bounded1..4, without changing20 logical scenarios, frozenwindows, prompts, output validation or provider. Report that Luna's budget-limited two-slot operating point is not a fair raw-speed ranking against four-slot Wafer. Unknown outcomes can still exhaust the cap; never release them just to complete the cohort. Root/worker ownership unchanged.

- 2026-11-16 18:59:33 append: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`

- 2026-11-16 19:00:08 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.test.ts`
- 2026-11-16 19:00:19 apply-patch: `packages/dialer-server/src/coaching-replay/provider-benchmark.ts`
- 2026-11-16 19:00:59 apply-patch: `packages/dialer-server/src/coaching-replay/README.md`
- 2026-11-16 19:00:59 apply-patch: `packages/dialer-server/src/coaching-replay/PROVIDER-EVALUATION.md`

- 2026-11-16 19:05:27 apply-patch: `packages/dialer-server/src/coaching-replay/PROVIDER-EVALUATION.md`
## Nov 16 paid evaluation completed — acceptance still blocked

Luna/Bedrock US East fingerprint e61acde9264445a298124587b4de4189658ff2eb8279aaf80a421acf6fd3f814:108 physical requests,108 HTTP200/stop/valid responses,108 reconciled costs,0 unknown/refused/unsettled; spent9209173 nanoUSD. Diagnostic + Luna spent9506973 nanoUSD (<1 cent); all8+108 authorized follow-up requests consumed, so unused dollar cap does NOT authorize further inference. Initial physical capacity3 derived from remaining999702200 nanoUSD after diagnostic costs fully settled. Logical scopes20; no retries/fallback/live permissions/recording/carrier calls.

Actual wall gate FAILED: original38/60, independent14/24, negatives23/24,1 wrong/false visible,10 late visible (5.13–6.00s after ingest),29 selector discards. Virtual clock45/60+17/24, samefalse interruption; no label/window/target changes. S035 historical coverage is the false interruption. Provider response/slot schema now reliable for this model pair, but semantic/current-topic and queue-to-cue correctness remain blockers. Cache counters actually reported for all108:148927/184311 input reads,35168 writes,4930 output,0reasoning. Existing private artifact source fidelity retained. See PROVIDER-EVALUATION.md for full honest comparison and caveats.

Implemented source regressions: rejected response accounting/diagnostics with closed numeric fields, actual cached/reasoning usage (absence remains unknown), display-name spaces with exact identity but unchanged routing-ID validation, conservative tiered pricing, and budget-derived scheduler concurrency. Root review caught token denominators and explicit any; fixed before second paid round. Provider safety suite now51 pass; local server TS clean per worker. Strict focused review zero findings. Full verify and scoped task publication pending. Read-only Sol diagnosis is identifying next DEV-1702 source fixes; no further paid work will be run in this scope.

- 2026-11-16 19:05:56 append: `.task/dialer/benchmark-us-hosted-mercury-script-selection-and-cost/workpad.md`
