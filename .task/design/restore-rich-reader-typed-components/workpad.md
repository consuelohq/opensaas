# restore rich reader typed components

branch: `task/design/restore-rich-reader-typed-components`
stream: `stream/design`
pr: https://github.com/consuelohq/opensaas/pull/820
started: 2026-06-06

## intent

Ko pointed at PR #666 as the source of the useful component vocabulary, while explicitly warning not to blindly copy its design work. The task is to restore the useful typed contract into the newer reader-shell framework, not to import old visual choices wholesale.

## acceptance criteria

- [x] Inspect PR #666 and compare it against the current reader renderer.
- [x] Keep the newer `spec` / `plan` / `guide` reader-shell framework.
- [x] Keep `roadmap` as plan content, not a template.
- [x] Add first-class top-level typed component names: `callout`, `metrics`, `flow`, `table`, `timeline`, `details`, `ranges`, `comparisons`, `cards`, `ledger`.
- [x] Preserve compatibility aliases added in #817: `decisionCards`, `requirementsMatrix`, `architectureFlow`, `riskPanels`, `metricCards`, `taskLedger`, `openQuestions`.
- [x] Reuse the existing renderer helper functions and shell styling. Do not add duplicate shell code.
- [x] Tests assert all direct component markers and reader validation.
- [x] Template docs steer future agents toward direct typed components.

## implementation

- Extended `ReaderComponent` in `packages/consuelo-design/scripts/render-consuelo-reader.ts` with direct PR #666 component names.
- Routed direct component names through existing renderer helpers: `renderCallout`, `renderMetrics`, `renderFlow`, `renderTable`, `renderTimeline`, `renderDetails`, `renderRanges`, `renderComparisons`, `renderCards`, and `renderLedgerGroups`.
- Kept compatibility aliases for the newer high-level names.
- Added a regression test for all direct component names.
- Updated `guide.md`, `reader-shell.md`, `spec.md`, and `plan.md` guidance.
- Fixed stale plan/spec documentation that still suggested roadmap/spec mode instead of `template: plan`.

## validation

- `node --check packages/consuelo-design/scripts/render-consuelo-reader.ts` passed, trace `trc_5199851392da`.
- `bun run test:reader` passed: 9 tests, 67 expects, trace `trc_62dcd0feb032`.
- `bun run wiki:render -- --template spec --input ../../.task/design/restore-rich-reader-typed-components/direct-components-smoke.json --out ../../.task/design/restore-rich-reader-typed-components/direct-components-smoke/index.html` passed, trace `trc_3b1d4a5071b4`.
- `bun run wiki:validate -- --input ../../.task/design/restore-rich-reader-typed-components/direct-components-smoke/index.html` passed with `missing: []`, trace `trc_8677ec2a1cb8`.
- `bun packages/workspace/scripts/consuelo-design.ts check --json` passed, trace `trc_abad782bf634`.

## notes

- I found that the current renderer had preserved most PR #666 section-level renderers and styling. The missing piece was that the new top-level `components` framework exposed different alias names instead of the direct vocabulary Ko wanted.
- A patch attempt briefly duplicated `renderLedgerGroups`; I re-read the file, removed the duplicate, and confirmed syntax with `node --check`.

- 2026-06-06 17:38:18 write: `.task/design/restore-rich-reader-typed-components/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-06 17:38:18 fs.write: `.task/design/restore-rich-reader-typed-components/workpad.md`

## workspace-owned: validation evidence

- 2026-06-06 17:38:51 `review.run`: passed — OK
- 2026-06-06 17:39:06 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/restore-rich-reader-typed-components/current.json`, `.task/design/restore-rich-reader-typed-components/direct-components-smoke.json`, `.task/design/restore-rich-reader-typed-components/direct-components-smoke/index.html`, `.task/design/restore-rich-reader-typed-components/evidence-log.json`, `.task/design/restore-rich-reader-typed-components/read-log.json`, `.task/design/restore-rich-reader-typed-components/session.json`, `.task/design/restore-rich-reader-typed-components/workpad.md`, `.task/tasks/design/restore-rich-reader-typed-components.json`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/guide.md`, `packages/consuelo-design/templates/digital-eguides/plan.md`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/consuelo-design/templates/digital-eguides/spec.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
