# fix mobile file sticky toggle

branch: `task/diff-cockpit/fix-mobile-file-sticky-toggle`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/866/fix-mobile-file-sticky-toggle
github pr: https://github.com/consuelohq/opensaas/pull/866
started: 2026-06-09

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

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-09 16:43:13 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:43:54 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:44:23 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:45:35 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:46:48 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:48:04 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:48:59 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:49:48 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:51:02 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:51:59 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:52:39 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:54:24 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:55:10 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:55:44 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:58:09 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 16:59:21 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 17:05:27 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: validation evidence

- 2026-06-09 17:07:08 `review.run`: passed — OK
- 2026-06-09 17:07:43 `verify`: passed — OK

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
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

- 2026-06-09 17:05:27 patch lines 600-600: `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/fix-mobile-file-sticky-toggle/current.json`, `.task/diff-cockpit/fix-mobile-file-sticky-toggle/evidence-log.json`, `.task/diff-cockpit/fix-mobile-file-sticky-toggle/read-log.json`, `.task/diff-cockpit/fix-mobile-file-sticky-toggle/session.json`, `.task/diff-cockpit/fix-mobile-file-sticky-toggle/workpad.md`, `.task/tasks/diff-cockpit/fix-mobile-file-sticky-toggle.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
