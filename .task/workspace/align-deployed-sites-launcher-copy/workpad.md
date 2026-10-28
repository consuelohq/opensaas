# Align deployed Sites launcher copy

branch: `task/workspace/align-deployed-sites-launcher-copy`
stream: `stream/workspace`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1319/align-deployed-sites-launcher-copy
github pr: https://github.com/consuelohq/opensaas/pull/1319
started: 2026-07-01

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

- 2026-07-01 06:08:41 `review.run`: passed — OK
- 2026-07-01 06:08:53 `verify`: passed — OK
- 2026-07-01 06:14:10 `review.run`: passed — OK
- 2026-07-01 06:14:22 `verify`: passed — OK

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

- 2026-07-01 06:05:41 apply-patch: `packages/workspace/scripts/office.ts`
- 2026-07-01 06:05:41 apply-patch: `packages/workspace/tests/office-theme.test.js`
- 2026-07-01 06:08:04 apply-patch: `packages/workspace/tests/office-theme.test.js`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace/align-deployed-sites-launcher-copy.json`, `.task/workspace/align-deployed-sites-launcher-copy/current.json`, `.task/workspace/align-deployed-sites-launcher-copy/session.json`, `.task/workspace/align-deployed-sites-launcher-copy/verify.json`, `.task/workspace/align-deployed-sites-launcher-copy/workpad.md`, `packages/workspace/scripts/office.ts`, `packages/workspace/tests/office-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
