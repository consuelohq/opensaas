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
- 2026-06-05 07:44:44 `verify`: failed — COMMAND_FAILED

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

- changed files: `.task/diff-cockpit/event-driven-cache-refresh-hooks/current.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/evidence-log.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/read-log.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/session.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/verify.json`, `.task/diff-cockpit/event-driven-cache-refresh-hooks/workpad.md`, `.task/diff-cockpit/fix-review-page-regressions/evidence-log.json`, `.task/diff-cockpit/fix-review-page-regressions/read-log.json`, `.task/diff-cockpit/homepage-cache-headers/current.json`, `.task/diff-cockpit/homepage-cache-headers/evidence-log.json`, `.task/diff-cockpit/homepage-cache-headers/read-log.json`, `.task/diff-cockpit/homepage-cache-headers/session.json`, `.task/diff-cockpit/homepage-cache-headers/verify.json`, `.task/diff-cockpit/homepage-cache-headers/workpad.md`, `.task/diff-cockpit/main-packages-code-browser/current.json`, `.task/diff-cockpit/main-packages-code-browser/evidence-log.json`, `.task/diff-cockpit/main-packages-code-browser/read-log.json`, `.task/diff-cockpit/main-packages-code-browser/session.json`, `.task/diff-cockpit/main-packages-code-browser/verify.json`, `.task/diff-cockpit/main-packages-code-browser/workpad.md`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/current.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/evidence-log.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/read-log.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/session.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/verify.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/workpad.md`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/current.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/evidence-log.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/read-log.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/session.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/verify.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/workpad.md`, `.task/diff-cockpit/tighten-mobile-diff-gutters/current.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/session.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/verify.json`, `.task/diff-cockpit/tighten-mobile-diff-gutters/workpad.md`, `.task/tasks/diff-cockpit/event-driven-cache-refresh-hooks.json`, `.task/tasks/diff-cockpit/homepage-cache-headers.json`, `.task/tasks/diff-cockpit/main-packages-code-browser.json`, `.task/tasks/diff-cockpit/polish-main-code-browser-search-and-cache.json`, `.task/tasks/diff-cockpit/polish-mobile-review-and-shared-cache.json`, `.task/tasks/diff-cockpit/tighten-mobile-diff-gutters.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/workspace/hooks/README.md`, `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`, `packages/workspace/scripts/diff_cockpit.ts`, `packages/workspace/scripts/task-push.js`
- matched rules: `workspace-publish-gate`
- selected suites: `workspace verification stamp tests`
- run results: `workspace verification stamp tests` passed
- failed suites: none

## final validation
- Fixed review drawer toggle to close when open and renamed Review notes to Drawer.
- Tightened diff line gutters and mobile file pane layout to reduce wasted horizontal space.
- Removed the 10-commit stream cap by using paginated commit loading.
- Added mergeability button, m shortcut, and popover that shows clean or dirty-file list.
- Deployed Worker version 2ba3a8da-b3cc-40b1-80bc-bfb831b9c1e4.
- Live smoke: page markers present, API shows comments/stream commits/mergeable state/files.

- Final redeploy after GraphQL try/catch review fix: Cloudflare Worker 8eb8ec65-972f-484d-8666-0948e960b300.
- Final live smoke passed drawer label, mergeability popover, mobile file drawer, tightened gutters, drawer close toggle, file-pane close, and m shortcut markers.
