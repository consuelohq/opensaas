# polish trace watch layout and timestamps

branch: `task/workspace-agents/polish-trace-watch-layout-and-timestamps`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1207/polish-trace-watch-layout-and-timestamps
github pr: https://github.com/consuelohq/opensaas/pull/1207
started: 2026-06-24

## acceptance criteria

- [x] Trace table shows local full timestamps instead of a hard-coded timezone.
- [x] Trace rows keep a clear two-space gap between timestamp and status/tool.
- [x] Trace home gives the top table/sidebar more vertical room.
- [x] Trace home prioritizes branch visibility in the main row.
- [x] Trace home table header starts the tool column at the status-icon position.
- [x] Focused trace-home and trace-watch tests cover the layout and timestamp behavior.

## plan

1. Inspected `scripts/operator/trace-watch.ts`, `packages/workspace/scripts/trace-home/*`, and the focused test files.
2. Added failing tests for local full timestamps, status/tool spacing, branch visibility, and header alignment.
3. Updated timestamp formatting and trace-home layout.
4. Ran focused tests for trace-home and trace-watch.

## current status

- Implementation complete; focused tests pass.

## files changed

- `packages/workspace/scripts/trace-home/model.ts`
- `packages/workspace/scripts/trace-home/text-renderer.ts`
- `packages/workspace/tests/trace-home.test.ts`
- `packages/workspace/tests/trace-watch.test.ts`
- `scripts/operator/trace-watch.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- Added TDD coverage for the requested timestamp/layout behavior.

## workspace-owned: validation evidence

- `bun --cwd packages/workspace test tests/trace-home.test.ts tests/trace-watch.test.ts` passed: 2 files, 23 tests.
- 2026-06-24 03:44:19 `review.run`: passed — OK
- 2026-06-24 03:45:54 `verify`: passed — OK
- 2026-06-24 03:48:06 `verify`: passed — OK

## key decisions

- Use local timezone by omitting the `timeZone` override from `Intl.DateTimeFormat`; preserve deterministic display with `YYYY-MM-DD HH:mm:ss`.
- Prioritize branch visibility in the main trace row; detailed command/message content remains available in inspect/json panes.

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

- changed files: `.task/tasks/workspace-agents/polish-trace-watch-layout-and-timestamps.json`, `.task/workspace-agents/polish-trace-watch-layout-and-timestamps/current.json`, `.task/workspace-agents/polish-trace-watch-layout-and-timestamps/session.json`, `.task/workspace-agents/polish-trace-watch-layout-and-timestamps/workpad.md`, `packages/workspace/scripts/trace-home/model.ts`, `packages/workspace/scripts/trace-home/text-renderer.ts`, `packages/workspace/tests/trace-home.test.ts`, `packages/workspace/tests/trace-watch.test.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `trace-watch`
- selected suites: `trace watch build`
- run results: `trace watch build` passed
- failed suites: none
