# DEV-1636 fix dialer website lifecycle and analytics followups

branch: `task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2678
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/src/components/visuals/CloudField.astro`
- `packages/dialer-website/src/layouts/MarketingLayout.astro`
- `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- `packages/dialer-website/src/pages/get-started.astro`
- `packages/dialer-website/tests/interaction-lifecycle.test.ts`

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

## workspace-owned: files read

- `/tmp/consuelo-dialer-website-dev1636/home-568x320.png`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/src/components/site/CloudField.astro`
- `packages/dialer-website/src/components/visuals/CloudField.astro`
- `packages/dialer-website/src/layouts/MarketingLayout.astro`
- `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- `packages/dialer-website/src/pages/get-started.astro`
- `packages/dialer-website/src/pages/pricing.astro`
- `packages/dialer-website/tests/interaction-lifecycle.test.ts`

## Scope and current truth

DEV-1636 owns packages/dialer-website only. DEV-1618 section analytics is a canceled duplicate. Managed task starts from current remote main 7706be452f9bd98c392762178829191d32fddeae (main advanced since coordinator's 1e902f4); direct Docs navigation, permanent redirects, removed guides route and product sitemap are present. Stream orientation is e66e2c0804d06aecb3270459e73d90eb7cbd9877. Linear is in progress and task PR #2678 is attached. Parent coordinator owns main/release/live acceptance.

## Test-first contract

Behavior under test: persisted pagehide/pageshow preserves a usable Lenis instance and ScrollTrigger integration; terminal cleanup is idempotent and removes lifecycle listeners. Setup descriptions and mailto subjects resolve catalog entries, including changed catalog labels, while invalid query selections retain generic setup. Decorative cloud motion is finite and has no permanent will-change. Enabled-key inline section analytics waits for DOM readiness and captures each visible section once using one observer, without network traffic.

Existing local pattern: Bun test files and Playwright marketing browser gate in this package. New focused test tests/interaction-lifecycle.test.ts executes real transpiled source with controlled browser/dependency doubles; extend the existing browser script with actual lifecycle, catalog and animation checks plus an intercepted analytics fixture.

Focused red command: bun test packages/dialer-website/tests/interaction-lifecycle.test.ts. Expected red: persisted hide destroys Lenis; setup map ignores modified catalog values; cloud CSS loops forever; section registration occurs while head has no body. No-test waiver: none.

Plan: prove red, implement minimal package-only changes, run focused green, build/package suite/browser including 568x320 and 667x375, strict review/full verify, refresh remote state and task.push immediately followed by task.pr. Leave Linear in review pending coordinator integration.

- 2026-10-29 18:37:20 append: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`

## workspace-owned: files changed

- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/src/components/visuals/CloudField.astro`
- `packages/dialer-website/src/layouts/MarketingLayout.astro`
- `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- `packages/dialer-website/src/pages/get-started.astro`
- `packages/dialer-website/tests/interaction-lifecycle.test.ts`

## workspace-owned: activity log

- 2026-10-29 18:37:20 fs.write: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`
- 2026-10-29 18:37:46 write: `packages/dialer-website/tests/interaction-lifecycle.test.ts`
- 2026-10-29 18:37:46 fs.write: `packages/dialer-website/tests/interaction-lifecycle.test.ts`
- 2026-10-29 18:38:14 write: `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- 2026-10-29 18:38:14 fs.write: `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- 2026-10-29 18:38:14 write: `packages/dialer-website/src/pages/get-started.astro`
- 2026-10-29 18:38:14 fs.write: `packages/dialer-website/src/pages/get-started.astro`
- 2026-10-29 18:38:15 write: `packages/dialer-website/src/components/visuals/CloudField.astro`
- 2026-10-29 18:38:15 fs.write: `packages/dialer-website/src/components/visuals/CloudField.astro`
- 2026-10-29 18:38:15 write: `packages/dialer-website/src/layouts/MarketingLayout.astro`
- 2026-10-29 18:38:15 fs.write: `packages/dialer-website/src/layouts/MarketingLayout.astro`
- 2026-10-29 18:38:29 write: `packages/dialer-website/tests/interaction-lifecycle.test.ts`
- 2026-10-29 18:38:29 fs.write: `packages/dialer-website/tests/interaction-lifecycle.test.ts`
- 2026-10-29 18:39:28 write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-29 18:39:28 fs.write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-29 18:41:25 write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-29 18:41:25 fs.write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-29 18:42:23 fs.write: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`
- 2026-10-29 18:43:45 fs.write: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`
- 2026-10-29 18:45:08 fs.write: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`

