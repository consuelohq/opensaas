# DEV-1635 docs interaction accessibility and CI gate

branch: `task/dialer/dev-1635-docs-interaction-accessibility-and-ci-gate`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2691
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-documentation/tests/accessibility-ci.test.ts`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/dialer-documentation/scripts/test-browser.mjs`
- `packages/dialer-documentation/src/components/BrowseMenu.astro`
- `packages/dialer-documentation/src/components/MobileTableOfContents.astro`
- `packages/dialer-documentation/src/components/PageTitle.astro`
- `packages/dialer-documentation/src/styles/docs.css`
- `packages/dialer-documentation/tests/package.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`

## Test-first contract — DEV-1635

- Scope: packages/dialer-documentation/src/styles/docs.css, src/components/PageTitle.astro, scripts/test-browser.mjs; packages/workspace/test-selection.rules.json and generator-owned registry only.
- Start from stream/dialer (no main merge); preserve DEV-1631/1634 and unrelated website/public CI rules.
- Behavior: light-theme ordinary muted text color on #faf7f2 must have WCAG contrast at least 4.5:1; validate mathematically and via computed browser styles.
- Behavior: after Astro/Starlight in-app page navigation, Copy page and ChatGPT/Claude copy-before-open remain active; each action should fire once and copy the new page's Markdown, including subsequent navigations; no duplicate event handler wiring.
- CI: critical dialer-documentation-package suite retains existing tests/validate/translation and adds locked dependency prerequisite, preview build, and rendered test:browser IN SEQUENCE. Generated test-selection.registry.json must agree with rules; default browser port and temporary preview servers must cleanly shut down.
- Test-first: add browser assertions and contrast test against current CSS; assert docs rule includes prerequisite/build/browser in package test. Observe RED against current source. Then implement and rerun focused tests GREEN, full package/translation/validate, build/browser matrix, strict review and full verify.
- Existing patterns: scripts/test-browser.mjs Playwright suite and src/components/PageTitle.astro action script; packages/workspace/test-selection.rules.json explicit critical rule; packages/workspace/scripts/test-selection.js generator.
- No-test waiver: none. No Cloudflare deploy, production domain changes, main merge, OS source changes, carrier calls or billing.

- 2026-10-29 20:09:38 append: `.task/dialer/dev-1635-docs-interaction-accessibility-and-ci-gate/workpad.md`

## workspace-owned: files changed

- `packages/dialer-documentation/tests/accessibility-ci.test.ts`

## workspace-owned: activity log

- 2026-10-29 20:09:38 fs.write: `.task/dialer/dev-1635-docs-interaction-accessibility-and-ci-gate/workpad.md`
- 2026-10-29 20:10:51 write: `packages/dialer-documentation/tests/accessibility-ci.test.ts`
- 2026-10-29 20:10:51 fs.write: `packages/dialer-documentation/tests/accessibility-ci.test.ts`
- 2026-10-29 20:11:28 apply-patch: `packages/dialer-documentation/scripts/test-browser.mjs`
- 2026-10-29 20:12:37 fs.write: `.task/dialer/dev-1635-docs-interaction-accessibility-and-ci-gate/workpad.md`
- 2026-10-29 20:17:18 fs.write: `.task/dialer/dev-1635-docs-interaction-accessibility-and-ci-gate/workpad.md`

## Observed red evidence

- `bun test packages/dialer-documentation/tests/accessibility-ci.test.ts` RED (trc_854ff1c08ed9): light muted contrast 3.5717977362411375:1 (< 4.5), and missing locked-install/build/browser suites in critical docs rule.
- `DOCS_TEST_PORT=44255 DOCS_SITE_URL=https://docs-preview.example.test PUBLIC_DOCS_PREVIEW=1 bun run test:browser` RED (trc_68906bfbc939): after clicking sidebar to `/outbound/queues/`, replacing page actions as a client-side swap and dispatching `astro:page-load` twice, Copy page did not enter success state within 30 seconds. Fixture exercises repeat event idempotence and copy-before-open to ChatGPT/Claude without opening external URLs.
- Build prior to red browser test succeeded. Preview server terminated in `finally`; no deployment or live provider operation.

