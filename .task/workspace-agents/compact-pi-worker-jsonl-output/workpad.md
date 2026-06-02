# Compact Pi worker JSONL output

Branch: `task/workspace-agents/compact-pi-worker-jsonl-output`
Task session: `tsk_9cfc914c929d`
PR: #648

## Goal

Fix the Pi worker compaction path after live deploy showed Pi emits newline-delimited event records, not a single JSON object. The helper output should return a compact final message and keep raw logs on disk.

## Acceptance criteria

- [x] Add a failing test for helper JSONL output with thinking/tool noise and final assistant text.
- [x] Parse helper assistant message events into `finalMessage`/compact `stdout`.
- [x] Preserve raw stdout/stderr logs under `.task/worker-runs`.
- [ ] Live helper ping returns compact output after merge, deploy, and restart.
- [x] Validate before merge.

## files changed

- `packages/workspace/scripts/lib/worker/runtime.ts`
- `packages/workspace/tests/facade/facade.test.ts`

## workspace-owned: validation evidence

- 2026-05-29 04:43 `bun test packages/workspace/tests/facade/facade.test.ts` passed.
- 2026-05-29 04:43 `workspace audit --scripts` passed.
- 2026-05-29 04:43 `workspace review.run --base origin/main --no-tests` passed with 0 issues.
- 2026-05-29 04:44 `workspace verify --base origin/main --no-db` passed and wrote a publish-valid stamp.

## Summary

Fixed the live compact-output regression found after the first deploy. One local helper emits newline-delimited event records rather than a single response object. The first compaction pass handled the Codex event stream but treated this helper stream as plain text, so a large raw transcript could still reach the caller.

What changed:

- Added parser support for the helper event stream in `packages/workspace/scripts/lib/worker/runtime.ts`.
- The normalized output now extracts final assistant text from the completed assistant message event.
- Usage fields from that event are mapped into the normalized worker usage object.
- Added a helper for extracting text from string or array-shaped assistant content.
- Added facade test coverage with a fake event stream containing large internal noise plus final text `pong`.

Follow-up:

After merge to main and server restart, rerun the live helper ping. Expected result: compact final message with raw event logs persisted under `.task/worker-runs`.
