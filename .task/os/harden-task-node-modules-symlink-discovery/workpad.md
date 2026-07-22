# harden task node modules symlink discovery

branch: `task/os/harden-task-node-modules-symlink-discovery`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1029/harden-task-node-modules-symlink-discovery
github pr: https://github.com/consuelohq/opensaas/pull/1029
started: 2026-06-14

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/tests/task-node-modules.test.js`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/tests/task-node-modules.test.js`

## workspace-owned: activity log

- 2026-06-14 01:06:44 fs.write: `packages/workspace/scripts/lib/task-node-modules.js`
- 2026-06-14 01:07:58 fs.patch: `packages/workspace/tests/task-node-modules.test.js`
- 2026-06-14 01:09:09 fs.patch: `packages/workspace/tests/task-node-modules.test.js`
- 2026-06-14 01:09:59 fs.write: `packages/workspace/tests/task-node-modules.test.js`

## workspace-owned: validation evidence

- 2026-06-14 01:11:16 `review.run`: passed — OK
- 2026-06-14 01:11:39 `verify`: passed — OK

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

- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/tests/task-node-modules.test.js`

- 2026-06-14 01:09:09 patch lines 61-61: `packages/workspace/tests/task-node-modules.test.js`

- 2026-06-14 01:09:59 append: `packages/workspace/tests/task-node-modules.test.js`

## workspace-owned: test selection

- changed files: `.task/os/harden-task-node-modules-symlink-discovery/current.json`, `.task/os/harden-task-node-modules-symlink-discovery/evidence-log.json`, `.task/os/harden-task-node-modules-symlink-discovery/read-log.json`, `.task/os/harden-task-node-modules-symlink-discovery/session.json`, `.task/os/harden-task-node-modules-symlink-discovery/workpad.md`, `.task/tasks/os/harden-task-node-modules-symlink-discovery.json`, `packages/workspace/scripts/lib/task-node-modules.js`, `packages/workspace/tests/task-node-modules.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
