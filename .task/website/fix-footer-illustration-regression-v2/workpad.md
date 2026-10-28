# fix footer illustration regression v2

branch: `task/website/fix-footer-illustration-regression-v2`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1825/fix-footer-illustration-regression-v2
github pr: https://github.com/consuelohq/opensaas/pull/1825
started: 2026-08-10

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

- 2026-08-10 04:01:47 `review.run`: passed — OK
- 2026-08-10 04:01:48 `review.run`: passed — OK
- 2026-08-10 04:01:55 `verify`: passed — OK

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria
- Match the supplied target screenshot's line-art treatment: hand/face/neck/inner garment white where intended, but no broad white arm/chest/torso flood.
- Preserve blue outer-robe/arm/globe detail and the current footer composition.
- Do not regress narrow-phone hero no-overflow behavior.
- Bump the production artwork cache key again.
- Ship through stream/website -> main -> Cloudflare and visually verify the live iPhone-like footer before completion.

## discovery
- Current production screenshot supplied by ko shows a severe regression: the previous tight-fill pass created one broad white mass from the outstretched forearm through upper arm/chest/torso.
- Target screenshot supplied by ko is the visual source of truth; prior pixel-density thresholds were insufficient because they sampled coarse boxes rather than validating the silhouette/connected white regions.
- Investigate both explicit semantic masks and automatic enclosed-region fill; do not assume the media renderer is at fault without reproducing it.

## Test-first contract
- Add a regression that detects oversized connected white components intersecting the forearm/chest/torso zone, not just average white density in coarse boxes.
- Keep positive assertions for intended white hand/inner garment and blue globe/outer robe.
- Focused red command: bun test tests/footer-art.test.mjs against current main-derived output; expected failure is an oversized white connected component crossing arm/chest/torso.
- No-test waiver: none.

## implementation status
- Confirmed the production/main source was still the old smooth-fill generator: broad body/arm/forearm underlay mask, cache key `20260810-smooth-fill`. The previous task's working-tree fix was never committed/pushed before promotion, so the claimed tight-fill release did not actually reach main.
- New regression measures connected white components. Current bad generator failed with one component containing 83.49% of all white pixels; the supplied target screenshot measures about 26.49% for its largest white component.
- Reworked the generator around a white-underlay model: explicit hand/sash white regions sit underneath the original blue Potrace ink, so blue detail is never erased. The old body/arm mask is now an exclusion mask for automatic enclosed fills rather than a white-fill source.
- Renamed `holding-world-body-fill-mask.svg` to `holding-world-auto-fill-exclusion-mask.svg`; no broad body underlay or ink-whitening path remains.
- Fixed output largest white component is 23.08% of all white pixels, close to the supplied target's 26.49% and far from the broken 83.49% output.
- Cache key bumped to `20260810-line-art-v2`.
- Focused validation green: footer-art 5/5, responsive 8/8, mobile layout 1/1. Production build: 0 errors / 0 warnings / 24 existing hints.
- Local iPhone-like 402x874 render uses the new cache key, natural art 1832x2064, footer art fits the viewport, and document horizontal overflow is 0.

## shipping guard
- Do not repeat the previous lifecycle mistake. Explicitly run task.push and verify the pushed task SHA contains the website diffs before task.pr. After promotion, verify the stream PR head/tree contains the same website diffs before merging to main.