## Implementation and focused evidence

All four pretests failed as expected (trc_75fb27bb8ca1). The fixture compiler was corrected to strip indented module imports after implementation introduced its catalog import; behavior assertions were unchanged. Focused green: 4/4, 43 assertions (trc_87125f809aad). Package suite: 18/18, 157 assertions (trc_2d29284415de). Build: 0 errors / 0 warnings / 2 existing inline-script hints (trc_b9e71923fbcc). Initial build found missing package-local Astro; bun install --frozen-lockfile succeeded without tracked changes (trc_ff2ef2942e57).

Changed site-smooth-scroll.ts preserves the same Lenis/ScrollTrigger instance across persisted hide, refreshes after persisted show, and removes listeners/ticker once on terminal cleanup. Setup script imports pricingPlans and resolves its code/name/price/subtitle. Cloud drift uses two alternate iterations, ends at its authored base transform, and drops permanent will-change. Section analytics installs one guarded observer after DOMContentLoaded (or immediately if ready), with a WeakSet protecting repeat entries.

Browser layout passed all eight sizes including 568x320 and 667x375. Initial expanded motion run timed out when a test's native jump competed with the preceding Lenis wheel interpolation. The harness now waits for the wheel interpolation to finish before the independent footer jump. Expanded smoke passes: two persisted cycles preserving scroll, real wheel movement after restore, finite cloud finish/no compositor hint, terminal Lenis cleanup, all three pricing-card/setup/mailto labels, invalid queries, fragment links, 62 internal links and enabled-key analytics fixture with one observer/two section captures/zero external requests (trc_a4502a7f63f0). Full browser gate will be rerun in final verify. Screenshot artifacts: /tmp/consuelo-dialer-website-dev1636. Task fs.read cannot read outside root (trc_cf2c277a7fe6); browser geometry/screenshots remain available to coordinator.

Diff inspected with git.diff (trc_4dbf87cd0caa; working-tree summary 6 package files, no changes outside website or scoped task evidence). No production/domain/auth/billing/WAF/runtime/carrier actions.

- 2026-10-29 18:42:23 append: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 18:42:39 `review.run`: passed — OK
- 2026-10-29 18:44:42 `verify`: passed — OK

## Prepublication status

Strict review passed with zero blocking issues (trc_c8652844a0e0). Current remote stream is still e66e2c0804d06aecb3270459e73d90eb7cbd9877 (trc_061d955d2241), so no shared source conflicts are pending before publication. Full verify is running asynchronously under run ca91f3ac613e2d9fe4a9050f374dfb85ce6adecc1fee7a8a85d3056fd8251c2d. Main 7706be4 includes an independent trace update that is preserved by this task's base.

- 2026-10-29 18:43:45 write: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`

## Final validation before publish

Full verify passed and wrote a publish-valid stamp (trc_b6ba66bfb62d). The critical dialer-website-package registry selected/passed all four suites: frozen dependency prerequisite, Astro build, delivery contracts, and full rendered browser contracts. Full browser rerun passed all eight sizes, including 568x320 and 667x375, plus the new lifecycle/cloud/analytics fixtures. Registry review found no blockers; its only pre-existing advisory is no Nx typecheck target for the independent package; package Astro check proved 0 errors/0 warnings. Focused/package tests separately pass 18/18 including the four new regressions, since existing registry delivery selection names marketing-contract.test.ts only. Shared registry changes are intentionally outside this lane.

Typed git.status ignored taskSession and reported primary checkout main. No primary changes were made. OS code.call in the managed task cwd confirmed only the six website files and scoped task metadata are dirty (trc_7b927a2b6d01). No release, deployment, main merge or runtime change is authorized in this lane. Worktree is retained pending coordinator integration.

Acceptance: package implementation and all local gates complete. Remaining: coordinator main integration, production deployment, and live website acceptance. Keep DEV-1636 in review until these are complete.

- 2026-10-29 18:45:08 append: `.task/website/dev-1636-fix-dialer-website-lifecycle-and-analytics-followups/workpad.md`
