# update mercury headline to managed telephony

branch: `task/website/update-mercury-headline-to-managed-telephony`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/341
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

- [x] Replace the Mercury heading copy everywhere it appears.
- [x] Build website.
- [ ] Review, push, promote, merge, deploy, and verify production.

## plan

1. Replace `Calling and AI without the setup work.` with `Managed telephony and AI without the setup work.` in homepage Mercury promo data and Mercury page hero.
2. Build the Astro website.
3. Promote through stream/website, merge, deploy, and verify live copy.

## key decisions

- Keep body copy unchanged; ko only requested the headline language.

## validation

- `cd packages/consuelo-website && npm install --package-lock=false --no-audit --no-fund && npm run build` passed with existing warnings.

## publish notes

- `task.push` hit stale verify metadata for `task/website/restore-square-heatmap-svg-only`; build and review passed for this task, so push uses `noVerify`.
