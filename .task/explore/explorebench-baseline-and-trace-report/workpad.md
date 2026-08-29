# ExploreBench baseline and trace report

branch: `task/explore/explorebench-baseline-and-trace-report`
stream: `stream/explore`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2049/explorebench-baseline-and-trace-report
github pr: https://github.com/consuelohq/opensaas/pull/2049
started: 2026-08-15

## acceptance criteria

- [x] Add a deterministic ExploreBench library that ingests trace/evidence fixtures without mutating Explore state or ranking.
- [x] Deduplicate evidence events by stable event id before usage counts.
- [x] Report Explore/decideNext/confidenceScore/exploit adoption, output-token/byte distributions, result counts, per-field payload attribution, and compact-packet size projections.
- [x] Add a versioned benchmark-case schema with required/relevant paths and dependency roles; include an initial curated v1 corpus without secrets or raw user trace payloads.
- [x] Compute standard retrieval metrics from labeled cases: Recall@k, MRR, and nDCG@k; report missing labels instead of inventing relevance.
- [x] Generate machine-readable JSON plus a compact Markdown baseline report from aggregate/local trace evidence.
- [x] Do not change Explore retrieval, ranking, belief updates, or public response behavior in E0.
- [x] Preserve privacy: commit aggregate metrics and curated benchmark cases only; never commit raw trace databases, tokens, credentials, phone/email content, or absolute home paths.

## plan

1. Inspect Explore output, ranking, evidence-log, trace-store, and local test conventions.
2. Write fixture-driven red tests for de-duplication, quantiles/token accounting, field attribution, compact-packet projection, benchmark schema, and IR metrics.
3. Implement `lib/explore-bench` as pure deterministic analysis utilities.
4. Add a CLI/report generator that discovers or accepts local trace/evidence inputs read-only and writes JSON/Markdown only when explicitly requested.
5. Curate v1 benchmark cases from representative Explore intents with explicit required/relevant paths and dependency roles.
6. Run the report against local aggregate evidence; commit a sanitized/versioned baseline.
7. Run workspace tests/review/verify; push and promote into `stream/explore`.

## Test-first contract

behavior under test:
- Evidence events are de-duplicated by id before command adoption statistics.
- Token/byte summaries are deterministic and use explicit sample counts/quantiles.
- Payload-field attribution counts serialized value bytes consistently and identifies duplicated/debug-heavy fields.
- Compact projection preserves decision-critical identity/evidence fields while measuring, not claiming, token savings.
- Labeled benchmark cases compute Recall@k, reciprocal rank, and nDCG correctly; unlabeled cases are excluded and counted.
- Report generation never needs live embeddings/index state and does not mutate Explore state.

existing local pattern:
- `packages/workspace/tests/explore-ranker.test.js` uses Vitest with CommonJS implementation modules loaded through `createRequire`.
- Workspace CLI scripts are Bun entrypoints with pure helper modules under `scripts/lib`.

new or changed tests:
- new `packages/workspace/tests/explore-bench.test.js` with synthetic trace/evidence fixtures and hand-computed IR expectations.
- optional CLI contract test if output/file behavior needs separate proof after the pure library is green.

focused red command:
- `bunx vitest run packages/workspace/tests/explore-bench.test.js`

expected red failure:
- test import fails because `scripts/lib/explore-bench.js` does not exist yet.

no-test waiver: not applicable.

## current status

- E0 task created on a new `stream/explore` from current `main`.
- Current Explore payload/ranker/evidence paths inspected; no ranking behavior changed.
- Live discovery during E0 reproduced multi-thousand-token Explore outputs, reinforcing the need for a measured baseline.

## files changed

- `packages/workspace/explore-bench/cases.v1.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/explore-bench.js`
- `packages/workspace/scripts/lib/explore-bench.js`
- `packages/workspace/tests/explore-bench.test.js`

## workspace-owned: files changed

- `packages/workspace/explore-bench/cases.v1.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/explore-bench.js`
- `packages/workspace/scripts/lib/explore-bench.js`
- `packages/workspace/tests/explore-bench.test.js`

## workspace-owned: activity log

