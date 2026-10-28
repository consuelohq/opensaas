# rebuild Consuelo website header

branch: `task/consuelo-website/rebuild-consuelo-website-header`
stream: `stream/consuelo-website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1274/rebuild-consuelo-website-header
github pr: https://github.com/consuelohq/opensaas/pull/1274
started: 2026-06-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-website/tests/site-header.test.mjs`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-28 18:22:30 `review.run`: passed — OK
- 2026-06-28 18:25:53 `review.run`: passed — OK
- 2026-06-28 18:37:55 `review.run`: passed — OK

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
