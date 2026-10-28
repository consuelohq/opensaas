# promote os pr review collector to github reviews

branch: `task/os/promote-os-pr-review-collector-to-github-reviews`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1357

## acceptance criteria

- [ ] `packages/os/scripts/github.js pr.reviews --pr <n> --json` returns normalized actionable PR review feedback, not only raw review summaries.
- [ ] The OS collector fetches inline review comments, PR conversation comments, review summaries, per-review-round comments, paginates safely, dedupes updated comments, classifies CodeRabbit/Qodo/Codex/OpenAI/ChatGPT authors, and suppresses non-actionable bot rate-limit noise.
- [ ] OS tool search and manifests prefer `github` with operation `pr.reviews` for PR review feedback/comment requests.
- [ ] Do not add an OS `prReview` legacy wrapper unless one already exists. OS currently has no `prReview` tool.
- [ ] Validate with focused tests, OS search/manifest tests, review, and verify before promotion.

## Test-first contract

- Behavior under test: OS `github pr.reviews` uses the normalized collector and hits all required review feedback endpoints, including per-review comments for each review round.
- Existing pattern to follow: `packages/os/tests/github.test.ts` runs `scripts/github.js` via `spawnSync`; `packages/os/tests/tools-search-v2.test.ts` imports `runToolSearch` directly.
- New tests: add `packages/os/tests/github-pr-reviews.test.ts` with a fake `gh` executable, and add collector unit tests for pagination, bot classification, dedupe/latest body, and bot noise filtering.
- Focused red command: `cd packages/os && bun run test -- tests/github-pr-reviews.test.ts`.
- Expected red failure: current OS `github pr.reviews` only calls `repos/<repo>/pulls/<pr>/reviews`, so the fake-gh call log will not include `pulls/<pr>/comments`, `issues/<pr>/comments`, or `pulls/<pr>/reviews/<id>/comments`, and the normalized latest inline comment will be absent.
- No-test waiver: not applicable; this changes agent-facing tool behavior.

## notes

- This clones the workspace-agents behavior into the OS package without adding a new OS `prReview` alias.

## workspace-owned: validation evidence

- 2026-07-03 11:39:00 `review.run`: passed — OK
- 2026-07-03 11:39:14 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/promote-os-pr-review-collector-to-github-reviews/current.json`, `.task/os/promote-os-pr-review-collector-to-github-reviews/session.json`, `.task/os/promote-os-pr-review-collector-to-github-reviews/workpad.md`, `.task/tasks/os/promote-os-pr-review-collector-to-github-reviews.json`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/github.js`, `packages/os/scripts/lib/pr-review-collector.js`, `packages/os/scripts/pr-review.js`, `packages/os/scripts/tools-search.ts`, `packages/os/tests/github-pr-reviews.test.ts`, `packages/os/tests/pr-review-collector.test.js`, `packages/os/tests/pr-review.test.js`, `packages/os/tests/tools-search-v2.test.ts`, `packages/os/tooling/dev-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## implementation notes

- Added `packages/os/scripts/lib/pr-review-collector.js`.
- Updated `packages/os/scripts/github.js` so `pr.reviews` calls the collector and returns bounded packets.
- Updated `packages/os/scripts/pr-review.js` as a temporary legacy wrapper over the same collector.
- Updated OS tool search so PR review comment wording recommends `github`, not task PR publishing.
- Updated OS dev tool manifest metadata for `github` and legacy `prReview`.
- Regenerated OS tool manifests and `TOOLS.md`.

## validation evidence

- RED: focused OS `github-pr-reviews` test failed before implementation because old `pr.reviews` did not fetch inline/per-review comments.
- GREEN: collector and GitHub PR reviews tests passed, 2 files / 5 tests.
- GREEN: focused OS suite passed, 6 files / 29 tests.
- GREEN: live smoke against PR 1337 returned 3 inline comments, 3 issue comments, 1 review, with expected CodeRabbit file grouping.
- GREEN: OS search smoke recommends `github`; `prReview` appears as legacy.
- GREEN: OS typecheck passed.
- GREEN: `review.run` against `origin/stream/os` passed with 0 issues.
- GREEN: `verify` against `origin/stream/os` passed and wrote publish-valid stamp.

## notes for ko

- OS already had `prReview` in the dev tool manifest; this task keeps it temporarily as a legacy wrapper.
- Verify selected zero suites from registry, so the focused manual suite is the behavior proof.
