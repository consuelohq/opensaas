# Refine Hermes-style responsive header and hero

branch: `task/consuelo-website/refine-hermes-style-responsive-header-and-hero`
stream: `stream/consuelo-website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1289/refine-hermes-style-responsive-header-and-hero
github pr: https://github.com/consuelohq/opensaas/pull/1289
started: 2026-06-30

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/public/images/consuelo-integrations-hero.svg`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-website/tests/site-header.test.mjs`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-30 17:40:18 `review.run`: passed — OK
- 2026-06-30 17:40:47 `verify`: passed — OK

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

## workspace-owned: test selection

- changed files: `.task/consuelo-website/refine-hermes-style-responsive-header-and-hero/current.json`, `.task/consuelo-website/refine-hermes-style-responsive-header-and-hero/session.json`, `.task/consuelo-website/refine-hermes-style-responsive-header-and-hero/workpad.md`, `.task/tasks/consuelo-website/refine-hermes-style-responsive-header-and-hero.json`, `packages/consuelo-website/public/images/consuelo-integrations-hero.svg`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/components/site/SiteHeader.astro`, `packages/consuelo-website/tests/site-header.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
