# Preview filesystem terminal and tools homepage positioning

branch: task/website/preview-filesystem-terminal-and-tools-homepage-positioning
stream: stream/website
pr: https://github.com/consuelohq/opensaas/pull/2616
started: 2026-09-29

## acceptance criteria

- Preserve real homepage shell, rotating hero layout, current button styling, hover/scroll effects and FAQ.
- Explain scoped file access, terminal execution in plain language, and reusable agent tools.
- Keep recorded demo, remove dense feature diagrams and shorten the feature section.
- Keep Work solo. Bring your team. and improve closing copy/spacing.
- Provide a task-owned Tailscale preview and preserve this branch for iterative edits without stream promotion or production deployment.

## plan

1. Inspect current components, existing checks and preview infrastructure.
2. Edit typed copy and existing composition with website-owned tokens/primitives.
3. Run focused checks/build, browser verification, strict review and verify.
4. Push to task PR only, leave isolated preview available for edits.

## Test-first contract

behavior under test: reversible static homepage copy/layout preview; existing hero rotation, install copy, FAQ and routing remain functional.
existing local pattern: homepage-responsive, homepage-mobile-layout, website-structure suites, browser screenshots and geometry/CTA checks.
new or changed tests: maintain existing assertions made stale by approved copy/composition; no new implementation-mirroring tests.
focused red command: not applicable to copy/presentation experiment.
expected red failure: not applicable.
no-test waiver: this reversible static copy/layout change uses existing tests, Astro check/build and actual desktop/tablet/phone/reduced-motion browser proof instead of new TDD tests.

## current status

- Created from remote main a099930e. Website stream is 288 commits behind main.
- Same-day footer art removal and overflow fixes remain intact.
- Preview only; user wants to iterate before adoption.

## files changed

- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/src/styles/primitives.css`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- `packages/consuelo-website/tests/website-structure.test.js`


## key decisions

- Keep hero DOM and button treatments; test Give ChatGPT/Claude access to your files within the same two-line rotation.
- Three core pillars: files, commands on your computer, and reusable agent tools. Teamwork is the close.
- Preserve FAQ; remove proposed use-case tabs and fake interfaces.

## notes for ko

- Isolated editable task preview, no production changes.

## improvements noticed

- Existing media aligns to top while copy centers.
- Footer spacing retains a void after prior art removal.

## errors i ran into

- Initial fs.write rejected overwrite because force was missing; corrected with force:true.
- explore returned deleted legacy Storybook paths from a stale index; current website source and runtime evidence take precedence.

- 2026-09-29 20:18:12 write: `.task/website/preview-filesystem-terminal-and-tools-homepage-positioning/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

## workspace-owned: activity log

- 2026-09-29 20:18:12 fs.write: `.task/website/preview-filesystem-terminal-and-tools-homepage-positioning/workpad.md`
- 2026-09-29 20:20:47 apply-patch: `packages/consuelo-website/src/data/home-content.ts`
- 2026-09-29 20:22:37 write: `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- 2026-09-29 20:22:37 fs.write: `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- 2026-09-29 20:22:37 apply-patch: `packages/consuelo-website/src/styles/primitives.css`
- 2026-09-29 20:22:37 apply-patch: `packages/consuelo-website/src/styles/tokens.css`
- 2026-09-29 20:24:36 write: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- 2026-09-29 20:24:36 fs.write: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- 2026-09-29 20:24:37 apply-patch: `packages/consuelo-website/DESIGN.md`
- 2026-09-29 20:32:23 write: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-09-29 20:32:23 fs.write: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

## workspace-owned: validation evidence

- 2026-09-29 20:33:18 `review.run`: passed — OK
- 2026-09-29 20:33:18 `verify`: passed — OK
- 2026-09-29 20:35:22 `verify`: passed — OK
- 2026-09-29 20:35:38 `verify`: passed — OK
- 2026-09-29 20:37:09 `verify`: passed — OK
- 2026-09-29 20:37:33 `verify`: passed — OK
- 2026-09-29 20:38:44 `review.run`: passed — OK
- 2026-09-29 20:38:45 `verify`: passed — OK
- 2026-09-29 20:39:21 `verify`: passed — OK
- 2026-09-29 20:51:45 `review.run`: passed — OK
- 2026-09-29 20:51:45 `verify`: passed — OK
- 2026-09-29 20:53:27 `verify`: passed — OK
- 2026-09-29 20:54:17 `verify`: passed — OK

## Implemented preview

