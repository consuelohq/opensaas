# polish docs interactions and branding

branch: `task/workspace-agents/polish-docs-interactions-and-branding`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1873/polish-docs-interactions-and-branding
github pr: https://github.com/consuelohq/opensaas/pull/1873
started: 2026-08-12

## acceptance criteria

- [x] Replace the blue global-sidebar hover treatment with the same text-only emphasis used by the section sidebar.
- [x] Render the existing shared favicon mark with `Consuelo OS` in theme-appropriate black/white instead of the blue `Consuelo Docs` wordmark.
- [x] Remove persistent pointer-click focus rings from header/search/navigation controls without removing keyboard focus indication.
- [x] Replace the harsh page-load feel with a subtle, reduced-motion-safe content entrance and do not add GSAP as a new dependency.
- [x] Protect the behavior with source-contract and Playwright browser checks, then pass docs validation and a clean production build.

## plan

1. Read the Starlight shell overrides, installed dependency surface, favicon assets, and existing UI tests.
2. Add a failing source contract for branding, sidebar hover, focus modality, and motion behavior.
3. Implement the smallest shell/CSS changes, then add computed browser assertions for mouse vs keyboard focus.
4. Validate foundation + translation + docs validator, run a clean-copy Astro production build and Playwright browser suite, then review/verify and publish.

## current status

- Implementation and visual/browser validation are green. Ready for review/verify and task promotion.

## files changed

- `packages/documentation/astro.config.mjs`
- `packages/documentation/src/components/Head.astro`
- `packages/documentation/src/components/SiteTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/src/lib/translation/source.ts`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/tests/foundation.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-12 03:34:06 fs.write: `.task/workspace-agents/polish-docs-interactions-and-branding/workpad.md`
- 2026-08-12 03:37:40 fs.write: `.task/workspace-agents/polish-docs-interactions-and-branding/workpad.md`

## workspace-owned: validation evidence

- Red contract: `bun test packages/documentation/tests/foundation.test.ts` failed 12/13 because the new Head/SiteTitle/branding/focus/motion contract did not exist yet. Trace `trc_fa157bef4f66`.
- Green source/validator packet: documentation validator passes 121 pages; foundation 13/13 with 367 expectations; translation test passes. Trace `trc_6280d6b39bcf`.
- Clean-copy production validation avoids the known task-worktree Astro dependency-symlink artifact: frozen Bun install succeeds, Astro/Starlight build succeeds and indexes 133 HTML files, Playwright foundation browser suite passes desktop/tablet/mobile including Consuelo OS logo, text-only sidebar hover, quiet pointer focus on Translate/Auto/Search, preserved keyboard focus, and the new entrance animation. Trace `trc_5a73cee6d67f`.
- Final strict review against `origin/main`: 0 owned issues and 0 blockers. One pre-existing project-level typecheck notice remains because documentation has no Nx `typecheck` target. Trace `trc_0fd9548b1978`.
- Full verify against `origin/main` passed with `publishValid: true`, 0 documentation opportunities, 0 DB risks, and 0 owned review issues. Trace `trc_846eee98ad14`.
- 2026-08-12 03:45:52 `review.run`: passed — OK
- 2026-08-12 03:46:08 `review.run`: passed — OK
- 2026-08-12 03:46:57 `verify`: passed — OK

## key decisions

- Do not add GSAP. It is not installed in `packages/documentation`, and this microinteraction does not justify a new runtime dependency. The final motion is a 150ms CSS entrance on `.main-frame` (94% → 100% opacity, 2px → 0px) with `prefers-reduced-motion` disabled.
- Use the existing local `/favicon.svg` for the header brand. It is byte-identical to `packages/consuelo-website/public/favicon.svg` and already contains the bordered Consuelo app tile used across themes.
- Track input modality in a small Starlight `Head` override: pointerdown removes mouse/touch focus outlines/shadows; Tab restores a neutral theme-foreground `:focus-visible` ring. This solves native select/search focus behavior without sacrificing keyboard accessibility.
- Keep the global sidebar visually consistent with Starlight’s inner sidebar: gray text at rest, theme foreground on hover, transparent hover background.

## notes for ko

- The brand now reads `Consuelo OS` with the actual favicon mark and no blue brand text.
- Mouse clicks on English Translate, Auto/theme, Search, sidebar links, and other standard interactive controls no longer leave a blue ring that must be cleared by clicking elsewhere. Keyboard Tab focus still remains visible.
- The page entrance is intentionally tiny; it should read as a soft settle rather than an animation effect.

## improvements noticed

- none yet

## issues and recovery

