# Compact Pi worker JSONL output

Branch: `task/workspace-agents/compact-pi-worker-jsonl-output`
Task session: `tsk_9cfc914c929d`
PR: #648

## Goal

Fix the Pi worker compaction path after live deploy showed Pi emits JSONL events, not a single JSON object. `worker.call` should return a compact final message for Pi just like Codex.

## Acceptance criteria

- [ ] Add a failing test for Pi JSONL output with thinking/tool noise and final assistant text.
- [ ] Parse Pi JSONL assistant message events into `finalMessage`/compact `stdout`.
- [ ] Preserve raw stdout/stderr logs under `.task/worker-runs`.
- [ ] Live `worker.call provider=pi profile=mini` ping returns compact output.
- [ ] Validate, merge to stream, deploy to main, restart server.

- 2026-05-29 04:41:49 write: `.task/workspace-agents/compact-pi-worker-jsonl-output/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-29 04:41:49 fs.write: `.task/workspace-agents/compact-pi-worker-jsonl-output/workpad.md`

## workspace-owned: validation evidence

- 2026-05-29 04:43:21 `audit`: passed — OK
- 2026-05-29 04:43:46 `review.run`: passed — OK
- 2026-05-29 04:44:01 `verify`: passed — OK