- Kept the actual HomeHero structure, assistant rotation, cloud visuals, sign-in button and copy-install control; changed its typed copy to "Give ChatGPT / Claude access to your files."
- Replaced the six public diagram chapters with three access pillars: chosen files, terminal commands explained through outcomes, and reusable tools. Kept the existing recorded demo and four demonstrated agents.
- Centered the desktop demo and copy, kept compact text-only follow-on sections, and added existing-style rectangular CTAs.
- Preserved the original FAQ and its interaction. Removed no reusable feature components from the package.
- Changed the existing footer reveal to a centered "Work solo. Bring your team." invitation with sign-in and pricing routes. Kept the license/version signature and previous illustration removal.
- Updated DESIGN.md, added shared typography/button tokens, and maintained the existing homepage presentation/browser checks.

## Validation evidence

- Website build: passed, 24 routes; Astro reports zero errors, zero warnings, 23 existing hints.
- Homepage browser contract: passed (320, 360, 375, 390, 430, 768, 1024, 1180 and 1440px), preserving header, hero controls, demo ratio, FAQ interaction, no horizontal overflow, centered footer and reduced-motion/reveal behavior.
- Homepage responsive source checks: passed. Combined responsive/structure result: 26 pass, 3 fail. The same three failures occur in the untouched local checkout: hero released-installer assertion, approved-header navigation assertion, and design office/headless contract assertion. Do not change unrelated product/navigation/design contracts to make this preview pass.
- Strict review before commit: zero changed-code issues / zero blockers. Verify initially had no committed changed files; rerun both after pushing the concrete task commit.

## Live preview and task-only boundary

- Tailnet URL: https://picassos-mac-mini.tail38ed59.ts.net:8448/
- Astro dev origin: http://127.0.0.1:55737
- Task-owned server parent PID at launch: 79701. Local runtime state/logs are outside the repository in /private/tmp/consuelo-website-preview-tsk_ddbcdb7353da/.
- Tailscale Serve uses an otherwise unused HTTPS 8448 port. Existing Serve routes and Funnel configuration were preserved.
- To stop this preview proxy: tailscale serve --https=8448 off. Stop only the task-owned server after verifying its process identity.
- PR #2616 is the preview task; leave it unmerged and retain this worktree/server so Ko can iterate on the actual page. Do not call default task.pr promotion or task.finish.

## Final gate and publication state

- Full verification completed: passed, publishValid=true; DB guard found zero risks. Strict review found zero changed-code issues and zero blockers.
- Task commit ee68794f was pushed to the existing preview branch. The task push helper recursively included runtime files despite local ignore rules; those task-owned files were moved out of the repository to the temporary path above for cleanup in the follow-up commit. The running server keeps the same log file handle and port.
- The task stays separate from stream/website by Ko's explicit preview-only instruction. Current live page is served from this worktree and can be edited in place.

## Shipping scope authorized by Ko

Ko approved the live preview and explicitly requested: fix alignment of the two follow-on text sections; update SEO and share previews; verify phone, iPad and resizing layouts; ship to the main Cloudflare website. This supersedes the earlier task-only preview boundary. Promote the completed task through the website stream, merge the reviewed exact head to main, and verify the website production deployment. Preserve other agents' changes.

## Alignment regression contract

Behavior: at two-column widths, headings, paragraph starts and CTA starts share row positions regardless of title wrapping; single-column widths retain readable ordering and no overflow.
Existing pattern: homepage-mobile-layout.test.mjs real-browser contract.
Focused red: node --test tests/homepage-mobile-layout.test.mjs from the website package. New aligned-row assertions must fail against the independently flowing preview columns before the CSS fix.
SEO validation: rendered title, descriptions, OG/Twitter image paths and application schema must match the new positioning; new share PNG must decode at 1200 by 630 and fit the existing size budget.

## Shipping verification

- Alignment regression failed before the CSS change: paragraph starts differed by 114px at 768px. It now passes across 768, 834, 1024, 1180, 1440 and 1920px.
- Chromium and WebKit matrix: 28 viewport cases passed from 320 by 568 through 1920 by 1080, including iPad widths and portrait/landscape. Six resize transitions retained FAQ state without horizontal overflow. This is browser emulation, not a physical iPhone Duo device test. Apple resizability reference: https://developer.apple.com/iphone-duo/.
- New landscape footer density fixed the clipped close at 844 by 390.
- Homepage responsive and social asset tests: 10 passed. Share PNG: 1200 by 630, 165455 bytes; versioned files card supplied as base64 source and materialized during build.
- Last website build: 24 routes, no Astro errors or warnings (existing hints only). Rebuild after final compact-footer CSS before release.
- Local Cloudflare OAuth is authenticated for account 90b2b9dfeefcad97b9e2325b2b2e7a96 and has Pages write access. Existing production release workflow deploys consuelo-website on main; use its website deployment receipt and check the live custom domain after main integration.
- Current remote main was verified at a099930e; only this task's website change should appear in the final stream-to-main diff.
