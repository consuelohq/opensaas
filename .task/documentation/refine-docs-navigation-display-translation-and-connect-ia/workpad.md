# refine docs navigation display translation and connect IA

branch: `task/documentation/refine-docs-navigation-display-translation-and-connect-ia`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1942/refine-docs-navigation-display-translation-and-connect-ia
github pr: https://github.com/consuelohq/opensaas/pull/1942
started: 2026-08-14

## acceptance criteria

- [x] Reconcile `stream/documentation` with current `main` without discarding current-main documentation behavior or unrelated agent work.
- [x] On mobile, top-level documentation rows expand/collapse their child links in place; tapping the section row does not navigate away.
- [x] Replace the theme dropdown everywhere with a compact Railway-style three-state segmented display control for system / light / dark, using icons rather than a select.
- [x] In the mobile menu footer, keep GitHub and the display control aligned together at the bottom-left; remove the language selector entirely.
- [x] Auto-detect the browser's preferred language and automatically request/render runtime translation when the preferred supported language is not English; keep English MDX as the sole editorial source.
- [x] Add deterministic coverage proving browser-language detection triggers translation without a visible Translate control, and preserve server-side cache/provider boundaries.
- [x] Promote Sites to its own top-level section and remove Sites from Tools while preserving existing `/sites/**` routes and breadcrumbs.
- [x] Remove persistent pointer/click focus rings from documentation cards and controls while preserving a visible neutral keyboard focus state.
- [x] Under Connect, rename `Apps and services` to `Applications`, flatten application categories into one alphabetical application list, remove Agents/Applications overview entries, and rename each `Additional services` group to `Create your own`.
- [x] Preserve compatibility for renamed/moved Connect URLs with redirects where routes change.
- [x] Pass focused static/unit/browser tests, documentation validation, production build, strict review, and full verify before promotion to `stream/documentation`.

## plan

1. Reconcile the stale documentation task base with current `main`, resolving the known documentation chrome conflicts in favor of current-main semantics before adding new behavior.
2. Read the current navigation, translation, theme/mobile-footer, Connect, card-focus, and redirect implementations plus Starlight component contracts.
3. Add focused unit/browser contracts first and capture the expected red failures for mobile accordions, segmented display control, browser-language translation, Sites top-level IA, Connect IA, and pointer focus.
4. Implement the smallest correct changes in `packages/documentation/**`, preserving runtime translation/cache boundaries and route compatibility.
5. Run focused tests, documentation validation, browser verification at mobile/tablet/desktop, and the production Astro build.
6. Run strict review and full verify, push the task, promote it into `stream/documentation`, and report the refreshed stream PR for review.

## Test-first contract

- Behavior under test: mobile global navigation toggles children without navigation; display control is a three-icon segmented system/light/dark control and sits beside GitHub in the mobile footer; browser locale automatically selects runtime translation with no Translate UI; Sites is a top-level section; pointer clicks do not leave blue rings; Connect Agents/Applications navigation follows the flattened/renamed IA.
- Existing local patterns: `tests/foundation.test.ts` owns registry/source contracts; `scripts/test-foundation-browser.mjs` owns rendered navigation/focus/mobile behavior; translation behavior has package-local translation tests/routes that will be extended rather than duplicated after inspection.
- Planned test changes: update foundation/navigation tests plus the existing browser harness; extend the existing translation test path with deterministic browser-locale/provider coverage.
- Focused red command: run the smallest affected documentation test scripts after the current-main merge and before production edits.
- Expected red failures: global mobile rows currently navigate; theme uses Starlight's select/dropdown; Translate UI is visible and translation requires selection; Tools owns Sites; Connect still has grouped Apps and services + overview entries; pointer-click card focus can retain an outline.
- No-test waiver: none. These are behavior and information-architecture changes with direct browser impact.

## current status

- Task started from `stream/documentation`. The stream is 4 historical commits ahead of and 605 commits behind current `main`.
- `stream.sync` reproduced content conflicts in eight documentation chrome/navigation files. No stream content was discarded. This task will reconcile those conflicts against current-main semantics before implementing the requested changes.
- Discovery confirms current main already has Nodes as a top-level section, Sites still nested under Tools, a visible runtime translation selector, Starlight's theme select, pointer-focus suppression that does not cover every card case, and Connect's grouped Apps and services IA.
- Reconciliation is now complete on the task branch: current `origin/main` was merged, the eight expected documentation conflicts were resolved exactly to current-main versions, and the old stream's non-conflicting `mintlify/Card.astro` work plus task metadata were preserved. The merge commit is `d3cfce1f9330d51029b2468cde6f4efa5a8e4ad4`, and `origin/main` is an ancestor of the task branch.
- Implementation and validation are complete. The task now has the requested mobile accordion navigation, icon display rail, automatic cached runtime translation, top-level Sites IA, neutral card pointer focus, and flattened Connect Applications/Create your own IA. It is ready to promote; merging this task PR into `stream/documentation` will also carry the already-validated current-main reconciliation into the stream without a force push or history rewrite.

## files changed

- Documentation navigation/Connect IA: `src/lib/docs-navigation.ts`, Connect MDX pages, compatibility redirects, homepage copy, and navigation/static/browser tests.
- Documentation chrome: `src/components/Sidebar.astro`, new `ThemeSelect.astro`, new `MobileMenuFooter.astro`, `mintlify/Card.astro`, and Starlight component overrides.
- Translation: `RuntimeLanguageSelect.astro`, translation language/provider/endpoint coverage, README runtime contract, and deterministic browser tests.

