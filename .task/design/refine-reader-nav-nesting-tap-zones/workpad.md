# refine reader nav nesting tap zones

branch: `task/design/refine-reader-nav-nesting-tap-zones`
stream: `stream/design`
pr: https://github.com/consuelohq/opensaas/pull/835
started: 2026-06-07

## objective

Follow-up on Ko's roadmap parity review:

- Give the title maximum space in the top pill nav by pushing non-title nav links toward the Task button.
- Keep Task pinned right.
- Remove weird double/triple nesting for table-only, flow-only, card-only, callout-only, and typed component sections.
- Add roadmap-style click/tap zones: click right side to scroll down, click left side to scroll up.

## TDD contract

Add failing renderer tests before implementation for:

- nav CSS uses `grid-template-columns:minmax(0,1fr) auto auto` and `.reader-links { justify-content:flex-end; justify-self:end; }`.
- rendered shell includes left/right `data-tap-scroll` controls and JS `pageStep` using `innerHeight`.
- section-only table/flow/callout/cards and typed table/flow components render with `section-content flat-content`.
- old `grid-template-columns:minmax(120px,auto) minmax(0,1fr) auto` is absent.

## validation evidence

Completed; see the validation update and workspace-owned validation evidence below.

- 2026-06-07 15:54:26 write: `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`

## agent update — implementation and validation

What changed: updated the canonical reader shell to allocate nav space with a flexible title column, show the short `How To Speak` title, keep section links next to the pinned `Task` button, flatten no-body module stacks, flatten typed components, and add left/right tap zones for incremental scroll.

Why it changed: Ko's roadmap comparison showed three remaining template problems: the title was still clipped, vocabulary/mechanism sections still had extra framed nesting, and roadmap-style side tap scrolling was missing.

Validation run: red tests covered nav allocation, short nav title, tap zones, single-module flattening, typed-component flattening, and mixed-module flattening. Green `bun run test:reader` passed with 17 tests and 109 assertions. Renderer syntax, reader validation, mobile browser smoke, design check, review, and verify all passed. The live guide is published as version `2026-06-07T16-07-52-102Z`.

Issues or follow-ups: no blocking issues. The only review note is pre-existing: no project typecheck target is registered for this affected area.

## current status

The reader refinement is implemented and published. The canonical renderer now uses the 1.2.0 shell with right-grouped nav links, a short visible nav title, left/right tap-scroll zones, and flat no-body content stacks for the vocabulary, card, callout, and typed component sections. The How To Speak guide is live at version 2026-06-07T16-07-52-102Z. Focused TDD, renderer validation, mobile browser smoke, review, and verify all passed; no blocking follow-ups remain.

## files changed

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

## workspace-owned: files changed

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

## workspace-owned: activity log

- 2026-06-07 15:54:26 fs.write: `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`
- 2026-06-07 15:55:04 append: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 15:55:04 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 15:57:56 fs.write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-07 15:59:45 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 16:04:32 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 16:11:20 fs.write: `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`
- 2026-06-07 16:14:37 fs.write: `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-07 15:55:12 `bun run test:reader`: failed exit 1 trace: `trc_c869665f6dfe`
  - output: nimationFrame(tick); }\n tick();\n </script>\n</body>\n</html>" at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-design-refine-reader-nav-nesting-tap-zones/packages/consuelo-design/scripts/render-consuelo-reader.test.ts:345:18) (fail) reader nesting flattening refinement > flattens typed table and flow components too [0.14ms] 11 pass 4 fail 86 expect() calls Ran 15 tests across 1 file. [20.00ms] error: script "test:reader" exited with code 1 error: script "test:reader" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-07 15:59:51 `bun run test:reader`: failed exit 1 trace: `trc_e94cc3fa87c1`
  - output: k); }\n tick();\n </script>\n</body>\n</html>" at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-design-refine-reader-nav-nesting-tap-zones/packages/consuelo-design/scripts/render-consuelo-reader.test.ts:362:18) (fail) reader nav display title > uses the short artifact title in the nav while preserving the full label [0.18ms] 15 pass 1 fail 105 expect() calls Ran 16 tests across 1 file. [16.00ms] error: script "test:reader" exited with code 1 error: script "test:reader" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-07 16:04:41 `bun run test:reader`: failed exit 1 trace: `trc_0c3de646fd86`
  - output: ck); }\n tick();\n </script>\n</body>\n</html>" at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-design-refine-reader-nav-nesting-tap-zones/packages/consuelo-design/scripts/render-consuelo-reader.test.ts:384:18) (fail) reader mixed module flattening > flattens no-body sections even when they contain multiple modules [0.21ms] 16 pass 1 fail 107 expect() calls Ran 17 tests across 1 file. [17.00ms] error: script "test:reader" exited with code 1 error: script "test:reader" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-07 15:57:20 `bun run test:reader`: passed exit 0 trace: `trc_86e7e7e8263b`
  - output: e-framed nesting [0.07ms] (pass) reader nav allocation and tap-scroll refinement > gives the title maximum nav space and groups links beside task [0.07ms] (pass) reader nav allocation and tap-scroll refinement > renders roadmap-style left and right tap zones for page stepping [0.10ms] (pass) reader nesting flattening refinement > flattens single-component body sections that previously nested table and flow cards [0.15ms] (pass) reader nesting flattening refinement > flattens typed table and flow components too [0.06ms] 15 pass 0 fail 104 expect() calls Ran 15 tests across 1 file. [17.00ms]
- 2026-06-07 15:57:56 write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-07 15:59:45 append: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 16:00:22 `bun run test:reader`: passed exit 0 trace: `trc_5d01281b068a`
  - output: and groups links beside task [0.07ms] (pass) reader nav allocation and tap-scroll refinement > renders roadmap-style left and right tap zones for page stepping [0.11ms] (pass) reader nesting flattening refinement > flattens single-component body sections that previously nested table and flow cards [0.15ms] (pass) reader nesting flattening refinement > flattens typed table and flow components too [0.06ms] (pass) reader nav display title > uses the short artifact title in the nav while preserving the full label [0.04ms] 16 pass 0 fail 106 expect() calls Ran 16 tests across 1 file. [16.00ms]
- 2026-06-07 16:04:32 append: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 16:05:41 `bun run test:reader`: passed exit 0 trace: `trc_0157178d79d4`
  - output: le left and right tap zones for page stepping [0.10ms] (pass) reader nesting flattening refinement > flattens single-component body sections that previously nested table and flow cards [0.25ms] (pass) reader nesting flattening refinement > flattens typed table and flow components too [0.12ms] (pass) reader nav display title > uses the short artifact title in the nav while preserving the full label [0.06ms] (pass) reader mixed module flattening > flattens no-body sections even when they contain multiple modules [0.06ms] 17 pass 0 fail 109 expect() calls Ran 17 tests across 1 file. [17.00ms]

## workspace-owned: validation evidence

Completed through focused TDD, static checks, browser smoke, publish, review, and verify.
- 2026-06-07 15:54:26 write: `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`
- 2026-06-07 16:08:36 `checkFiles`: passed — OK
- 2026-06-07 16:09:20 `review.run`: passed — OK
- 2026-06-07 16:09:43 `verify`: passed — OK
- 2026-06-07 16:15:16 `verify`: passed — OK
- 2026-06-07 16:16:40 `verify`: passed — OK
- 2026-06-07 16:18:18 `verify`: passed — OK
- 2026-06-07 16:25:18 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/refine-reader-nav-nesting-tap-zones/current.json`, `.task/design/refine-reader-nav-nesting-tap-zones/evidence-log.json`, `.task/design/refine-reader-nav-nesting-tap-zones/read-log.json`, `.task/design/refine-reader-nav-nesting-tap-zones/session.json`, `.task/design/refine-reader-nav-nesting-tap-zones/verify.json`, `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`, `.task/tasks/design/refine-reader-nav-nesting-tap-zones.json`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## implementation update — 2026-06-07

