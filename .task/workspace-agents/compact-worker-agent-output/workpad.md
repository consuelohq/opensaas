# Compact worker agent output

Task session: `tsk_4a7f9c65894c`
Branch: `task/workspace-agents/compact-worker-agent-output`
Stream: `stream/workspace-agents`
Task PR: #647

## Goal

Make `worker.call` behave like a compact tool call instead of returning the full raw provider transcript into the caller context.

## Alignment

Ko approved this after the `cdx` ping test proved the agent path works but returned a massive raw Codex event stream. The raw stream should be saved as logs/artifacts. The caller should receive compact metadata plus the final agent message.

## Acceptance criteria

- [ ] Add/adjust tests before implementation for compact worker output.
- [ ] `worker.call` persists raw stdout/stderr to run artifacts.
- [ ] `worker.call` returns compact structured data by default.
- [ ] Result includes status, provider, duration, cwd, instructionPath, command, finalMessage, summary/log paths, usage when parseable.
- [ ] Codex NDJSON parser extracts the last agent message.
- [ ] `ping` instruction should expose `finalMessage: "pong"` when the provider completes normally.
- [ ] Keep enough diagnostics for failures without dumping huge raw logs.
- [ ] Preserve backwards-compatible fields if tests or downstream code depend on them, but truncate/raw-log-path them instead of full transcript.
- [ ] Confirm `pi` provider path exists or document remaining config gap.
- [ ] Validate, review, and promote.

## Plan

1. Read worker runtime/facade tests from current main.
2. Add failing tests for compact output and Codex final-message extraction.
3. Implement log persistence and compact return shape.
4. Smoke with `cdx` ping after implementation.
5. Inspect `pi` provider support/config diagnostics.
6. Validate and ship.

- 2026-05-29 04:14:22 write: `.task/workspace-agents/compact-worker-agent-output/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-29 04:14:22 fs.write: `.task/workspace-agents/compact-worker-agent-output/workpad.md`
- 2026-05-29 04:17:14 write: `.task/worker-ping.md`
- 2026-05-29 04:17:14 fs.write: `.task/worker-ping.md`
- 2026-05-29 04:18:15 fs.trash: `.task/worker-ping.md`
- 2026-05-29 04:18:21 fs.trash: `.task/worker-runs`
- 2026-05-29 04:18:33 fs.write: `.task/workspace-agents/compact-worker-agent-output/workpad.md`

## Implementation checkpoint

Implemented compact worker output in `packages/workspace/scripts/lib/worker/runtime.ts`.

What changed:

- `worker.call` now compacts actual provider output for `cdx`, `opc`, and `pi` runs.
- Raw provider stdout/stderr are persisted under `.task/worker-runs/<trace-provider>/` inside the worker cwd.
- Result data now includes compact `stdout`, compact `stderr`, `finalMessage`, `summary`, `stdoutLogPath`, `stderrLogPath`, `rawLogPath`, raw char counts, and Codex usage fields when parseable.
- Codex NDJSON output is parsed for the last `agent_message` and `turn.completed.usage`.
- Pi/OpenCode-style stdout is parsed as JSON when possible and otherwise compacted as text.

TDD evidence:

- Added `extracts compact final messages from cdx json output and stores raw logs`.
- The test uses fake Codex NDJSON containing a huge MCP tool payload, a final agent message `pong`, and usage.
- The test asserts the caller receives compact `stdout: "pong"`/`finalMessage: "pong"`, while the raw `agent_message` stream remains in the log file.

Validation so far:

- `bun test packages/workspace/tests/facade/facade.test.ts` passed from repo root.
- Task-branch live smoke with local `cdx`:
  - provider completed
  - compact stdout length: 4
  - finalMessage: `pong`
  - raw stdout chars: 453,929
  - stdout/stderr logs persisted under `.task/worker-runs`
  - usage parsed from Codex output

Important note:

- Direct `workspace.worker.call` through the deployed MCP server still shows the old raw-output behavior until this task is merged and the workspace server is restarted. The task-branch Bun worker wrapper proves the new runtime contract.

- 2026-05-29 04:18:33 append: `.task/workspace-agents/compact-worker-agent-output/workpad.md`

## workspace-owned: validation evidence

- 2026-05-29 04:18:44 `audit`: passed — OK
- 2026-05-29 04:19:05 `review.run`: passed — OK
- 2026-05-29 04:19:37 `review.run`: passed — OK
- 2026-05-29 04:19:53 `verify`: passed — OK