- 2026-10-29 20:12:37 append: `.task/dialer/dev-1635-docs-interaction-accessibility-and-ci-gate/workpad.md`

- 2026-10-29 20:12:56 apply-patch: `packages/dialer-documentation/src/components/PageTitle.astro`
- 2026-10-29 20:13:06 apply-patch: `packages/dialer-documentation/src/styles/docs.css`
- 2026-10-29 20:13:06 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-10-29 20:14:22 apply-patch: `packages/dialer-documentation/scripts/test-browser.mjs`

## workspace-owned: validation evidence

- 2026-10-29 20:14:36 `review.run`: passed — OK
- 2026-10-29 20:15:36 apply-patch: `packages/dialer-documentation/tests/accessibility-ci.test.ts`
- 2026-10-29 20:15:51 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-10-29 20:16:59 `review.run`: passed — OK
- 2026-10-29 20:18:09 `verify`: passed — OK

## Final validation and review evidence — 2026-10-29

- Test-first red reproduced: light muted `#8a817a` on paper `#faf7f2` 3.5717977362411375:1; critical docs CI did not select install/build/browser (trc_854ff1c08ed9). Browser actions failed after simulated Astro DOM swap (trc_68906bfbc939). Additional lifecycle CI regression red (trc_39dab34b38a6).
- Light-theme muted changed only to `#6b625c`; test computes WCAG sRGB luminance and validates at least 4.5:1 against `#faf7f2`. Browser test asserts actual computed CSS variable in rendered light mode.
- PageTitle binds action behavior with per-element WeakSet idempotence, executes setup on `astro:page-load`, and attaches one document-level outside-click close handler. New browser regression clicks an internal docs link, emulates page-actions DOM replacement, fires page-load twice, checks Copy page and ChatGPT/Claude copy-before-open, verifies new page Markdown copied and exactly one Markdown fetch per action. External action destinations prevented in test only.
- Critical docs rule retains Bun contracts, link validation and provider translation checks, adds locked Bun install before build, adds preview lifecycle pass/fail/occupied-port regression after build, then rendered `test:browser`. Generated `packages/workspace/test-selection.registry.json` with canonical `node packages/workspace/scripts/test-selection.js generate` (726 tests, 86 rules). Generated registry includes unrelated newly discovered test metadata only; no other source files modified.
- `bun run --cwd packages/dialer-documentation test`: 13 pass / 0 fail / 112 assertions; `test:translation` and `validate` (31 docs pages) passed.
- Preview build passed with `DOCS_SITE_URL=https://docs-preview.example.test PUBLIC_DOCS_PREVIEW=1`; rendered browser passed 30 pages, Chromium 7 viewports, WebKit short landscape, metadata, copied Markdown and language boundaries (trc_578fd242aad9). The fixture URL is not a deployed environment.
- Critical test-selection runtime `node packages/workspace/scripts/test-selection.js check --changed-file packages/dialer-documentation/src/components/PageTitle.astro --base origin/stream/dialer --run --json` selected all 8 critical/auto suites in correct sequence and passed 8/8, zero failures (trc_d02ce25a7b68); includes newly added lifecycle and rendered browser on an installed/build-prepared package.
- `review.run` strict found zero task-owned blockers; one pre-existing Nx target configuration note (`no projects with typecheck target found`). Remote `stream/dialer` confirmed `4e43344bdd35a0e819dc36dfc02dc31b8dab6820` and task merge-base matches; no unrelated OS files in task diff.
- No main merge, production deployment, domain reassignment, real calls or billing changes.

- 2026-10-29 20:17:18 append: `.task/dialer/dev-1635-docs-interaction-accessibility-and-ci-gate/workpad.md`
