# tighten hero install controls

branch: `task/sites/tighten-hero-install-controls`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1264/tighten-hero-install-controls
github pr: https://github.com/consuelohq/opensaas/pull/1264
started: 2026-06-28

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

- none yet

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

- 2026-06-28 06:03:27 apply-patch: `packages/consuelo-website/src/styles/tokens.css`
- 2026-06-28 06:03:51 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-06-28 06:04:12 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-06-28 06:08:57 apply-patch: `packages/consuelo-website/DESIGN.md`