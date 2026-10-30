# Rebuild Dialer pricing with seats feature comparisons and add-ons

branch: `task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2707
started: 2026-10-30

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-website/.gitignore`
- `packages/dialer-website/AGENTS.md`
- `packages/dialer-website/assets/encoded/consuelo-dialer-pricing-og-20261030.png.base64`
- `packages/dialer-website/BILLING-ECONOMICS.md`
- `packages/dialer-website/CLAIMS.md`
- `packages/dialer-website/COMPONENTS.md`
- `packages/dialer-website/DESIGN.md`
- `packages/dialer-website/package.json`
- `packages/dialer-website/public/images/technology/bun.svg`
- `packages/dialer-website/public/images/technology/cloudflare.svg`
- `packages/dialer-website/public/images/technology/github.svg`
- `packages/dialer-website/public/images/technology/hono.svg`
- `packages/dialer-website/public/images/technology/LICENSE.md`
- `packages/dialer-website/public/images/technology/postgresql.svg`
- `packages/dialer-website/public/images/technology/redis.svg`
- `packages/dialer-website/public/images/technology/SOURCES.md`
- `packages/dialer-website/public/images/technology/twilio.svg`
- `packages/dialer-website/scripts/generate-social-card.ts`
- `packages/dialer-website/scripts/materialize-public-assets.ts`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/scripts/test-pricing-browser.mjs`
- `packages/dialer-website/src/components/home/HomeFaq.astro`
- `packages/dialer-website/src/components/pricing/PricingAddons.astro`
- `packages/dialer-website/src/components/pricing/PricingComparison.astro`
- `packages/dialer-website/src/components/pricing/PricingIcon.astro`
- `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- `packages/dialer-website/src/data/dialer-content.ts`
- `packages/dialer-website/src/data/pricing-content.ts`
- `packages/dialer-website/src/pages/get-started.astro`
- `packages/dialer-website/src/pages/how-it-works.astro`
- `packages/dialer-website/src/pages/pricing.astro`
- `packages/dialer-website/src/styles/pricing.css`
- `packages/dialer-website/tests/marketing-contract.test.ts`
- `packages/dialer-website/tests/pricing-catalog.test.ts`

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria and scope
- Rebuild pricing only within packages/dialer-website using current blue/white editorial frame; preserve other agents and existing production domains.
- Starter free / 100 total trial minutes; Professional $99 / 1,000 minutes; Agency $149 and Enterprise $199 / 5,000 connected minutes per seat/month. Paid numbers proposed 3/10/30 and extra numbers $3/month. These are Ko's new launch targets, not current Stripe entitlements.
- Four compact plan columns; billing controls; inbound/outbound comparison filters and expandable sections/details; Mercury coaching, minute packs and number packs; sticky add-ons/FAQ labels; technology logos identified as infrastructure rather than customer proof; accessible original SVG symbols.
- Public draft copy uses the intended launch offering per Ko's request. Keep implementation gaps in CLAIMS.md and grouped Linear issues. MCP / enterprise identity can be marked coming soon. No invented testimonials, compliance certifications, specific unmeasured outcome claims or automatic purchases.
- Annual pricing: unanswered; use same effective rate x12 with explicit annual bill amount, no invented savings. Seat scope: assume one rep seat covers inbound and outbound; exact answer remains pending.
- New catalog remains in isolated noindex preview; do not change Stripe/backend plans or deploy to apex without reconciliation of entitlements.

## Plan / checklist
- [x] Read screenshots and pasted brief; current stream and main verified; #2651 already merged, domain cutover already shipped.
- [x] New managed task from main 8e0e2563; taskSession tsk_40a9f51608b3; PR #2707.
- [ ] Define catalog/pack economic model and inspect existing product capabilities.
- [ ] Write focused catalog and interaction tests, confirm red.
- [ ] Implement frame, columns, add-ons, comparisons, shared FAQ, logo strip, responsive design.
- [ ] Replace stale plan references in setup/metadata/share card within website.
- [ ] Add grouped launch gaps to Linear and map to claim ledger.
- [ ] Validate catalog maths, package build, browser desktop/mobile/short landscape/no-JS/reduced-motion, review/full verify.
- [ ] Publish through website stream and deploy isolated preview; verify actual HTTPS.