## workspace-owned: files changed

- `packages/documentation/src/components/translation/RuntimeLanguageSelect.astro`

## workspace-owned: activity log

- 2026-08-14 06:35:23 fs.write: `packages/documentation/src/components/translation/RuntimeLanguageSelect.astro`

## workspace-owned: validation evidence

- TDD red captured after updating focused contracts: `test:foundation`, `test:connect`, and `test:translation` all failed for the intended missing behavior (Sites was not top-level, custom segmented theme/mobile footer components did not exist, Connect still had grouped Apps and services + old generic routes, and browser-language resolution was not implemented). Trace: `trc_9a623f752036`.
- 2026-08-14 06:45:06 `review.run`: passed — OK
- 2026-08-14 06:45:26 `review.run`: passed — OK
- 2026-08-14 06:45:37 `verify`: passed — OK
- Full documentation static suite: 93/93 tests, 2,820 expectations; translation contract passes; validator passes across 105 selected pages. Trace: `trc_91972ce5ebd4`.
- Clean-copy production/browser gate (isolated dependencies, not the task-worktree symlink): Astro/Cloudflare build passes with 117 indexed HTML files; foundation/mobile/automatic-Spanish translation, Connect, Sites, Build, Observe, Secure, and Reference browser suites all pass with zero tablet/mobile horizontal overflow. Trace: `trc_4ef7d27dafa8`.
- Strict review after fixing its one test-harness error-handling finding: 0 owned issues, 0 blockers, 0 documentation opportunities. The only reported item is the pre-existing workspace review note that this package has no Nx `typecheck` target. Trace: `trc_23f2b65a238e`.
- Full verify against `origin/main`: passed, `publishValid: true`, 0 DB risks, 0 owned blockers. Trace: `trc_d762aee16c26`.
- 2026-08-14 06:46:10 `verify`: passed — OK

## key decisions

- Current `main` is the semantic source of truth for resolving the stale July documentation-stream chrome conflicts; the stream's unique July task metadata is not being deleted.
- Keep runtime translation server-side and cache-backed. The UI change is automatic browser-language selection, not client-side provider credentials or committed locale trees.
- Preserve `/sites/**` as canonical URLs while changing only their top-level navigation ownership.

## notes for ko

- The existing `stream/documentation` is real but stale. I am updating that stream rather than creating a new docs stream.

## improvements noticed

- none yet

## issues and recovery

- `stream.sync` cannot resolve semantic content conflicts. It stopped safely on conflicts in `astro.config.mjs`, the foundation browser test, `Footer.astro`, `PageTitle.astro`, `Sidebar.astro`, `docs-navigation.ts`, `docs.css`, and `foundation.test.ts`. There is no typed stream-conflict-resolution operation in the current tool surface, so the task worktree will use the narrow task-scoped Git merge fallback and resolve only those known files against current-main behavior.
- Because `task.push` requires the checked-out task ref to match its remote ref before API publication, the resolved merge commit itself had to be committed and pushed with the narrow task-scoped Git fallback. No product edits were published through raw Git; subsequent implementation uses the normal task lifecycle.
- Direct browser startup inside this task worktree reproduces the known Astro/Vite compile-metadata failure caused by `packages/documentation/node_modules` resolving into the main checkout (`No cached compile metadata found ... /Users/kokayi/Dev/opensaas/...`). Trace: `trc_5560202f5b7e`. A clean package copy with its own frozen Bun install is therefore the browser/build source of truth for this task; all seven relevant browser suites and the production build pass there (`trc_4ef7d27dafa8`).

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/astro.config.mjs`
- `packages/documentation/node_modules/@astrojs/starlight/components/MobileMenuFooter.astro`
- `packages/documentation/node_modules/@astrojs/starlight/components/SocialIcons.astro`
- `packages/documentation/node_modules/@astrojs/starlight/components/ThemeSelect.astro`
- `packages/documentation/package.json`
- `packages/documentation/scripts/lib/documentation-browser-test.mjs`
- `packages/documentation/scripts/test-build-browser.mjs`
- `packages/documentation/scripts/test-connect-browser.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/test-sites-browser.mjs`
- `packages/documentation/scripts/test-translation.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/components/Footer.astro`
- `packages/documentation/src/components/Head.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/components/SiteFooter.astro`
- `packages/documentation/src/components/mintlify/Card.astro`
- `packages/documentation/src/components/translation/RuntimeLanguageSelect.astro`
- `packages/documentation/src/content/docs/connect/agents/other-agents.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/additional-services.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/index.mdx`
- `packages/documentation/src/content/docs/connect/index.mdx`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/src/lib/translation/cache.ts`
- `packages/documentation/src/lib/translation/languages.ts`
- `packages/documentation/src/lib/translation/provider.ts`
- `packages/documentation/src/lib/translation/source.ts`
- `packages/documentation/src/lib/translation/types.ts`
- `packages/documentation/src/pages/api/docs/translate.ts`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/connect.test.ts`
- `packages/documentation/tests/foundation.test.ts`
- `packages/documentation/tests/navigation-memory.test.ts`
- `packages/documentation/tests/sites.test.ts`
- `packages/workspace/scripts/task-push.js`

- 2026-08-14 06:46:04 apply-patch: `.task/documentation/refine-docs-navigation-display-translation-and-connect-ia/workpad.md`
