# tighten trace analytics output

branch: `task/workspace-agents/tighten-trace-analytics-output`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/537/tighten-trace-analytics-output
github pr: https://github.com/consuelohq/opensaas/pull/537
started: 2026-05-23

## acceptance criteria

- [ ] Reproduce `bun run trace:analytics` behavior without flooding agent context.
- [ ] Identify the script ownership path and exact output/token bloat source.
- [ ] Make small workflow-safe output changes only when evidence supports them.
- [ ] Preserve useful signal for pass/fail and failure triage.
- [ ] Validate the command after changes with bounded evidence.

## plan

1. Search prior trace-related context and explore current script ownership.
2. Run `bun run trace:analytics` through bounded orchestration and record size/timing/output classes.
3. Read the owning scripts/docs/tests before editing.
4. Patch the simplest correct output behavior.
5. Run focused validation and inspect the diff.

## current status

- Task started. Investigation in progress.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/ai-review.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`

## validation evidence

- pending

## key decisions

- pending

## issues and recovery

- none yet

- 2026-05-23 19:18:55 write: `.task/workspace-agents/tighten-trace-analytics-output/workpad.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/ai-review.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`

## workspace-owned: activity log

- 2026-05-23 19:18:55 fs.write: `.task/workspace-agents/tighten-trace-analytics-output/workpad.md`
- 2026-05-23 19:22:15 fs.write: `.task/workspace-agents/tighten-trace-analytics-output/workpad.md`
- 2026-05-23 19:22:54 fs.write: `packages/workspace/scripts/review.js`
- 2026-05-23 19:22:54 fs.write: `packages/workspace/scripts/verify.js`
- 2026-05-23 19:22:54 fs.write: `packages/workspace/SCRIPTS.md`
- 2026-05-23 19:25:17 fs.write: `packages/workspace/scripts/ai-review.js`
- 2026-05-23 19:27:02 fs.write: `packages/workspace/scripts/verify.js`
- 2026-05-23 19:27:44 fs.write: `packages/workspace/SCRIPTS.md`
- 2026-05-23 19:29:18 fs.write: `.task/workspace-agents/tighten-trace-analytics-output/workpad.md`

## investigation checkpoint

Observed `bun run trace:analytics` through bounded `code.run`:

- `trace:analytics` runtime: ~3.2s.
- `trace:analytics` output: ~29,778 chars / 254 lines.
- It shows the real bloat source is `review.run` and `verify`, not `trace:analytics` itself.
- Past-day tracked totals from the report: `review.run` ~3,735,766 tokens, `verify` ~544,119 tokens.

Files read:

- `scripts/operator/trace-analytics.ts`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/SCRIPTS.md`

Root causes found:

1. `review.js` human finding printer prints every finding in each rule group, then prints `... and N more` after already emitting the full list.
2. `review.js --json` returns full `yours` and `preExisting` arrays by default, which is the path used by workspace `review.run`.
3. `verify.js --json` embeds `review.data` directly, duplicating review payload into verify output.

Edit plan:

- Cap human finding rows per rule while preserving counts.
- Make `review --json` return compact finding summaries by default with a `--full-json` escape hatch.
- Teach `verify` to count both compact and legacy review JSON shapes.
- Keep `verify --json` bounded by summarizing review stderr text.
- Update `SCRIPTS.md` to document compact JSON defaults and the full-detail opt-in.

- 2026-05-23 19:22:15 append: `.task/workspace-agents/tighten-trace-analytics-output/workpad.md`

- 2026-05-23 19:22:54 write: `packages/workspace/scripts/review.js`

- 2026-05-23 19:22:54 write: `packages/workspace/scripts/verify.js`

- 2026-05-23 19:22:54 write: `packages/workspace/SCRIPTS.md`

- 2026-05-23 19:25:17 write: `packages/workspace/scripts/ai-review.js`

- 2026-05-23 19:27:02 write: `packages/workspace/scripts/verify.js`

- 2026-05-23 19:27:44 write: `packages/workspace/SCRIPTS.md`

## workspace-owned: validation evidence

- pending
- 2026-05-23 19:27:57 `review.run`: passed — OK

## final validation checkpoint

Files changed:

- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/scripts/ai-review.js`
- `packages/workspace/SCRIPTS.md`

What changed:

- Added bounded human finding output in `review.js`: each rule group now prints at most 10 findings, then reports the omitted count.
- Made `review --json` compact by default for agents and automation:
  - totals by bucket
  - per-rule counts
  - samples capped at 20 findings
  - explicit `truncated` / `omitted` fields
- Added `review --json --full-json` as the manual deep-inspection escape hatch with the original full arrays.
- Updated `verify.js` to consume both legacy full-array review JSON and compact `review.v2.compact` JSON.
- Kept `verify --json` useful while bounding review stderr metadata.
- Fixed `verify --review-arg` so it can pass flag-like args such as `--no-tests` to `review`.
- Updated `ai-review.js` to consume compact review JSON without requiring full arrays.
- Updated `SCRIPTS.md` docs for compact review/verify JSON and `--review-arg=--no-tests`.

Evidence:

- `node --check packages/workspace/scripts/review.js`: passed.
- `node --check packages/workspace/scripts/verify.js`: passed.
- `node --check packages/workspace/scripts/ai-review.js`: passed.
- `bun run review -- --base origin/main --json --quiet --no-tests`: compact payload passed; 693 bytes on this branch; schema `review.v2.compact`; 0 current findings.
- `bun run review -- --base origin/main --json --full-json --quiet --no-tests`: passed; full arrays still available.
- `bun run verify -- --base origin/main --json --no-db --no-stamp --review-arg=--no-tests`: passed; 1,568 bytes; review schema `review.v2.compact`; DB skipped.
- `bun run trace:analytics`: passed; ~29,668 chars / 254 lines; recent task branch total tracked output 91,094 tokens including failed exploratory code.run attempts, while the compact direct review/verify runs were small.
- `bun run verify -- --base origin/main --no-db`: passed; review pass; verify stamp written.

Conclusion:

The slow runtime is still mostly `review.run`/`verify` doing real work. The token bloat was mainly the agent-facing payload shape: full static-analysis arrays, duplicate review payload inside verify, and uncapped human findings. This patch keeps the gate information but makes the default automation path count-and-sample based, with full detail available only when explicitly requested.

- 2026-05-23 19:29:18 append: `.task/workspace-agents/tighten-trace-analytics-output/workpad.md`
