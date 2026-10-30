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

- `packages/dialer-website/src/components/pricing/PricingIcon.astro`
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

- `packages/dialer-website/src/components/pricing/PricingIcon.astro`
- `packages/dialer-website/tests/pricing-catalog.test.ts`

## workspace-owned: activity log

- 2026-10-30 20:05:03 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 20:05:43 write: `packages/dialer-website/tests/pricing-catalog.test.ts`
- 2026-10-30 20:05:43 fs.write: `packages/dialer-website/tests/pricing-catalog.test.ts`
- 2026-10-30 20:07:14 write: `packages/dialer-website/src/components/pricing/PricingIcon.astro`
- 2026-10-30 20:07:14 fs.write: `packages/dialer-website/src/components/pricing/PricingIcon.astro`
- 2026-10-30 20:17:38 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`
- 2026-10-30 20:26:20 fs.write: `.task/website/rebuild-dialer-pricing-with-seats-feature-comparisons-and-add-ons/workpad.md`

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
