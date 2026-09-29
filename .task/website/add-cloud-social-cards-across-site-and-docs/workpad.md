# Add cloud social cards across site and docs

branch: `task/website/add-cloud-social-cards-across-site-and-docs`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2611
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

behavior under test: Home, pricing, changelog, and docs link previews share the existing blue social-card layout with subtle clouds; the words differ by page. The docs domain publishes a valid image reference.
existing local pattern: Homepage generator in `packages/consuelo-website/scripts/generate-social-card.ts`; marketing pages pass image props to `MarketingLayout`; Starlight docs override `Head.astro`.
new or changed tests: Assert each generated card is a valid 1200x630 PNG with blue background and page-specific metadata; verify built homepage, pricing, changelog, and docs metadata.
focused red command: Existing marketing page and docs metadata checks for cloud-card images before editing.
expected red failure: pricing/changelog use older generic images, docs has no og:image, and the card generator has no variant words/clouds.
no-test waiver: none.

- 2026-09-29 18:24:24 append: `.task/website/add-cloud-social-cards-across-site-and-docs/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 18:24:24 fs.write: `.task/website/add-cloud-social-cards-across-site-and-docs/workpad.md`
