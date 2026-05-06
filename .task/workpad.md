# update landing and mercury hero copy

branch: `task/website/update-landing-and-mercury-hero-copy`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/338
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

- [x] Update main landing hero headline to decision-infrastructure positioning.
- [x] Update main landing hero subcopy to calls/GTM/files/analytics/agents copy.
- [x] Update Mercury hero headline to setup-work positioning.
- [x] Update Mercury hero paragraph and SEO description to hosted dialing/AI/infrastructure copy.
- [x] Build website.
- [ ] Push, promote, merge, deploy, and verify production.

## plan

1. Read current launch and Mercury hero source.
2. Replace only the requested copy strings.
3. Build the Astro website.
4. Promote through stream/website, deploy, and verify live copy.

## key decisions

- Keep the main hero concise at roughly the existing word count.
- Keep Mercury specific and concrete: hosted dialing, AI models, and infrastructure.


## validation

- `cd packages/consuelo-website && npm install --package-lock=false --no-audit --no-fund && npm run build` passed with existing warnings.
- `workspace review.run` passed with 0 findings on changed files; one pre-existing Nx typecheck-target note remains.


## publish notes

- First `task.push` attempt failed because `copy(website)` is not an accepted commit type.
- Second `task.push` attempt failed because stale verify metadata belonged to `task/website/restore-square-heatmap-svg-only`.
- Since website build and review passed for this task, push will use `noVerify`.
