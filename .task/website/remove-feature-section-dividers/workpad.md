# Remove feature section dividers

branch: `task/website/remove-feature-section-dividers`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2615
started: 2026-09-29

## acceptance criteria

- [x] Remove decorative feature/evidence dividers while preserving FAQ boundaries.
- [x] Preserve the feature content and interactive demo.
- [x] Record the inherited change scope and subsequent combined-release validation.

## plan

1. Remove decorative borders from the feature chapter and evidence-caption selectors.
2. Preserve FAQ rules and content.
3. Include the change in the final validated website release.

## files changed

- HomeFeaturePreview.astro and FeatureEvidenceFigure.astro.

## key decisions

- Remove visual dividers from the feature story while keeping functional FAQ boundaries.
- The final shorter files/terminal/tools page supersedes the earlier six-chapter composition and preserves the divider removal.

## notes for ko

- The original task recorded a CSS-only no-test waiver. No earlier build/test run is claimed here.
- The combined release passed the website build (24 routes), complete browser regression including 568x320 and 667x375, strict review and full verification before stream promotion.

## improvements noticed

- Keep task-local acceptance and handoff sections current before publication.

## errors i ran into

- The inherited workpad was scaffold-only; this correction records source-supported facts and later release validation.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Feature section has no decorative horizontal rules above/between chapters or around Same Tools evidence caption; FAQ rules remain.
existing local pattern: Astro component CSS in HomeFeaturePreview.astro and FeatureEvidenceFigure.astro owns these borders.
new or changed tests: none.
focused red command: not applicable.
expected red failure: not applicable.
no-test waiver: CSS-only visual hotfix; user requested speed and skipped checks. Verify changed selectors and a production build rather than adding brittle implementation-mirroring tests.

- 2026-09-29 19:01:29 append: `.task/website/remove-feature-section-dividers/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 19:01:29 fs.write: `.task/website/remove-feature-section-dividers/workpad.md`
