# audit reader updates wired into os

branch: `task/os/audit-reader-updates-wired-into-os`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/947

## objective

Verify the reader updates are present in the canonical reader source and prove OS Sites render uses the same reader output.

## audit findings

- Before this task, the task-copy reader behavior existed only in the hand-edited recovered artifact HTML.
- Current stream source had no `task-copy-button`, `data-copy-markdown`, or task-copy client handler in `packages/os` or `packages/consuelo-design`.
- `packages/consuelo-design/scripts/render-consuelo-reader.ts` is the canonical typed reader shell.
- `packages/os/scripts/os.ts` shells out to `bun run wiki:render` from the repo root for `sites render` and for reader-backed `sites patch`; therefore OS Sites uses the canonical renderer output.

## implementation

- Added Markdown payload generation for every reader ledger group.
- Added canonical task-copy buttons in `renderLedgerGroups`.
- Added copy-button styling and copied/error feedback states.
- Added browser-side `copyTaskMarkdown` handler with Clipboard API support and textarea fallback.
- Extended reader tests to assert copy button markup, markdown payload, and copy handler source.
- Extended OS Sites CLI test to assert `sites render` output contains task-copy markup and markdown payload.

## validation

- `bun --cwd packages/consuelo-design test:reader` passed: 17 tests.
- `bun --cwd packages/os test tests/sites-cli.test.ts` passed: 6 tests.
- `bun run --cwd packages/os typecheck` passed: workspace script syntax checks passed.
- `review.run` passed with 0 blocking issues.

## answer to Ko

A. The source reader and recovered reader are now aligned for the task-copy behavior; it is no longer only a hand-edited HTML feature.

B. OS is wired correctly because `sites render` and reader-backed `sites patch` call the canonical `wiki:render` command. The OS test now proves rendered guide pages include `task-copy-button` and the ledger markdown payload.

- 2026-06-11 03:50:04 write: `.task/os/audit-reader-updates-wired-into-os/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-11 03:50:04 fs.write: `.task/os/audit-reader-updates-wired-into-os/workpad.md`

## workspace-owned: validation evidence

- 2026-06-11 03:50:24 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/audit-reader-updates-wired-into-os/current.json`, `.task/os/audit-reader-updates-wired-into-os/evidence-log.json`, `.task/os/audit-reader-updates-wired-into-os/read-log.json`, `.task/os/audit-reader-updates-wired-into-os/session.json`, `.task/os/audit-reader-updates-wired-into-os/workpad.md`, `.task/tasks/os/audit-reader-updates-wired-into-os.json`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/os/tests/sites-cli.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