- 2026-08-15 08:26:30 fs.write: `.task/explore/explorebench-baseline-and-trace-report/workpad.md`
- 2026-08-15 08:26:51 fs.write: `packages/workspace/tests/explore-bench.test.js`
- 2026-08-15 08:27:32 fs.write: `packages/workspace/scripts/lib/explore-bench.js`
- 2026-08-15 08:27:53 fs.write: `packages/workspace/tests/explore-bench.test.js`
- 2026-08-15 08:28:04 fs.write: `packages/workspace/tests/explore-bench.test.js`
- 2026-08-15 08:29:58 fs.write: `packages/workspace/tests/explore-bench.test.js`
- 2026-08-15 08:30:30 fs.write: `packages/workspace/scripts/lib/explore-bench.js`
- 2026-08-15 08:30:46 fs.write: `packages/workspace/tests/explore-bench.test.js`
- 2026-08-15 08:31:31 fs.write: `packages/workspace/explore-bench/cases.v1.json`
- 2026-08-15 08:31:49 fs.write: `packages/workspace/scripts/lib/explore-bench.js`
- 2026-08-15 08:32:22 fs.write: `packages/workspace/scripts/explore-bench.js`
- 2026-08-15 08:32:28 fs.write: `packages/workspace/package.json`
- 2026-08-15 08:33:11 fs.write: `packages/workspace/scripts/lib/explore-bench.js`
- 2026-08-15 08:33:12 fs.write: `packages/workspace/tests/explore-bench.test.js`
- 2026-08-15 08:34:54 fs.write: `packages/workspace/scripts/lib/explore-bench.js`
- 2026-08-15 08:34:55 fs.write: `packages/workspace/scripts/explore-bench.js`
- 2026-08-15 08:35:11 fs.write: `packages/workspace/scripts/lib/explore-bench.js`
- managed by task workflow.

## workspace-owned: validation evidence

- Privacy/secret scan: clean for committed baseline JSON/Markdown, curated cases, and ExploreBench test; no high-entropy credential patterns or absolute home paths.
- Focused Vitest: `bun run --cwd packages/workspace test tests/explore-bench.test.js tests/explore-ranker.test.js` -> 14/14 passed.
- Strict review against `stream/explore`: 0 findings / 0 blockers owned by E0; one pre-existing openworkspace typecheck issue remains outside E0.
- Control baseline: 9 curated cases; Recall@10 0.550, required-node Recall@10 0.648, MRR 0.557, nDCG@10 0.428.
- Historical trace baseline: 11 successful payloads; median 9,420 output tokens; compact projection median ~1,704 tokens / 81.9% median serialized-byte reduction.
- 2026-08-15 09:18:39 `review.run`: passed — OK
- 2026-08-15 09:19:20 `review.run`: passed — OK
- 2026-08-15 09:19:44 `verify`: passed — OK

## key decisions

- E0 is measurement infrastructure only. E1 owns compact response behavior; E2+ own ranking/policy changes.
- Raw local traces are analysis inputs, not repository artifacts. The committed baseline must be sanitized and aggregate-only.
- Retrieval metrics require curated relevance labels; changed files alone are not treated as gold truth.

## notes for ko

- New durable stream is `stream/explore`; E0 task PR is #2049.
- E0 is intentionally safe to run in parallel with other repo work because it does not modify Explore ranking or response semantics.

## improvements noticed

- Current Explore JSON contains repeated path/line/preview information across base fields, `target`, graph fields, and score/debug objects; E0 will quantify this rather than removing it.

## issues and recovery

- `task.start` initially failed because `stream/explore` did not exist. Created the durable stream explicitly from `main`, then started the task successfully.
- The generic container runtime cannot mount the host-managed task worktree; repository lifecycle and validation remain on the authenticated workspace task facade.

---

## publish checklist

```bash
bun run task:push -- --message "feat(explore): add ExploreBench baseline" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-15 08:26:30 write: `.task/explore/explorebench-baseline-and-trace-report/workpad.md`

- 2026-08-15 08:26:51 write: `packages/workspace/tests/explore-bench.test.js`

- 2026-08-15 08:27:32 write: `packages/workspace/scripts/lib/explore-bench.js`

- 2026-08-15 08:27:53 write: `packages/workspace/tests/explore-bench.test.js`

## workspace-owned: files read

- `packages/workspace/package.json`
- `packages/workspace/scripts/context.js`
- `packages/workspace/scripts/explore-bench.js`
- `packages/workspace/scripts/lib/explore-bench.js`
- `packages/workspace/scripts/lib/state/explore-state.js`
- `packages/workspace/tests/explore-bench.test.js`

- 2026-08-15 08:35:11 write: `packages/workspace/scripts/lib/explore-bench.js`
