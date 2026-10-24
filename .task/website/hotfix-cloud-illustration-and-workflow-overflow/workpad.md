# Hotfix cloud illustration and workflow overflow

branch: `task/website/hotfix-cloud-illustration-and-workflow-overflow`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2606
started: 2026-09-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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

## Hotfix scope
- Remove both visible copies of the flawed holding-world figure from the Cloud footer.
- Keep the workflow chapter title and panel inside the available page width at desktop and tablet sizes.
- Use the current main-derived website source; preserve unrelated site content.

## Test-first contract
- Behavior under test: the Cloud footer contains no illustration or duplicate badge; the workflow chapter title fits its allocated column without horizontal clipping.
- Existing local pattern: `HomeCloudCta.astro` owns footer composition; `HomeFeaturePreview.astro` owns chapter grid and type scale; homepage responsive/mobile tests hold the old artwork contract.
- New or changed tests: update existing source/browser assertions that require the removed figure and badge; keep the remaining footer contract.
- Focused red command: waived by Ko's explicit request to skip checks for this immediate website hotfix.
- Expected red failure: current homepage responsive/mobile assertions require `.cloud-cta__art` and `.cloud-cta__badge`.
- No-test waiver: no new test file for this emergency presentation repair. Existing assertions will be aligned with the new presentation, with a bounded source/diff inspection in place of a local test run. Deployment's own build may still be required by the publishing path.

- 2026-09-29 17:53:23 append: `.task/website/hotfix-cloud-illustration-and-workflow-overflow/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 17:53:23 fs.write: `.task/website/hotfix-cloud-illustration-and-workflow-overflow/workpad.md`
- 2026-09-29 17:57:48 fs.write: `.task/website/hotfix-cloud-illustration-and-workflow-overflow/workpad.md`

## workspace-owned: files read

- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

- 2026-09-29 17:57:02 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
## Implementation and publish decision
- Removed the large holding-world image and its miniature footer badge from `HomeCloudCta.astro`; kept the footer copy, wordmark, link, version, and license.
- Rebalanced the feature chapter columns, reduced oversized display type, and stacked feature content at 1100px and below so the workflow heading stays within the page.
- Updated existing homepage responsive and browser-layout assertions for the removed artwork and tablet stacking.
- Diff inspection: only the two homepage components, two related test files, and task metadata changed. The unrelated dirty root checkout was not touched.
- Local test/review/verify gates: intentionally skipped because Ko requested an immediate hotfix deployment while sharing the site. The website deployment build and release status remain publish-path requirements.

- 2026-09-29 17:57:48 append: `.task/website/hotfix-cloud-illustration-and-workflow-overflow/workpad.md`
