# fix stream review comments

## outcome

Fixed all 11 CodeRabbit/Codex inline review comments on stream PR #589 and pushed the fixes to task PR #608 for merge back into `stream/workspace-agents`.

## changes

- `test-selection.js` now preserves nested package/project groups instead of collapsing tests to `packages/<name>`, while still indexing ancestor groups for package-level auto rules.
- Docs-only detection no longer treats every JSON file as documentation; only docs paths and schema JSON are docs-only.
- Selected test suite execution now has a bounded timeout via `TEST_SUITE_TIMEOUT_MS`, records timeout/signal/error details, and fails timed-out suites.
- Review-run identity now includes the resolved base commit SHA so a moved base ref cannot reuse stale review output.
- Review-run lock handling now waits for a concurrently-created record and only removes missing-record locks after a stale threshold.
- Structured `review.js` failures are persisted before process exit so reruns see a terminal failed result instead of an eternal running record.
- `verify.js` now requires `test-selection` to return explicit `passed: true`.
- `SCRIPTS.md` verify section markdown fence is repaired.
- `test-selection.registry.json` was regenerated from the updated grouping logic.

## regression coverage

- Added/updated test-selection tests for structural inventory assertions, JSON docs-only narrowing, and timed-out suite failure.
- Added review-run-state tests for moved base refs, missing-record live locks, stale missing-record locks, completed replay, stale PID orphaning, and output-contract-specific identities.

## validation

- `node --check` passed for all modified scripts and focused test files.
- `bun x vitest run packages/workspace/tests/test-selection.test.js packages/workspace/tests/review-run-state.test.js` passed: 12 tests.
- `node packages/workspace/scripts/test-selection.js generate --out packages/workspace/test-selection.registry.json --json` passed and regenerated the registry.
- `workspace audit --scripts` passed.
- `workspace review.run --base origin/stream/workspace-agents --noTests` passed with 0 blocking issues.
- `workspace verify --base origin/stream/workspace-agents` passed full mode and wrote a publish-valid stamp.

## follow-ups

No unresolved bot-comment follow-ups remain.

- 2026-05-26 18:58:03 write: `.task/workspace-agents/fix-stream-review-comments/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-26 18:58:03 fs.write: `.task/workspace-agents/fix-stream-review-comments/workpad.md`

## workspace-owned: validation evidence

- 2026-05-26 18:59:04 `verify`: passed — OK
