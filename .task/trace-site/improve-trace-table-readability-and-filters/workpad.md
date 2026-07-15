
## Test-first contract

1. code.call renders as language.mode and removes its redundant language/mode prefix from Input.
2. The high-frequency tool set has concise semantic labels and tool-specific summaries.
3. Failed rows expose an actionable error and mark both Input and Output as error text.
4. Live batch children inherit ordered tool/input data from the batch steps.
5. Tool and branch facets are counted, semantic, and support multi-select matching.
6. Filter-panel, font, hover, and row behavior will be proven in the existing browser integration.

### Focused red proof

- Command: bun run --cwd packages/workspace test -- tests/trace-site-inspector.test.ts -t semantic table formatting
- Expected failure: table-formatters module is missing.
- Trace: trc_5823258e3ba1.

- 2026-07-15 00:05:11 write: `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`

## files changed

- `packages/workspace/scripts/trace-site-inspector/browser.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/scripts/trace-site-inspector/model.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/tests/trace-site-inspector.test.ts`
- `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`


## workspace-owned: files changed

- `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`

## workspace-owned: activity log

- 2026-07-15 00:05:11 fs.write: `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`

- 2026-07-15 00:10:25 apply-patch: `packages/workspace/scripts/trace-site-inspector/model.ts`
- 2026-07-15 00:38:52 apply-patch: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- 2026-07-15 00:39:44 apply-patch: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- 2026-07-15 00:41:03 apply-patch: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- 2026-07-15 00:42:13 apply-patch: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- 2026-07-15 00:43:33 apply-patch: `packages/workspace/scripts/trace-site-inspector/inspector.css`
- 2026-07-15 00:44:11 apply-patch: `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`
- 2026-07-15 00:47:26 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 00:48:53 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 00:50:04 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 00:51:17 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 00:52:19 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 01:21:15 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 01:23:11 apply-patch: `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`
- 2026-07-15 01:33:14 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 01:34:26 apply-patch: `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`
- 2026-07-15 02:02:58 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:05:31 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:08:39 apply-patch: `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- 2026-07-15 02:08:39 apply-patch: `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`
- 2026-07-15 02:08:39 apply-patch: `packages/workspace/scripts/trace-site-inspector/browser.ts`
- 2026-07-15 02:08:39 apply-patch: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- 2026-07-15 02:08:39 apply-patch: `packages/workspace/scripts/trace-site-inspector/inspector.css`
- 2026-07-15 02:10:20 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:17:54 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:19:05 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:23:53 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:25:37 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:27:18 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:29:37 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:32:50 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:36:31 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:38:33 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:49:01 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 02:52:01 apply-patch: `packages/workspace/scripts/trace-site-inspector/browser.ts`
- 2026-07-15 02:54:48 apply-patch: `packages/workspace/scripts/trace-site-inspector/inspector.css`
- 2026-07-15 02:57:15 apply-patch: `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- 2026-07-15 02:57:15 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 03:08:57 apply-patch: `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- 2026-07-15 03:08:58 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 03:34:19 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 03:38:14 apply-patch: `packages/workspace/scripts/trace-site-inspector/browser.ts`
- 2026-07-15 03:41:08 apply-patch: `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- 2026-07-15 03:41:08 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 03:53:56 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 03:55:16 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 03:56:39 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 04:02:49 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`
- 2026-07-15 04:04:03 apply-patch: `packages/workspace/scripts/trace-site-inspector/browser.ts`
- 2026-07-15 04:06:35 apply-patch: `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- 2026-07-15 04:06:35 apply-patch: `packages/workspace/tests/trace-site-inspector.test.ts`

## Final local proof

- Deployed cache-busted inspector assets as `trace-inspector-v36` to the local trace archive.
- Fresh-session startup clears stale trace hashes and keeps the inspector closed by default.
- Retired `body > .screen`, `.trxToolbar`, pagination, and legacy resizer behavior are absent from the live DOM.
- A real pointer drag resized the inspector while preserving the trace-table floor; a pointer click on the divider closed it and restored a one-column table.
- Full focused suite: `34 passed` in `packages/workspace/tests/trace-site-inspector.test.ts` (trace `trc_34a1010faa12`).
- `git diff --check` passed (trace `trc_92785d1c7c66`).

- 2026-07-15 04:24:40 apply-patch: `.task/trace-site/improve-trace-table-readability-and-filters/workpad.md`

## workspace-owned: validation evidence

- 2026-07-15 04:25:32 `review.run`: passed — OK
- 2026-07-15 04:26:40 `verify`: passed — OK
- 2026-07-15 04:54:49 `review.run`: passed — OK
- 2026-07-15 04:56:18 `verify`: passed — OK
- 2026-07-15 05:02:47 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/trace-site/improve-trace-table-readability-and-filters.json`, `.task/trace-site/improve-trace-table-readability-and-filters/current.json`, `.task/trace-site/improve-trace-table-readability-and-filters/session.json`, `.task/trace-site/improve-trace-table-readability-and-filters/verify.json`, `.task/trace-site/improve-trace-table-readability-and-filters/workpad.md`, `packages/workspace/scripts/trace-site-inspector/browser.ts`, `packages/workspace/scripts/trace-site-inspector/deploy.ts`, `packages/workspace/scripts/trace-site-inspector/inspector.css`, `packages/workspace/scripts/trace-site-inspector/model.ts`, `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`, `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`, `packages/workspace/tests/trace-site-inspector.test.ts`
- matched rules: `trace-site-pagination`
- selected suites: `trace gateway history endpoints`, `trace gateway DB resolution`, `trace site inspector pagination`
- run results: `trace gateway history endpoints` passed, `trace gateway DB resolution` passed, `trace site inspector pagination` passed
- failed suites: none
