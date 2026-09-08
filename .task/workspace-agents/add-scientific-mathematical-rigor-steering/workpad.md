# add scientific mathematical rigor steering

branch: `task/workspace-agents/add-scientific-mathematical-rigor-steering`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2416
started: 2026-09-08

## acceptance criteria

- [x] Add the approved scientific/mathematical rigor guidance to the canonical Senior Engineer instructions.
- [x] Include an explicit trigger for repeated ranking/routing/scheduling/allocating/caching/sampling/prediction/retry/stopping/detection decisions under uncertainty.
- [x] Audit current Consuelo code for concrete high-value algorithmic opportunities and distinguish them from surfaces that should remain deterministic or simple.
- [ ] Validate the steering-only diff, strict review, and canonical verify; push and promote to `stream/workspace-agents`.

## plan

1. Read the canonical Senior Engineer guidance and current decision-heavy code paths.
2. Add the approved rigor section without changing executable behavior.
3. Record grounded algorithmic opportunities for Ko.
4. Run docs-appropriate validation, strict review, canonical verify, push, and promote to the stream.

## files changed

- `packages/workspace/senior-engineer.md`

## key decisions

- Keep hard safety/correctness constraints deterministic. Advanced algorithms are candidates only for repeated decisions under uncertainty, scarcity, noisy evidence, or competing objectives.
- Do not replace Explore's existing RRF/MMR/fusion stack for novelty; calibrate and learn its policy from benchmark/shadow evidence first.
- Treat the old API five-minute retry rule as low-priority because standalone Dialer owns the mature predictive path.

## notes for ko

- Highest-leverage non-Dialer research candidates are CI/test selection, automatic node routing + worker capacity, observability sampling/retention, tool/search ranking calibration, release canary statistics, and model routing.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Senior Engineer guidance explicitly requires scientific and mathematical rigor for algorithmic/statistical/scientific/performance-critical/data-modeling work and prompts agents to notice repeated decision systems that may merit stronger algorithms.
existing local pattern: engineering judgment belongs in `packages/workspace/senior-engineer.md`; this task is steering/docs-only and does not change runtime behavior.
new or changed tests: none; validate by exact-text inspection, Markdown integrity, structured diff review, strict review, and canonical verify.
focused red command: not applicable for docs-only steering.
expected red failure: not applicable.
no-test waiver: approved by change class — steering/docs-only; no executable behavior changes.

## Plan

1. Add the approved rigor section verbatim to the engineering-judgment portion of Senior Engineer, plus the algorithmic-trigger sentence.
2. Inspect the current repo for repeated ranking/routing/scheduling/allocating/caching/sampling/predicting/retry/stopping/detection surfaces and record concrete opportunities for Ko.
3. Validate exact wording/Markdown, inspect the diff, run strict review and verify, then push/promote to `stream/workspace-agents`.

- 2026-09-08 14:46:22 append: `.task/workspace-agents/add-scientific-mathematical-rigor-steering/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:46:22 fs.write: `.task/workspace-agents/add-scientific-mathematical-rigor-steering/workpad.md`
- 2026-09-08 14:48:26 fs.write: `.task/workspace-agents/add-scientific-mathematical-rigor-steering/workpad.md`

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`

## Codebase algorithm audit findings

High-value current decision surfaces:

- OS node routing: explicit/session/default routing is correctness-first today; automatic mode has readiness/compatibility/presence evidence but no multi-objective cost/latency/load/reliability optimizer. Preserve explicit nodeId and session affinity as hard constraints; automatic routing is the algorithmic opportunity.
- OS worker pool: worker count defaults to 2 with max 16; restart delay and exponential relaunch backoff are fixed; rolling admission/drain timings are fixed. Candidate research: queueing/load models, arrival-rate estimation, adaptive capacity, optimal warm/cold stopping, jittered recovery.
- Explore/retrieval: already uses weighted reciprocal-rank fusion, MMR, semantic/lexical/exact/scope/structural/graph channels. Candidate research should calibrate channel weights/MMR/RRF/confidence from benchmark and task-success evidence rather than replacing the architecture.
- tools.search: BM25 plus many manually weighted score parts and hand-set confidence/gap thresholds. Strong candidate for offline learning-to-rank/calibration with deterministic fallback and falsifiable benchmark gates.
- test selection: current selection is static source-glob/rule matching and suites run sequentially with a fixed timeout. Candidate research: dependency constraints plus historical failure probability/duration, constrained coverage/knapsack/set-cover selection, and critical-path/list scheduling. Keep critical safety rules hard constraints.
- observability traces: retention is size-triggered FIFO with min-row protection. Candidate research: priority/tail sampling, anomaly/change-point retention, streaming quantile/heavy-hitter sketches, information-value-aware retention; never discard rare failures merely because they are old.
- release channels: promotion is deterministic dev→canary→beta→stable with evidence/approval requirements. Candidate research: sequential confidence-sequence/SPRT-style canary guardrails using explicit SLO metrics; keep cryptographic provenance and human stable approval as hard constraints.
- agent model routing: current `packages/agent` model cycling is essentially coaching vs general. Candidate research: calibrated quality/cost/latency routing after honest outcome/cost logging; contextual bandit only after offline/shadow policy evaluation exists.
- media vision: scene detection uses a fixed 0.35 frame-difference threshold. Candidate research: robust adaptive thresholds (median/MAD) or online change-point detection before heavier ML.
- old API retry policy: fixed five-minute high-priority no-answer retry. This is an algorithmic smell, but likely low investment priority because it is legacy/Twenty-era API surface and the standalone Dialer now owns the mature predictive retry/timing architecture.
- steering cache: bounded 64-entry LRU with dependency fingerprints is simple and defensible; do not complicate unless profiling shows pressure. If needed later, W-TinyLFU/adaptive TTL-style ideas are candidates, not defaults.

General trigger: invest in stronger algorithms when repeated decisions occur under uncertainty, scarce resources, competing objectives, or noisy evidence. Keep auth, permissions, explicit user routing, cryptographic provenance, schema validation, and other safety invariants deterministic.

- 2026-09-08 14:48:26 append: `.task/workspace-agents/add-scientific-mathematical-rigor-steering/workpad.md`

- 2026-09-08 14:49:05 apply-patch: `.task/workspace-agents/add-scientific-mathematical-rigor-steering/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 14:52:06 `review.run`: passed — OK
- 2026-09-08 14:52:07 `review.run`: passed — OK
