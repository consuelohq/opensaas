# bind diff cockpit snapshot store

branch: `task/diff-cockpit/bind-diff-cockpit-snapshot-store`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1166/bind-diff-cockpit-snapshot-store
github pr: https://github.com/consuelohq/opensaas/pull/1166
started: 2026-06-20

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## Server Automatically populates this section: files changed

- none yet

## Server Automatically populates this section: activity log

- none yet

## Server Automatically populates this section: validation evidence

- 2026-06-20 22:46:32 `verify`: failed — COMMAND_FAILED
- 2026-06-20 22:46:32 `verify`: failed — COMMAND_FAILED
- 2026-06-20 22:48:17 `review.run`: passed — OK

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
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## Server Automatically populates this section: test selection

- changed files: `.task/diff-cockpit/bind-diff-cockpit-snapshot-store/current.json`, `.task/diff-cockpit/bind-diff-cockpit-snapshot-store/session.json`, `.task/diff-cockpit/bind-diff-cockpit-snapshot-store/workpad.md`, `.task/tasks/diff-cockpit/bind-diff-cockpit-snapshot-store.json`, `packages/diff-cockpit/wrangler.toml`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: no testable source files changed
