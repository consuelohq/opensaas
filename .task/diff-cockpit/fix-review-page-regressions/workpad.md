# fix review page regressions

branch: `task/diff-cockpit/fix-review-page-regressions`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/791/fix-review-page-regressions
github pr: https://github.com/consuelohq/opensaas/pull/791
started: 2026-06-05

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: activity log

- 2026-06-05 07:17:23 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:17:54 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:18:16 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:18:44 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:19:09 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:19:42 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:21:13 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:21:25 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:21:52 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-05 07:22:04 fs.patch: `packages/diff-cockpit/src/index.ts`

## workspace-owned: validation evidence

- 2026-06-05 07:31:34 `verify`: passed — OK
- 2026-06-05 07:32:15 `verify`: passed — OK
- 2026-06-05 07:34:02 `verify`: passed — OK
- 2026-06-05 07:36:00 `verify`: passed — OK

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

- `packages/diff-cockpit/package.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/fix-review-page-regressions/current.json`, `.task/diff-cockpit/fix-review-page-regressions/evidence-log.json`, `.task/diff-cockpit/fix-review-page-regressions/read-log.json`, `.task/diff-cockpit/fix-review-page-regressions/session.json`, `.task/diff-cockpit/fix-review-page-regressions/verify.json`, `.task/diff-cockpit/fix-review-page-regressions/workpad.md`, `.task/tasks/diff-cockpit/fix-review-page-regressions.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation
- Fixed review drawer toggle to close when open and renamed Review notes to Drawer.
- Tightened diff line gutters and mobile file pane layout to reduce wasted horizontal space.
- Removed the 10-commit stream cap by using paginated commit loading.
- Added mergeability button, m shortcut, and popover that shows clean or dirty-file list.
- Deployed Worker version 2ba3a8da-b3cc-40b1-80bc-bfb831b9c1e4.
- Live smoke: page markers present, API shows comments/stream commits/mergeable state/files.
