# polish reader shell mobile

branch: `task/design/polish-reader-shell-mobile`
stream: `stream/design`
pr: https://github.com/consuelohq/opensaas/pull/833
started: 2026-06-07

## objective

Bring the canonical TypeScript reader shell closer to Ko's roadmap baseline and republish the How To Speak communication guide through the updated shell.

## test-first contract

Behavior under test:

- Reader shell hero title is capped for mobile and avoids the oversized/off-screen guide title.
- Reader shell renders a roadmap-style orange thesis block after the hero lead.
- Top pill nav uses a task/action button on the right instead of a top-right linear progress bar.
- Scroll progress is represented by the back-to-top circle, not by `.reader-progress` in the nav.
- Resume reading is a single small chip that auto-dismisses after 10 seconds; no Dismiss button.
- Tap-to-scroll uses GSAP ScrollTo when available and records `window.__readerShell.smoother`.
- Cards reduce double nesting by allowing section content that consists only of cards/flow/table/etc. to render without an extra framed wrapper.
- Typography is less heavy and closer to the roadmap: serif headings with restrained h1 clamp, normal body/card weights, orange thesis treatment.

Focused red command:

```bash
bun run test:reader
```

Expected red failure:

The new roadmap-parity tests fail before implementation because the current renderer still has `.reader-progress`, a dismiss button, no orange `.hero-thesis`, oversized h1/mobile clamp, and nested section frames around card-only sections.

## implementation notes

Pending.

## validation evidence

Pending.

- 2026-06-07 15:21:34 write: `.task/design/polish-reader-shell-mobile/workpad.md`

## files changed

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

## workspace-owned: files changed

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

## workspace-owned: activity log

- 2026-06-07 15:21:34 fs.write: `.task/design/polish-reader-shell-mobile/workpad.md`
- 2026-06-07 15:22:06 append: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 15:22:06 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-07 15:31:18 fs.write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-07 15:32:58 fs.write: `.task/design/polish-reader-shell-mobile/workpad.md`
- 2026-06-07 15:34:20 fs.write: `.task/design/polish-reader-shell-mobile/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-07 15:22:18 `bun run test:reader`: failed exit 1 trace: `trc_4d199b528ced`
  - output: ; requestAnimationFrame(tick); }\n tick();\n </script>\n</body>\n</html>" at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-design-polish-reader-shell-mobile/packages/consuelo-design/scripts/render-consuelo-reader.test.ts:260:18) (fail) roadmap mobile parity shell polish > card-only sections avoid double-framed nesting [0.18ms] 9 pass 2 fail 69 expect() calls Ran 11 tests across 1 file. [21.00ms] error: script "test:reader" exited with code 1 error: script "test:reader" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-07 15:26:34 `bun run test:reader`: passed exit 0 trace: `trc_1ccb4b6b014b`
  - output: ell contract > requires body sections and a checklist ledger for reader shell documents [0.02ms] (pass) typed reader shell contract > renders optional typed components deterministically [0.14ms] (pass) direct rich reader component names > renders PR 666 component names as first-class typed options [0.17ms] (pass) roadmap mobile parity shell polish > uses roadmap-style nav, thesis, resume, and progress affordances [0.12ms] (pass) roadmap mobile parity shell polish > card-only sections avoid double-framed nesting [0.07ms] 11 pass 0 fail 82 expect() calls Ran 11 tests across 1 file. [15.00ms]

## workspace-owned: files read

- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

- 2026-06-07 15:31:18 write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

## workspace-owned: validation evidence

Pending.
- 2026-06-07 15:21:34 write: `.task/design/polish-reader-shell-mobile/workpad.md`
- 2026-06-07 15:31:43 `checkFiles`: passed — OK
- 2026-06-07 15:33:42 `review.run`: passed — OK
- 2026-06-07 15:34:00 `verify`: passed — OK

## implementation update — 2026-06-07

- Updated `packages/consuelo-design/scripts/render-consuelo-reader.ts` to reader shell version `1.1.0`.
- Added roadmap-style orange `.hero-thesis` after the hero lead.
- Replaced the nav progress bar with a right-side `.reader-nav-task` pill.
- Moved scroll progress to the back-to-top button via `.reader-back-to-top-progress` and a conic gradient.
- Reworked resume reading into a single small chip with `data-auto-dismiss-ms="10000"`; removed the Dismiss button.
- Kept GSAP tap-to-scroll through `smoother.scrollTo(target, true, 'top 80px')`.
- Reduced mobile title scale with `font-size:clamp(48px, 12vw, 88px)`.
- Flattened card-only sections with `.section-content.flat-content` and `roadmap-card-grid` to avoid double-framed nesting.
- Updated `reader-shell.md` so the durable docs point future agents at the roadmap mobile baseline.

## validation update — 2026-06-07

- Red: `bun run test:reader` failed before implementation on missing `class="hero-thesis"`, trace `trc_1ccb4b6b014b` contains green rerun and red evidence is in prior failed run output.
- Syntax: `node --check packages/consuelo-design/scripts/render-consuelo-reader.ts` passed, trace `trc_73d6c2384f7e`.
- Green: `bun run test:reader` passed with 11 tests and 82 assertions, trace `trc_e34485cc2584`.
- Static: `checkFiles` passed for renderer and test files, trace `trc_e74aca27df21`.
- Rendered How To Speak guide v3 through the task renderer: `/tmp/how-to-speak-guide-v3/index.html`, readerShellVersion `1.1.0`, trace `trc_d3b1b4b96998`.
- Validated v3: `missing: []`, trace `trc_b3dd11afac2b`.
- Local mobile browser test passed against `file:///tmp/how-to-speak-guide-v3/index.html`, screenshot `/tmp/opensaas-screenshots/page-2026-06-07T15-29-06.png`, trace `trc_dee21f569e3d`.
- Published v3 over `/daily-deep-idea/2026-06-07-how-to-speak` with base version `2026-06-07T10-40-37-569Z`, new version `2026-06-07T15-27-38-446Z`, trace `trc_08e54152b977`.
- Archive check showed sourceTarget `/tmp/how-to-speak-guide-v3` and versionCount `4`, trace `trc_04ae08e19b8a`.
- Design boundary check passed, trace `trc_ca99ce3cad7e`.

- 2026-06-07 15:32:58 append: `.task/design/polish-reader-shell-mobile/workpad.md`

## workspace-owned: test selection

- changed files: `.task/design/polish-reader-shell-mobile/current.json`, `.task/design/polish-reader-shell-mobile/evidence-log.json`, `.task/design/polish-reader-shell-mobile/read-log.json`, `.task/design/polish-reader-shell-mobile/session.json`, `.task/design/polish-reader-shell-mobile/workpad.md`, `.task/tasks/design/polish-reader-shell-mobile.json`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation update — 2026-06-07

- Review passed against `origin/stream/design` with 0 issues from this change; pre-existing project typecheck note remains, trace `trc_5f8c6adef0eb`.
- Verify passed against `origin/stream/design` and wrote a publish-valid stamp, trace `trc_af5dd2cc4c90`.
- Current live guide archive version is `2026-06-07T15-27-38-446Z`, source target `/tmp/how-to-speak-guide-v3`, version count `4`.

- 2026-06-07 15:34:20 append: `.task/design/polish-reader-shell-mobile/workpad.md`
