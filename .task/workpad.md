# fix pr 392 codex review findings

branch: `task/workspace-agents/fix-pr-392-codex-review-findings`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/394
started: 2026-05-13

## accepted review findings

- [x] Codex on `packages/workspace/scripts/decide-next.js`: target-key dedupe could let the same file appear as both primary and alternative when one candidate has a target key and another is path-only.
- [x] Codex on `packages/workspace/scripts/lib/search/retriever.js`: graph hydration overwrote the hydrated chunk name with an edge symbol, which could mismatch target name and target lines.
- [x] Codex on `packages/workspace/scripts/lib/index/chunker.js`: mixed declarations could lose non-function/non-object declarators because the whole declaration became covered after extracting one declarator target.

## deferred findings

- None. All three recent Codex inline comments applied to the current stream and were fixed.

## changes

- `decide-next.js` now dedupes candidate actions by `candidate.path` before ranking, and it passes the primary path into `getAlternative`.
- `retriever.js` keeps graph edge labels in `edgeSymbol` and preserves the actual hydrated chunk name in `bestChunk`.
- `chunker.js` now processes function and object declarators together through `addVariableDeclaratorChunks` and emits a fallback block for mixed scalar declarators.
- `chunker.test.js` adds a regression for mixed declarations: function targets are preserved, object handler targets are preserved, and scalar declarator content remains indexed as a block.

## docs decision

- No docs update was required. This task fixes internal decision-engine correctness for existing behavior; it does not add a command, change a manifest contract, or change user-facing script usage.

## validation

- `checkFiles` passed for `decide-next.js`, `retriever.js`, `chunker.js`, and `chunker.test.js`.
- `cd packages/workspace && bun run test tests/chunker.test.js` passed: 2 tests.
- Fabricated `decide-next` state smoke passed: primary action read `packages/workspace/tests/chunker.test.js`, alternative read `packages/workspace/scripts/lib/index/chunker.js`; the primary path was not repeated.
- `workspace audit { scripts: true }` passed: 48 documented scripts, 48 actual scripts, no drift.
- `workspace review.run { base: "origin/stream/workspace-agents", noTests: true }` passed with no findings.
- `workspace verify { base: "origin/stream/workspace-agents", noDb: true }` passed.

## notes

- The skill instruction named `workspace.pr.review`, but this workspace instance exposes `prReview`; `prReview({ pr: 392, stdout: true })` was used as the review source of truth.
- A first `batch` call used array input and failed schema validation before any read; individual `fs.read` calls were used instead.

- 2026-05-13 08:56:32 write: `.task/workpad.md`