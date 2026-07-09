# fix diff cockpit scroll navigation

branch: `task/diff-cockpit/fix-diff-cockpit-scroll-navigation`
stream: `stream/diff-cockpit`
pr: #1037
started: 2026-06-14

## objective

Make Diff Cockpit file navigation and panel/layout changes preserve the reader's position without animated scroll-through behavior.

## acceptance criteria

- [x] File tree clicks jump directly to the selected file with no smooth scroll animation.
- [ ] Comment jumps and active-file tree sync avoid animated scrolling.
- [ ] Global document smooth scrolling is disabled for the review surface.
- [ ] Opening/closing the review drawer, AI sidebar, file drawer, and file-pane collapse preserves the current diff viewport.
- [ ] The fix is covered by focused diff-cockpit tests and package typecheck.

## test-first contract

Behavior under test:

- The review page script should use instant file navigation instead of `behavior: 'smooth'` for file tree clicks.
- The review page should include a viewport-preservation helper and call it around layout-mutating side panels/toggles.
- The review page CSS should not set global `scroll-behavior:smooth`.

Existing pattern to follow:

- `packages/diff-cockpit/tests/diff-cockpit.test.ts` asserts generated review HTML/client script markers.
- `packages/diff-cockpit/src/index.ts` renders one Worker-hosted HTML string with embedded CSS and client script.

Focused red command:

`bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts`

Expected red failure before implementation:

- New tests fail because smooth scroll markers still exist and viewport-preservation helpers are absent.

## exploration

- Read `AGENTS.md`, full `CODING-STANDARDS.md`, and `packages/diff-cockpit/README.md`.
- Read `packages/diff-cockpit/src/index.ts` CSS and review client script around `scrollIntoView`, file tree clicks, observer updates, and panel toggles.
- Read `packages/diff-cockpit/tests/diff-cockpit.test.ts` review page assertions.

## validation evidence

- pending

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-14 18:15:30 fs.write: `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/workpad.md`
- 2026-06-14 18:16:23 fs.write: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-14 18:17:44 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-14 18:24:43 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-14 18:25:19 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-14 18:25:42 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-14 18:25:56 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-14 18:26:22 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-14 18:30:33 fs.patch: `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

- 2026-06-14 18:30:33 patch lines 14-14: `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/workpad.md`

## workspace-owned: validation evidence

- pending
- 2026-06-14 18:31:04 `review.run`: passed — OK
- 2026-06-14 18:31:19 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/current.json`, `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/evidence-log.json`, `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/read-log.json`, `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/session.json`, `.task/diff-cockpit/fix-diff-cockpit-scroll-navigation/workpad.md`, `.task/tasks/diff-cockpit/fix-diff-cockpit-scroll-navigation.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