## Test-first contract
Behavior: stable plan and allowance values; annual total arithmetic; no arbitrage across $10/$50/$100 packs; plan links preserve selected offering; seat/motion and key-feature filters affect correct comparison rows; disclosure and keyboard states work; no horizontal document overflow at 320px and short landscape. Unknown query values are ignored, not injected.
Pattern: existing Bun marketing-contract + Node/Playwright owned fixture and explicit cleanup.
New tests: tests/pricing-catalog.test.ts; scripts/test-pricing-browser.mjs; update existing delivery/setup expectations.
Focused red: bun test packages/dialer-website/tests/pricing-catalog.test.ts before catalog implementation. Expected: missing approved catalog / helpers.
No test waiver: copy-only changes reviewed visually; interaction/math need tests.

## Discovery notes
- Explore index is stale (Sept23) and suggests removed twenty-server files. Reject those suggestions and inspect existing standalone dialer-server sources.
- Current server catalog still single/standard/power; shared included number count; higher-tier minutes null; no new marketing allowances assumed live.
- Current usage rounds each completed customer's connected seconds up to a minute. Provider costs have separate rep/customer legs and other fees. Model margins by topology, not one Twilio leg.

- 2026-10-30 20:05:03 append: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

## workspace-owned: files changed

- `packages/dialer-website/.gitignore`
- `packages/dialer-website/AGENTS.md`
- `packages/dialer-website/assets/encoded/consuelo-dialer-pricing-og-20261030.png.base64`
- `packages/dialer-website/BILLING-ECONOMICS.md`
- `packages/dialer-website/CLAIMS.md`
- `packages/dialer-website/COMPONENTS.md`
- `packages/dialer-website/DESIGN.md`
- `packages/dialer-website/package.json`
- `packages/dialer-website/public/images/technology/bun.svg`
- `packages/dialer-website/public/images/technology/cloudflare.svg`
- `packages/dialer-website/public/images/technology/github.svg`
- `packages/dialer-website/public/images/technology/hono.svg`
- `packages/dialer-website/public/images/technology/LICENSE.md`
- `packages/dialer-website/public/images/technology/postgresql.svg`
- `packages/dialer-website/public/images/technology/redis.svg`
- `packages/dialer-website/public/images/technology/SOURCES.md`
- `packages/dialer-website/public/images/technology/twilio.svg`
- `packages/dialer-website/scripts/generate-social-card.ts`
- `packages/dialer-website/scripts/materialize-public-assets.ts`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/scripts/test-pricing-browser.mjs`
- `packages/dialer-website/src/components/home/HomeFaq.astro`
- `packages/dialer-website/src/components/pricing/PricingAddons.astro`
- `packages/dialer-website/src/components/pricing/PricingComparison.astro`
- `packages/dialer-website/src/components/pricing/PricingIcon.astro`
- `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- `packages/dialer-website/src/data/dialer-content.ts`
- `packages/dialer-website/src/data/pricing-content.ts`
- `packages/dialer-website/src/pages/get-started.astro`
- `packages/dialer-website/src/pages/how-it-works.astro`
- `packages/dialer-website/src/pages/pricing.astro`
- `packages/dialer-website/src/styles/pricing.css`
- `packages/dialer-website/tests/marketing-contract.test.ts`
- `packages/dialer-website/tests/pricing-catalog.test.ts`

## workspace-owned: activity log

- 2026-10-30 20:05:03 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 20:05:43 write: `packages/dialer-website/tests/pricing-catalog.test.ts`
- 2026-10-30 20:05:43 fs.write: `packages/dialer-website/tests/pricing-catalog.test.ts`
- 2026-10-30 20:07:14 write: `packages/dialer-website/src/components/pricing/PricingIcon.astro`
- 2026-10-30 20:07:14 fs.write: `packages/dialer-website/src/components/pricing/PricingIcon.astro`
- 2026-10-30 20:17:38 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 20:26:20 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 20:30:11 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 20:54:45 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 20:57:59 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 21:01:02 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

