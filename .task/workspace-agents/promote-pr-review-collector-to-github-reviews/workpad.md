# Promote PR review collector to GitHub reviews

## Acceptance criteria

- `workspace.github({ operation: "pr.reviews", pr })` is the primary agent-facing path for actionable PR review feedback.
- `github pr.reviews` uses the richer collector behavior: review summaries, inline comments, PR conversation comments, per-review-round comments, pagination, dedupe/latest body selection, bot classification, noise suppression, and file grouping.
- Agents only need to pass `pr` for normal Consuelo workspace usage.
- `prReview` remains temporarily available only as a legacy wrapper or clearly marked legacy path.
- Tool search/metadata directs agents to `github`/`pr.reviews` for CodeRabbit, Codex/OpenAI/ChatGPT, Qodo, and human PR feedback.

## Test-first contract

Behavior under test:
- Running `packages/workspace/scripts/github.js pr.reviews --pr <N> --json` calls the normalized review collector, not the raw GitHub review-summary endpoint only.
- The operation fetches per-review-round comments, keeps the newest duplicate comment body, suppresses non-actionable bot rate-limit noise, and returns compact file-grouped actionable review feedback.
- Tool search metadata points PR review comment requests to `github`, while `prReview` is clearly legacy.

Existing local pattern to follow:
- `packages/workspace/tests/github.test.ts` uses `spawnSync` against `scripts/github.js` for CLI contract tests.
- `packages/workspace/tests/tools-search-v2.test.ts` validates search routing from generated manifest/docs.

New or changed tests:
- Add `packages/workspace/tests/github-pr-reviews.test.ts` with a fake `gh` binary to prove `github pr.reviews` uses all relevant review-comment endpoints.
- Port/keep focused collector unit tests for pagination flattening, author classification, dedupe/latest body, and bot-noise suppression.
- Add a tools-search assertion that PR review comment wording recommends `github`.

Focused red command:
- `cd packages/workspace && bun run test -- tests/github-pr-reviews.test.ts`

Expected red failure before implementation:
- The fake `gh` log will show only `pulls/<pr>/reviews`, missing `pulls/<pr>/reviews/<review_id>/comments`, and the returned packet will not include latest inline review feedback.

## Notes

- `origin/stream/security` has the richer collector from the earlier PR-comment fix. This task ports that behavior into the workspace GitHub facade rather than duplicating a second public tool.

## Implementation notes

- Added `packages/workspace/scripts/lib/pr-review-collector.js` as the shared collector implementation.
- Replaced `packages/workspace/scripts/pr-review.js` with a thin legacy CLI wrapper over the shared collector.
- Updated `packages/workspace/scripts/github.js` so operation `pr.reviews` calls the collector and returns compact bounded GitHub packets.
- Updated tool manifest descriptions so `github` is the preferred tool for PR review feedback and `prReview` is marked as legacy.
- Updated `tools-search.ts` with a PR feedback intent so review-comment wording routes to `github`, not task PR publishing.

## Validation so far

- Red test confirmed old `github pr.reviews` only hit the raw review summary endpoint and missed per-review comments.
- Green: `cd packages/workspace && bun run test -- tests/pr-review.test.js tests/github-pr-reviews.test.ts`.
- Green: `cd packages/workspace && bun run test -- tests/tools-search-v2.test.ts`.
- Green focused suite: `cd packages/workspace && bun run test -- tests/pr-review.test.js tests/github-pr-reviews.test.ts tests/github.test.ts tests/tools-search-v2.test.ts tests/tool-manifest.test.ts` (5 files, 26 tests).
- Green live smoke: `bun ./scripts/github.js pr.reviews --pr 1337 --json` returned 3 inline comments, 4 issue comments, 1 review, with the expected CodeRabbit file grouping.
- Green task-local search smoke: `CodeRabbit Codex PR review comments` recommends `github`; `prReview` appears only as a legacy wrapper.

## workspace-owned: validation evidence

- 2026-07-03 09:40:28 `review.run`: passed — OK
- 2026-07-03 09:40:40 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/promote-pr-review-collector-to-github-reviews.json`, `.task/workspace-agents/promote-pr-review-collector-to-github-reviews/current.json`, `.task/workspace-agents/promote-pr-review-collector-to-github-reviews/session.json`, `.task/workspace-agents/promote-pr-review-collector-to-github-reviews/workpad.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/scripts/github.js`, `packages/workspace/scripts/lib/pr-review-collector.js`, `packages/workspace/scripts/pr-review.js`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/tests/github-pr-reviews.test.ts`, `packages/workspace/tests/pr-review.test.js`, `packages/workspace/tests/tools-search-v2.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## Final validation

- Green review gate: `review.run` with base `origin/stream/workspace-agents` passed static rules, eslint, typecheck, and spec compliance with 0 issues.
- Green verify gate: `verify` with base `origin/stream/workspace-agents` passed and wrote a publish-valid stamp.
- Verify-selected suites passed:
  - workspace facade input contracts
  - workspace audit tests

## Publish notes

- Primary agent-facing path is now `workspace.github({ operation: "pr.reviews", pr })`.
- `prReview` remains callable as a legacy CLI/tool wrapper, but its manifest description points agents to the GitHub facade.
- Full removal of `prReview` should wait until downstream dependencies are checked.
