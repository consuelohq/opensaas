# cap inbox requests

branch: `task/diff-cockpit/cap-inbox-requests`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/740/cap-inbox-requests
github pr: https://github.com/consuelohq/opensaas/pull/740
started: 2026-06-03

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

- 2026-06-03 09:00:53 `verify`: passed — OK

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

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/cap-inbox-requests/current.json`, `.task/diff-cockpit/cap-inbox-requests/session.json`, `.task/diff-cockpit/cap-inbox-requests/workpad.md`, `.task/tasks/diff-cockpit/cap-inbox-requests.json`, `packages/diff-cockpit/src/index.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