## Implementation and focused evidence
- Focused red confirmed missing minutePacks export on old pricing-content.ts (trace trc_d11e23974dba). Green: 5 tests / 61 assertions; full package tests 19 / 176 assertions.
- Build: 10 static pages, 0 errors / 0 warnings, two inherited inline-script hints; independent frozen Bun install required in fresh task, no lock changes.
- Desktop 1440x1000 and phone 375x812 smoke pass: billing/annual amounts, valid and invalid team counts, motion/key-feature filtering, detail explanations, shared FAQ, setup selection/query safety, keyboard and no-JS fallback.
- First browser run caught lazy technology marks not loaded yet; explicitly eager-load/decode before image acceptance. Visual review caught missing sr-only primitive; added scoped accessible clipping rather than showing assistive labels in comparison cells.
- New pricing-only share card generated at 1200x630, encoded source retained. Existing home share card untouched.
- Source icons: Simple Icons 16.0.0, Twilio retained from 13.21.0; upstream CC0 license + source notice retained. Groq uses text, no invented third-party icon. Original Consuelo product SVGs.
- New grouped launch issues: DEV-1644 billing/catalog/economics; DEV-1645 Mercury; DEV-1646 analytics/number-health/admin; DEV-1647 security/enterprise identity. Existing DEV-1642/1643 ownership preserved.
- Linear default opensaas label is unavailable; first create failed without creating an issue. Retried with existing [task] label and all four issue creations verified.
- code.run nested fs.write for the 12KB catalog failed at wrapper command transport; recovered using task-scoped code.call semantic write, reread/build verified. No native repo tools used.
- Public annual discount and shared-seat scope remain draft assumptions; no discount invented. No live billing, calls or production domain changes.

- 2026-10-30 20:17:38 append: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

## workspace-owned: validation evidence

- 2026-10-30 20:18:05 `review.run`: passed — OK

## Release candidate evidence / review boundary
- Final product build: 10 pages, 0 errors / 0 warnings. All 20 package tests pass (179 assertions), including source-byte restoration of the new share card.
- Pricing browser: all eight sizes pass, including 320x568, 568x320 and 667x375. Billing amounts, invalid counts, filters, disclosures, FAQ exclusivity, keyboard, no-JS and image loading pass; no console errors. Fix: the comparison scroller must be a positioning boundary for absolute assistive labels.
- Full repository verify is pass/full/publishValid=true at 2026-10-30T20:24:19.197Z, including four suites and the full existing marketing browser runner. Strict review: zero changed-code issues or blockers; inherited missing Nx typecheck-target note is offset by package Astro check.
- A concurrent verifier build cleared dist during one additional pricing browser run. This was a validation fixture collision, not a deployed-page failure; final additional validation now runs sequentially after the verifier. Do not launch a dist-mutating build concurrently with these browser fixtures.
- Existing browser test had a navigation race after footer CTA click. Added waitForURL for the exact setup destination, preserving the acceptance assertion.
- OS status ignores top-level taskSession and returned the stale root checkout. Do not use its root status to stage or clean anything. Scoped code.call verified this exact managed task path and only intended package/task files; unrelated root changes are untouched.
- Existing stream review PR is #2683. Pricing source contains intended-launch claims and must remain preview/draft pending DEV-1644–1647; preserve existing stream work, no main merge or production deploy.
- Cloudflare auth confirmed; separate consuelo-dialer-website-preview Pages project exists, no Git integration. No custom-domain changes are needed.

- 2026-10-30 20:26:20 append: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

