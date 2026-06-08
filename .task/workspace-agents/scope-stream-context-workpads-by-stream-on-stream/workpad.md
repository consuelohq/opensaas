# scope stream context workpads by stream on stream

branch: `task/workspace-agents/scope-stream-context-workpads-by-stream-on-stream`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/685/scope-stream-context-workpads-by-stream-on-stream
github pr: https://github.com/consuelohq/opensaas/pull/685
started: 2026-06-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-02 01:23:22 fs.write: `.task/workspace-agents/scope-stream-context-workpads-by-stream-on-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-06-02 01:20:44 `checkFiles`: passed — OK
- 2026-06-02 01:22:18 `review.run`: passed — OK
- 2026-06-02 01:22:39 `verify`: passed — OK
- 2026-06-02 01:23:29 `verify`: passed — OK

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

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/scope-stream-context-workpads-by-stream-on-stream.json`, `.task/workspace-agents/scope-stream-context-workpads-by-stream-on-stream/current.json`, `.task/workspace-agents/scope-stream-context-workpads-by-stream-on-stream/session.json`, `.task/workspace-agents/scope-stream-context-workpads-by-stream-on-stream/verify.json`, `.task/workspace-agents/scope-stream-context-workpads-by-stream-on-stream/workpad.md`, `packages/workspace/scripts/lib/stream-workpads.js`, `packages/workspace/scripts/stream-context.js`, `packages/workspace/tests/stream-workpads.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final update

Status: replacement task from `stream/workspace-agents` is the reviewable path because the original main-based task PR conflicted with the stream.

Files changed:
- `packages/workspace/scripts/stream-context.js`
- `packages/workspace/scripts/lib/stream-workpads.js`
- `packages/workspace/tests/stream-workpads.test.js`

Validation:
- `checkFiles` passed for all three changed files.
- Focused regression test passed: `./packages/workspace/node_modules/.bin/vitest run packages/workspace/tests/stream-workpads.test.js` with 1 file and 3 tests passing.
- Live command smoke passed: `bun packages/workspace/scripts/stream-context.js --area os --json`; output showed `area: os`, `stream: stream/os`, and OS task workpads only.
- `review.run --no-tests` passed against `origin/stream/workspace-agents` with 0 issues from this change.
- `verify` passed and wrote a publish-valid stamp.

Key decision: recent workpads now require structural branch evidence: `task/<area>/...` or exact `stream/<area>` evidence. Generic area mentions are rejected.

Issue: old task PR #684 is conflicted because it was based on `main`; this replacement task is #685.

- 2026-06-02 01:23:22 append: `.task/workspace-agents/scope-stream-context-workpads-by-stream-on-stream/workpad.md`
