# fix top level task session propagation

branch: `task/workspace-agents/fix-top-level-task-session-propagation`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/462/fix-top-level-task-session-propagation
github pr: https://github.com/consuelohq/opensaas/pull/462
started: 2026-05-22

## acceptance criteria

- [ ] Top-level workspace.call taskSession is merged into facade input for all tools.
- [ ] Conflicting top-level and input-level taskSession values return validation error.
- [ ] task.start still creates scoped current/session/workpad metadata with prefilled workpad sections.
- [ ] Task-scoped fs/status/task.exec/code.run calls work using top-level taskSession.
- [ ] Workpad file-change tracking continues to update the scoped workpad.

## plan

1. Inspect call handler and facade taskSession resolution.
2. Patch call handler to normalize top-level taskSession into input.
3. Add regression tests for taskSession propagation and scoped workpad behavior.
4. Run focused workspace tests, audit, and verify.

## files changed

- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## key decisions

- Normalize taskSession in the MCP server layer: top-level taskSession is canonical, input.taskSession is accepted if matching, conflicts return VALIDATION_ERROR.
- Keep scoped task metadata/workpad as the source of truth; no task.pin or root .task/current.json fallback.
- Server now scans scoped `.task/<area>/<slug>/session.json` before legacy root session files.

## notes for ko

- none yet

## improvements noticed

- Need to preserve scoped task metadata/workpad behavior; no task.pin or root pointer fallback.

## errors i ran into

- Full verify with review phase timed out and left stale `verify.js` processes; killed stale processes and used focused tests plus non-review verify.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```
