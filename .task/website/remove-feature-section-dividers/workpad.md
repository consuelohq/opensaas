# Remove feature section dividers

branch: `task/website/remove-feature-section-dividers`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2615
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
