# mobile inbox backlog

branch: `task/diff-cockpit/mobile-inbox-backlog`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/906/mobile-inbox-backlog
github pr: https://github.com/consuelohq/opensaas/pull/906
started: 2026-06-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-10 01:47:46 `verify`: passed — OK
- 2026-06-10 01:58:41 `verify`: passed — OK

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

- changed files: `.task/diff-cockpit/mobile-inbox-backlog/current.json`, `.task/diff-cockpit/mobile-inbox-backlog/session.json`, `.task/diff-cockpit/mobile-inbox-backlog/verify.json`, `.task/diff-cockpit/mobile-inbox-backlog/workpad.md`, `.task/tasks/diff-cockpit/mobile-inbox-backlog.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
