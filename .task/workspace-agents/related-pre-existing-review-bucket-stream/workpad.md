# Related pre-existing review bucket

## Scope
Ko narrowed this to one implementation file: `packages/workspace/scripts/review.js`.

## Behavior contract
- Keep `YOUR CHANGES` for findings on changed lines.
- Add `RELATED PRE-EXISTING` for findings outside changed lines but inside the same touched package/area.
- Keep `PRE-EXISTING` for unrelated findings elsewhere.
- Summary JSON exposes `relatedPreExistingIssues`, `relatedPreExisting`, and `relatedPreExistingDigest`.
- Related pre-existing findings are blocking because agents must fix them when mechanical or escalate to Ko when judgment is required.
- Unrelated pre-existing findings remain visible background and do not create the blocking count.
- Human output and summary JSON include the prompt: fix mechanical issues; escalate judgment calls.

## Validation plan
- Dynamic script-level behavior validation for classification and summary JSON.
- Syntax validation for `packages/workspace/scripts/review.js`.
- Nearby regression test: `bun --cwd packages/workspace test tests/review-run-state.test.js`.
- Workspace review gate against `origin/stream/workspace-agents`.


## Validation results
- Dynamic script-level validation: passed. `classifyFindings` split 1 your-change, 2 related pre-existing, and 2 background pre-existing findings. Summary JSON reported `relatedPreExistingIssues` and included the fix/escalate prompt.
- Syntax: `node --check packages/workspace/scripts/review.js` passed.
- Nearby regression: `bun --cwd packages/workspace test tests/review-run-state.test.js` passed, 6 tests.
- Focused review fallback: `bun run review -- --base origin/stream/workspace-agents --summary-json --quiet --no-tests` passed with 0 blocking issues.

## Tooling friction
- Typed `review.run` and `verify` calls were blocked by the platform wrapper before reaching the workspace tool.
- I used the underlying task-scoped review command as the scoped fallback.

## Out of scope
- A separate `tests/tool-manifest.test.ts` failure exists around the `intent` core tool manifest. That is not part of this one-file review.js change.
- The initial task branch was accidentally based on `main`; this corrected task branch is based on `stream/workspace-agents`.
