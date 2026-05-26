# fix stream review comments

## scope

Fixed all 11 Codex/CodeRabbit inline comments on stream PR #589:

1. Preserve nested package/project test groups instead of collapsing everything to `packages/<name>`.
2. Do not treat all JSON changes as docs-only.
3. Do not delete a just-created review lock before its record appears.
4. Include the resolved base commit in review-run identity keys.
5. Repair malformed verify docs code fence in `SCRIPTS.md`.
6. Same review-lock race from CodeRabbit.
7. Persist failed structured review runs before process exit.
8. Same JSON docs-only issue from CodeRabbit.
9. Add per-suite timeout/failure details for selected test runs.
10. Require explicit `data.passed === true` from test-selection in verify.
11. Replace brittle test-selection inventory count assertions with structural assertions.

## implementation

- Updated `test-selection.js` grouping to preserve full package/project paths and also index tests by ancestor groups so package-level auto rules still work.
- Narrowed docs-only JSON handling to docs paths and schema JSON only.
- Added `TEST_SUITE_TIMEOUT_MS` support and timeout/signal/error fields for selected test command results.
- Added base commit SHA into durable review identity.
- Made lock handling wait for in-flight record creation and only remove missing-record locks after the stale threshold.
- Added failed structured review persistence in `review.js` catch path.
- Tightened `verify` to accept only explicit `passed: true` from test-selection.
- Regenerated `packages/workspace/test-selection.registry.json` from the updated grouping logic.
- Added regression tests for nested mapping behavior via generated registry shape, docs-only JSON narrowing, suite timeout failure, base-ref identity changes, and missing-record lock handling.

## validation

- `node --check` passed for:
  - `packages/workspace/scripts/test-selection.js`
  - `packages/workspace/scripts/lib/review-run-state.js`
  - `packages/workspace/scripts/review.js`
  - `packages/workspace/scripts/verify.js`
  - `packages/workspace/tests/test-selection.test.js`
  - `packages/workspace/tests/review-run-state.test.js`
- `bun x vitest run packages/workspace/tests/test-selection.test.js packages/workspace/tests/review-run-state.test.js` passed: 12 tests.
- `node packages/workspace/scripts/test-selection.js generate --out packages/workspace/test-selection.registry.json --json` passed and regenerated the registry.
- `workspace audit --scripts` passed.
- `workspace review.run --base origin/stream/workspace-agents --noTests` passed with 0 blocking issues.
- `workspace verify --base origin/stream/workspace-agents` passed full mode and wrote a publish-valid stamp.

- 2026-05-26 18:54:08 write: `.task/workspace-agents/fix-stream-review-comments/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-26 18:54:08 fs.write: `.task/workspace-agents/fix-stream-review-comments/workpad.md`