- The first implementation tried the browser-native cross-document View Transition API. In clean Playwright runs, that made ordinary card/button actions remain “unstable” for the actionability checker even after the visible transition should have completed. Rather than ship an interaction primitive that complicates input timing, it was replaced with a dependency-free 150ms CSS entrance on the content frame. Normal (non-forced) browser hover/click tests then passed. Failed traces: `trc_bddd1f9321af`, `trc_f0e7efba200e`; final green browser trace: `trc_5a73cee6d67f`.
- Running the browser suite directly in the task worktree reproduces the existing Astro/Vite symlinked-`node_modules` compile-metadata error. The clean-copy install/build/browser path passed and is the authoritative production-build evidence for this task. Direct-worktree failure trace: `trc_61645b9d441e`.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/astro.config.mjs`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/components/translation/RuntimeLanguageSelect.astro`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`
- `packages/workspace/senior-engineer.md`

## discovery

- User-visible target: docs shell shown in the supplied screenshot. Requested deltas: subtle page transitions, text-only primary sidebar hover, Consuelo OS branding with the existing light/dark-safe favicon mark, and removal of sticky blue mouse-click rings while preserving keyboard focus accessibility.
- Need to verify whether GSAP is already installed before choosing it; adding a dependency requires explicit approval.
- Need to locate the Starlight shell overrides, transition implementation, logo/favicon asset, focus styles, and existing docs UI tests before production edits.

## Test-first contract

- Behavior under test: primary sidebar hover only brightens text; header renders the favicon mark plus `Consuelo OS` in theme-appropriate foreground; pointer clicks do not leave persistent blue focus rings on search/theme/translate/nav controls while keyboard `:focus-visible` remains; route changes use a subtle reduced-motion-safe transition.
- Existing local pattern: pending discovery of documentation UI tests/style assertions.
- New/changed tests: pending discovery; prefer CSS/source contract tests plus browser verification for the visual behavior.
- Focused red command: pending discovery.
- Expected red failure: current docs shell still exposes blue hover/focus styling and old `Consuelo Docs` brand/transition contract.

- 2026-08-12 03:34:06 append: `.task/workspace-agents/polish-docs-interactions-and-branding/workpad.md`

- 2026-08-12 03:37:02 apply-patch: `packages/documentation/tests/foundation.test.ts`

## Test-first contract update

- Existing local pattern: `tests/foundation.test.ts` protects shell/config/CSS source contracts and `scripts/test-foundation-browser.mjs` verifies computed sidebar/layout behavior in Playwright.
- Dependency decision: GSAP is not installed in `packages/documentation`; adding it would require explicit approval. This interaction does not need another runtime dependency. Use the browser-native cross-document View Transition API as progressive enhancement, scoped to `.main-frame`, with reduced-motion opt-out.
- Focus strategy: a tiny head script tracks pointer vs Tab-key modality. Pointer-focused controls suppress outlines/shadows; Tab navigation keeps a neutral theme-foreground focus ring. This specifically covers native `select` and search inputs, which can match `:focus-visible` after a mouse click.
- Focused red command: `bun test packages/documentation/tests/foundation.test.ts`.
- Red result: 12 passed / 1 failed because the new shell contract expects `src/components/Head.astro`, `SiteTitle.astro`, Consuelo OS config, pointer modality CSS, and native view-transition CSS that do not exist yet. Trace `trc_fa157bef4f66`.

- 2026-08-12 03:37:40 append: `.task/workspace-agents/polish-docs-interactions-and-branding/workpad.md`

- 2026-08-12 03:37:54 apply-patch: `packages/documentation/astro.config.mjs`
- 2026-08-12 03:37:54 apply-patch: `packages/documentation/src/components/Sidebar.astro`
- 2026-08-12 03:37:54 apply-patch: `packages/documentation/src/styles/docs.css`
- 2026-08-12 03:37:54 apply-patch: `packages/documentation/scripts/validate-documentation.mjs`
- 2026-08-12 03:37:54 apply-patch: `packages/documentation/src/lib/translation/source.ts`
- 2026-08-12 03:37:54 apply-patch: `packages/documentation/src/components/Head.astro`
- 2026-08-12 03:37:54 apply-patch: `packages/documentation/src/components/SiteTitle.astro`
- 2026-08-12 03:38:19 apply-patch: `packages/documentation/scripts/test-foundation-browser.mjs`
- 2026-08-12 03:39:43 apply-patch: `packages/documentation/scripts/test-foundation-browser.mjs`
- 2026-08-12 03:41:47 apply-patch: `packages/documentation/scripts/test-foundation-browser.mjs`
- 2026-08-12 03:42:56 apply-patch: `packages/documentation/src/styles/docs.css`
- 2026-08-12 03:42:56 apply-patch: `packages/documentation/tests/foundation.test.ts`
- 2026-08-12 03:42:56 apply-patch: `packages/documentation/scripts/test-foundation-browser.mjs`
- 2026-08-12 03:43:29 apply-patch: `packages/documentation/scripts/test-foundation-browser.mjs`
- 2026-08-12 03:44:21 apply-patch: `packages/documentation/src/styles/docs.css`
- 2026-08-12 03:44:21 apply-patch: `packages/documentation/tests/foundation.test.ts`

- 2026-08-12 03:45:32 apply-patch: `.task/workspace-agents/polish-docs-interactions-and-branding/workpad.md`

- 2026-08-12 03:45:59 apply-patch: `packages/documentation/scripts/test-foundation-browser.mjs`

- 2026-08-12 03:47:01 apply-patch: `.task/workspace-agents/polish-docs-interactions-and-branding/workpad.md`