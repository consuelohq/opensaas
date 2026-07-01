# hot pr snapshot prewarm and cache policy

branch: `task/diff-cockpit/hot-pr-snapshot-prewarm-and-cache-policy`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1177/hot-pr-snapshot-prewarm-and-cache-policy
github pr: https://github.com/consuelohq/opensaas/pull/1177
started: 2026-06-23

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

- 2026-06-23 02:31:24 `review.run`: passed — OK
- 2026-06-23 02:32:07 `review.run`: passed — OK
- 2026-06-23 02:32:34 `verify`: passed — OK

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

- changed files: `.task/diff-cockpit/hot-pr-snapshot-prewarm-and-cache-policy/current.json`, `.task/diff-cockpit/hot-pr-snapshot-prewarm-and-cache-policy/session.json`, `.task/diff-cockpit/hot-pr-snapshot-prewarm-and-cache-policy/workpad.md`, `.task/tasks/diff-cockpit/hot-pr-snapshot-prewarm-and-cache-policy.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