- Updated canonical reader shell to `1.2.0`.
- Changed nav grid to `minmax(0,1fr) auto auto` so the brand/title gets the flexible left column while section links group beside the Task pill.
- Added short nav display title: `How To Speak — Communication Field Guide` renders as visible `How To Speak` while preserving the full title in `aria-label` and `title`.
- Added left/right invisible tap zones: `data-tap-scroll="up"` and `data-tap-scroll="down"` with `pageStep(direction)` using `innerHeight * 0.62`.
- Flattened no-body content stacks. Table-only, card-only, callout-only, flow-only, and mixed callout+flow sections now use `.section-content.flat-content` to remove the extra outer frame.
- Flattened typed table/flow/etc. components the same way.
- Updated `reader-shell.md` with nav allocation, flat content, and tap-zone rules for future agents.

## validation update — 2026-06-07

- Red tests:
  - nav allocation failed on old grid, trace `trc_148b5d4accaa` / red output `trc_...` from `bun run test:reader`.
  - short nav title failed before implementation, trace `trc_4994c97ddc70` / red output `trc_...`.
  - mixed module flattening failed before implementation, trace `trc_e41a08e6e51e` / red output `trc_...`.
- Syntax: `node --check packages/consuelo-design/scripts/render-consuelo-reader.ts` passed, trace `trc_82807d9fe990`.
- Green: `bun run test:reader` passed with 17 tests and 109 assertions, trace `trc_0157178d79d4`.
- Rendered How To Speak v6: `/tmp/how-to-speak-guide-v6/index.html`, readerShellVersion `1.2.0`, trace `trc_2b3780ea7130`.
- Validated v6: `missing: []`, trace `trc_11af860beb5d`.
- Mobile browser smoke passed, screenshot `/tmp/opensaas-screenshots/page-2026-06-07T16-06-54.png`, trace `trc_e11fc0358621`.
- Published v6 over `/daily-deep-idea/2026-06-07-how-to-speak` with base version `2026-06-07T16-01-24-616Z`; new version `2026-06-07T16-07-52-102Z`, trace `trc_12b00c85d8f8`.
- Archive check confirmed current version `2026-06-07T16-07-52-102Z`, sourceTarget `/tmp/how-to-speak-guide-v6`, versionCount `6`, trace `trc_f323ec084b05`.
- Static checkFiles passed for renderer and tests, trace `trc_0fc6dc4ca109`.
- Design boundary check passed, trace `trc_8ff887df8eb7`.
- Review passed against `origin/stream/design` with 0 issues from this change; pre-existing project typecheck note remains, trace `trc_c083568ddb4d`.
- Verify passed against `origin/stream/design` and wrote publish-valid stamp, trace `trc_05d43b0fb332`.

- 2026-06-07 16:11:20 append: `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`

## final publish note — 2026-06-07

After review and verify, I published the updated How To Speak artifact from `/tmp/how-to-speak-guide-v6` and confirmed the archive now points at version `2026-06-07T16-07-52-102Z`. The live artifact includes the short visible nav title, right-grouped menu links, left/right tap-scroll zones, and flattened content stacks for the vocabulary/cards/callout sections.

No follow-up blockers found. One review note remains pre-existing: the workspace has no project typecheck target registered for this affected area.

- 2026-06-07 16:14:37 append: `.task/design/refine-reader-nav-nesting-tap-zones/workpad.md`

## workspace-owned: files read

- none yet
