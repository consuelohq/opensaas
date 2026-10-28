# Align OS header and pricing plan artwork

branch: `task/consuelo-website/align-os-header-and-pricing-plan-artwork`
stream: `stream/consuelo-website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1444/align-os-header-and-pricing-plan-artwork
github pr: https://github.com/consuelohq/opensaas/pull/1444
started: 2026-07-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-13 03:36:20 `review.run`: passed — OK
- 2026-07-13 03:37:36 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(consuelo-website): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Header ownership: `src/components/site/SiteHeader.astro`.
- Pricing layout ownership: `src/pages/pricing.astro`; plan data: `src/data/pricing-content.ts`.
- Requested art mapping uses existing numbered homepage feature assets: Free #4, Plus #2, Super #6, Ultra #3.
- Test-first contract: add DOM/source assertions for centered OS wordmark, clear pricing/header separation, and exact four-plan asset order before implementation.

## workspace-owned: test selection

- changed files: `.task/consuelo-website/align-os-header-and-pricing-plan-artwork/current.json`, `.task/consuelo-website/align-os-header-and-pricing-plan-artwork/session.json`, `.task/consuelo-website/align-os-header-and-pricing-plan-artwork/workpad.md`, `.task/tasks/consuelo-website/align-os-header-and-pricing-plan-artwork.json`, `packages/consuelo-website/src/components/site/SiteHeader.astro`, `packages/consuelo-website/src/data/pricing-content.ts`, `packages/consuelo-website/src/pages/pricing.astro`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