## Published preview / promotion pause
- Pushed exact app SHA cb4b90cb044251e6b029cb5bc3364887b2ca8d2c; local and remote task refs match. Own PR #2707 is explicitly draft.
- Final sequential receipt /tmp/consuelo-pricing-validation.json is complete/passed: all 20 tests, full 8-size pricing browser, full 8-size marketing browser, 65 internal-link assertions, empty browser stderr.
- Cloudflare deployment complete (exit0): https://d14d2f77.consuelo-dialer-website-preview.pages.dev/pricing/ . Stable project alias /pricing/ updated. Wrangler's dirty warning comes from task metadata after promotion attempt; app source was pushed and verified.
- Actual HTTPS pricing/setup/logo/share routes return200; noindex headers/meta confirmed; new share PNG equals reviewed built bytes.
- task.pr --draft failed with 405 / non-metadata conflicts. Read-only merge-tree identified only get-started.astro and scripts/test-marketing-browser.mjs (common base 7706be452f9bd98c392762178829191d32fddeae). Existing stream uses shared plan catalog + checks every plan; proposed resolution retains that coverage while extending to new plans/annual billing.
- Senior-engineer skill explicitly pauses code/test conflicts. Asked Ko to approve the concrete combination; do not infer approval from elapsed time. No merge worktree has been started or conflict sides discarded. Existing stream PR #2683 is untouched.

- 2026-10-30 20:30:11 append: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

## Approved integration — 2026-10-30
Ko explicitly approved: “Yes—combine, verify and promote.” Refresh confirmed remote stream at 933cd32a8b4e255310eb7a2b8beadc5ee0a2c5be and task at cb4b90cb044251e6b029cb5bc3364887b2ca8d2c. Only local change is this task's evidence workpad.

Resolution contract: preserve the stream's shared-catalog lookup and all-plan browser coverage, extended for four offers and monthly/annual billing. Retain the new quote arithmetic, validation and setup content. Merge stream into this task without changing another worktree or discarding either side. Product behavior remains the approved pricing contract already covered test-first; integration adds stronger coverage and reruns the same package/browser/full verify gates. No production deployment or billing mutation is authorized by this integration approval.

- 2026-10-30 20:54:45 append: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

### Integration test-first extension
The inherited setup unit test and browser runner assumed three plans and a removed subtitle field. Extend, rather than drop, their coverage to four catalog offers and both billing periods. The focused red run (trc_d1edd2fc181c) exposed a hardcoded Starter name in the new setup script: a catalog fixture named “Starter updated” still rendered “Starter”. Resolve by deriving Starter's name and allowance from the same catalog as paid plans. Keep hostile/unknown-plan checks and add exact quote-call/mailto assertions. All other lifecycle/motion/analytics tests remain intact.

- 2026-10-30 20:57:59 append: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

## Approved integration complete / publish evidence
- Merge commit 75f74d6e56965e511c2938f78ddff32d5030b6d5 preserves parents cb4b90cb044251e6b029cb5bc3364887b2ca8d2c and 933cd32a8b4e255310eb7a2b8beadc5ee0a2c5be. All existing DEV-1636 scrolling/cloud/analytics fixes and metadata were retained.
- Setup still uses the shared catalog; Starter now derives name/allowance from it too. Inherited catalog test was extended to 4 offers × 2 billing periods, including mutated names/prices, exact quote arguments, email subjects and hostile query values. Browser coverage checks all eight selection paths.
- Green: 24 package tests / 240 assertions; Astro check/build 10 pages / 0 errors / 0 warnings. Full verifier pass/full/publishValid=true for exact merge commit at 2026-10-30T20:59:32.253Z. Existing marketing browser runner checks eight selection paths plus BFCache, scrolling, bounded cloud motion and analytics lifecycle.
- Independent pricing browser rerun AFTER verifier completed: eight sizes pass, keyboard/no-JS/query/billing/team/filter/FAQ paths pass, empty stderr, owned resources closed. Receipt /tmp/consuelo-pricing-integration-validation.json is complete exit0.
- Workflow gap: task.push asserts local SHA equals remote and creates a single-parent API snapshot. It cannot publish an approved two-parent local merge while preserving ancestry. Use OS-scoped code.call solely to push this exact verified merge without force, then normal task.push for evidence and task.pr promotion. No native repo tools or other worktrees touched.
- Existing stream review #2683 has been converted to draft before promotion to preserve launch gates. User approved combine/verify/promote, not production publication or billing changes.

- 2026-10-30 21:01:02 append: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
