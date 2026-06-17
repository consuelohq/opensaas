# Harden consuelo reload port ownership

branch: `task/workspace/harden-consuelo-reload-port-ownership`
stream: `stream/workspace`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1104/harden-consuelo-reload-port-ownership
github pr: https://github.com/consuelohq/opensaas/pull/1104
started: 2026-06-17

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

- 2026-06-17 03:35:41 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-17 03:33:21 apply-patch: `packages/workspace/scripts/consuelo-reload.js`
- 2026-06-17 03:33:21 apply-patch: `packages/os/scripts/consuelo-reload.js`
- 2026-06-17 03:34:36 apply-patch: `packages/workspace/scripts/consuelo-reload.js`
- 2026-06-17 03:34:36 apply-patch: `packages/os/scripts/consuelo-reload.js`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace/harden-consuelo-reload-port-ownership.json`, `.task/workspace/harden-consuelo-reload-port-ownership/current.json`, `.task/workspace/harden-consuelo-reload-port-ownership/session.json`, `.task/workspace/harden-consuelo-reload-port-ownership/workpad.md`, `packages/os/scripts/consuelo-reload.js`, `packages/workspace/scripts/consuelo-reload.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
