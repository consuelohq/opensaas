# compact explore response contract

branch: `task/workspace-agents/compact-explore-response-contract`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2050/compact-explore-response-contract
github pr: https://github.com/consuelohq/opensaas/pull/2050
started: 2026-08-15

## acceptance criteria

- [x] Default Explore JSON/API response is compact without changing retrieval/ranking.
- [x] Compact results preserve actionable ownership, location, rationale, evidence, and bounded dependency context.
- [x] `detail: "full"` returns the legacy rich diagnostic payload.
- [x] Full rich payload remains the durable explore-state/evidence source even when stdout is compact.
- [x] Typed facade accepts compact/full detail and forwards it to the Explore CLI.
- [x] Deterministic fixture proves a material payload-size reduction without changing result order/count.
- [ ] Relevant OS tests, generated-surface checks, review, verify, push, and stream promotion are green.

## plan

1. Add pure output-contract tests around a rich synthetic Explore payload and typed dependency edges.
2. Add typed facade/handler contract tests for `detail: compact|full`.
3. Implement output-only compaction; keep rich payload persistence and ranking untouched.
4. Regenerate required OS public surfaces and document the detail mode.
5. Run focused/broad validation, strict review, verify, push, and promote to `stream/workspace-agents` only.

## current status

- Discovery complete. Active source is `packages/os`; deprecated `packages/workspace` Explore mirror will not be changed. E0 benchmark work remains parallel/out of scope.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 08:36:08 `audit`: failed — COMMAND_FAILED
- 2026-08-15 08:39:26 `review.run`: passed — OK
- 2026-08-15 08:40:04 `verify`: passed — OK
- 2026-08-15 08:40:24 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```


## Test-first contract

- Behavior under test: default Explore structured output is a bounded decision/dependency packet; explicit full detail preserves the pre-E1 rich payload; formatting cannot mutate or replace the rich state payload.
- Existing local pattern: OS facade uses typed Zod inputs plus decision-engine handler argument mappings; human Explore output already bounds graph connections to three.
- New or changed tests: add a pure Explore output contract test using a synthetic rich payload; extend OS manifest/facade contract coverage for the detail input and CLI mapping.
- Focused RED command: preflight the selected test sources, then run the new Explore output test plus relevant tool-manifest/facade contract tests.
- Expected RED failure: compact formatter/module and detail schema/handler mapping do not exist; current default output exposes rich typed edges and score parts.
- No-test waiver: none.

## Key decisions

- E1 changes serialization only. Retrieval, ranking, beliefs, confidence math, information-value math, and action policy are explicitly out of scope.
- Durable Explore state and evidence continue to use the full rich payload; compacting those would damage later E2-E5 research.
- Use the existing OS convention `detail: "compact" | "full"`, defaulting to compact.
- Keep typed dependency context in compact output, but bound it; expose total connection count so agents know when full drill-down exists.
- Do not mirror edits into deprecated `packages/workspace`.

## Issues and recovery

- `task.start` from the intentionally stale workspace-agent stream succeeded, but current `task:fs` metadata resolution cannot see this task branch. Task-scoped `code.call` correctly resolves the isolated worktree; use it for read/edit/test evidence for this task rather than mutating the shared stream.

## Wait recovery

Wait reason: workspace transport dropped twice during focused-test safety preflight.
Duration: 15s.
Resume action: rerun destructive-literal scan on packages/os/tests/explore-output-contract.test.ts.
Expected signal: safe=true with zero hits.
Fallback: if transport still fails, record the tool-path blocker and switch to the next workspace-supported validation path.


## E1 validation summary

- Rich state/evidence remains unchanged; compaction is stdout/API-only.
- Compact packet preserves ranked result order/count plus ownership, lines, rationale, evidence, information value, and three typed dependency links with total connection count.
- Synthetic active payload: 22,574 -> 8,035 bytes (64.4% smaller), 10/10 results preserved.
- RED: formatter missing. GREEN: focused Explore contract 5/5.
- Final focused integration: 22/22 tests. OS typecheck passed. Generated manifest check passed. CLI help/invalid-detail smoke passed.
- Full legacy facade suite has 43 unrelated stale-stream failures (media fixture validation, fs wording, subagent/task-session routing); no E1-owned failure. Accidental snapshot output from that run was restored.
- Global audit remains red on pre-existing script/docs drift and 9,756 stale path references; E1-specific docs and manifest generation/check are current.
- Task base for review/publish: origin/stream/workspace-agents@9a7b8783e53ef85b436fbb18d671401752aae217. Local stream ref is stale and must not be used as review base.

## Review evidence

- Strict review against immutable task base `9a7b8783e53ef85b436fbb18d671401752aae217`: 0 owned issues, 0 pre-existing issues in review scope, 0 blockers.
- One nonblocking documentation opportunity mapped to the public documentation tools reference. E1 intentionally does not widen into a public-doc rewrite: the canonical OS `SCRIPTS.md`, generated `TOOLS.md`, manifest signatures, and generated workspace typing already document the new detail contract.

## Verify evidence

- Canonical verify against `9a7b8783e53ef85b436fbb18d671401752aae217`: passed, `publishValid: true`.
- Verify recognized 11 E1 files, reran review with 0 blockers, and DB safety reported 0 risks.
- Remaining action is publish task PR #2050 and promote only into `stream/workspace-agents`.

## Final changed implementation files

- `packages/os/scripts/lib/search/explore-output.js`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tools/decision-engine/handler.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/os/manifests/generated/core.manifest.json`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/src/generated/workspace.d.ts`
