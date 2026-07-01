# inbox rows

branch: `task/diff-cockpit/inbox-rows`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/742/inbox-rows
github pr: https://github.com/consuelohq/opensaas/pull/742
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

- 2026-06-03 09:09:19 `verify`: passed — OK
- 2026-06-03 09:11:02 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/inbox-rows/current.json`, `.task/diff-cockpit/inbox-rows/evidence-log.json`, `.task/diff-cockpit/inbox-rows/read-log.json`, `.task/diff-cockpit/inbox-rows/session.json`, `.task/diff-cockpit/inbox-rows/verify.json`, `.task/diff-cockpit/inbox-rows/workpad.md`, `.task/tasks/diff-cockpit/inbox-rows.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
