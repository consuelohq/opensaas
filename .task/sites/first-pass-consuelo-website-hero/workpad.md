# first-pass consuelo website hero

branch: `task/sites/first-pass-consuelo-website-hero`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1248/first-pass-consuelo-website-hero
github pr: https://github.com/consuelohq/opensaas/pull/1248
started: 2026-06-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-website/src/lib/site-seo.ts`
- `packages/consuelo-website/src/pages/index.astro`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/consuelo-website/tests/website-structure.test.js`
- `packages/consuelo-website/public/images/consuelo-integrations-hero.svg`


## workspace-owned: files changed

- `packages/consuelo-website/public/images/consuelo-integrations-hero.svg`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/pages/index.astro`

## workspace-owned: activity log

- 2026-06-28 02:36:52 fs.write: `packages/consuelo-website/public/images/consuelo-integrations-hero.svg`
- 2026-06-28 02:37:11 fs.write: `packages/consuelo-website/src/pages/index.astro`
- 2026-06-28 02:37:52 fs.write: `packages/consuelo-website/src/components/home/HomeHero.astro`

## workspace-owned: validation evidence

- 2026-06-28 02:46:43 `review.run`: passed — OK

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
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/public/images/consuelo-integrations-hero.svg`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-website/src/lib/site-seo.ts`
- `packages/consuelo-website/tests/website-structure.test.js`

## workspace-owned: TDD red evidence

- 2026-06-28 02:36:25 `bun test packages/consuelo-website/tests/website-structure.test.js`: failed exit 1 trace: `trc_500352f66fea`
  - output: error: Script not found "task:exec"

- 2026-06-28 02:36:52 write: `packages/consuelo-website/public/images/consuelo-integrations-hero.svg`

- 2026-06-28 02:37:11 write: `packages/consuelo-website/src/pages/index.astro`

- 2026-06-28 02:37:52 write: `packages/consuelo-website/src/components/home/HomeHero.astro`

- 2026-06-28 02:38:31 apply-patch: `packages/consuelo-website/src/styles/tokens.css`
- 2026-06-28 02:38:56 apply-patch: `packages/consuelo-website/src/layouts/MarketingLayout.astro`

- 2026-06-28 02:44:03 apply-patch: `packages/consuelo-website/src/lib/site-seo.ts`
