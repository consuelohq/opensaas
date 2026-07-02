# add workspace mcp bootstrap to agents md

branch: `task/os/add-workspace-mcp-bootstrap-to-agents-md`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1342/add-workspace-mcp-bootstrap-to-agents-md
github pr: https://github.com/consuelohq/opensaas/pull/1342
started: 2026-07-02

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

- none yet

## workspace-owned: validation evidence

- 2026-07-02 20:11:24 `review.run`: passed — OK
- 2026-07-02 20:13:56 `verify`: failed — COMMAND_FAILED
- 2026-07-02 20:14:09 `verify`: failed — COMMAND_FAILED
- 2026-07-02 20:17:07 `verify`: failed — COMMAND_FAILED
- 2026-07-02 20:19:33 `review.run`: passed — OK
- 2026-07-02 20:19:49 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `Agents.md`

## workspace-owned: test selection

- changed files: `.task/os/add-workspace-mcp-bootstrap-to-agents-md/current.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/evidence-log.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/read-log.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/session.json`, `.task/os/add-workspace-mcp-bootstrap-to-agents-md/workpad.md`, `.task/tasks/os/add-workspace-mcp-bootstrap-to-agents-md.json`, `AGENTS.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed files are docs or task metadata
