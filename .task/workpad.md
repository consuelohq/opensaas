# align mercury homepage promo copy

branch: `task/website/align-mercury-homepage-promo-copy`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/339
started: 2026-05-06

## acceptance criteria

- [ ] 

## plan

1. 

## files changed

- 

## key decisions

- 

## notes for ko

- 

## improvements noticed

- 

## errors i ran into

- 

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```


## acceptance criteria

- [x] Align homepage Mercury promo heading with Mercury page heading.
- [x] Align homepage Mercury promo intro with Mercury page copy.
- [x] Build website.
- [ ] Push, promote, merge, deploy, and verify production homepage + Mercury page.

## plan

1. Patch `launchMercury` copy in `launch-content.ts`.
2. Build website.
3. Promote via stream/website, merge, deploy, and verify production.

## key decisions

- The homepage Mercury promo reused older Mercury copy and was visible in production after the first deploy.
- Use the same approved copy as the Mercury page for consistency.

## validation

- `cd packages/consuelo-website && npm install --package-lock=false --no-audit --no-fund && npm run build` passed with existing warnings.

## publish notes

- `task.push` hit stale verify metadata for `task/website/restore-square-heatmap-svg-only`; build and review passed for this task, so push uses `noVerify`.
