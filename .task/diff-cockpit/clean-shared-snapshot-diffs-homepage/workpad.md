# clean shared snapshot diffs homepage

branch: `task/diff-cockpit/clean-shared-snapshot-diffs-homepage`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1163/clean-shared-snapshot-diffs-homepage
github pr: https://github.com/consuelohq/opensaas/pull/1163
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

- 2026-06-20 22:10:19 `verify`: passed — OK

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

- changed files: `.task/diff-cockpit/clean-shared-snapshot-diffs-homepage/current.json`, `.task/diff-cockpit/clean-shared-snapshot-diffs-homepage/session.json`, `.task/diff-cockpit/clean-shared-snapshot-diffs-homepage/workpad.md`, `.task/tasks/diff-cockpit/clean-shared-snapshot-diffs-homepage.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
