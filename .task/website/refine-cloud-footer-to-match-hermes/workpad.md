# refine cloud footer to match hermes

branch: `task/website/refine-cloud-footer-to-match-hermes`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1520/refine-cloud-footer-to-match-hermes
github pr: https://github.com/consuelohq/opensaas/pull/1520
started: 2026-07-15

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

- 2026-07-15 23:45:23 fs.write: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`
- 2026-07-15 23:46:42 fs.write: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`
- 2026-07-15 23:54:30 fs.write: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`
- 2026-07-15 23:55:23 fs.write: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`

## workspace-owned: validation evidence

- 2026-07-15 23:54:59 `review.run`: passed — OK
- 2026-07-15 23:55:12 `verify`: passed — OK

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

## Approved follow-up contract

- Continue from the prior `unify-brand-icons-and-refine-landing-interactions` work on `stream/website`.
- Match the Hermes footer composition more closely without copying unrelated branding.
- Bottom-left metadata becomes an aligned inline version label: `CONSUELO OS V0.10.3`.
- Bottom-right license block is right-aligned, uses normal/light weights, and sits beside a wider rectangular editorial badge rather than the square app icon.
- Reduce the oversized background `CONSUELO` wordmark and hide it on mobile.
- Start the fixed-footer artwork reveal earlier while preserving a smooth full reveal at the bottom.
- Keep the full character visible on mobile and preserve reduced-motion behavior.
- Validate with focused source/browser tests, website build, real local browser screenshots, and then publish through the same `stream/website` lifecycle.

## Discovery plan

1. Read the prior workpad and the current footer/reveal implementation.
2. Compare the CSS contracts with the supplied Hermes and Consuelo screenshots.
3. Add focused failing assertions for metadata alignment, badge geometry/typography, mobile wordmark visibility, and earlier reveal timing.
4. Implement the smallest coherent footer-composition change, then verify in a local browser matrix.

- 2026-07-15 23:45:23 append: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`

## Test-first contract

- Behavior under test: footer metadata matches the Hermes composition, the editorial badge is portrait-rectangular, mobile omits the background wordmark, and the character reveal is already visible before the final viewport begins.
- Existing local pattern: extend `homepage-responsive.test.mjs` for source contracts and `homepage-mobile-layout.test.mjs` for rendered geometry, computed typography, and scroll-progress behavior.
- New or changed tests: assert `CONSUELO OS V0.10.3`, right-aligned/light metadata, a `4 / 5` badge ratio, hidden mobile wordmark, and non-zero opacity with roughly 0.9 viewport of scroll remaining.
- Focused red commands: `bun test tests/homepage-responsive.test.mjs` and `node --test tests/homepage-mobile-layout.test.mjs` from `packages/consuelo-website`.
- Expected red failure: current footer has no version, centered 650-weight metadata, a square badge, a visible mobile wordmark, and a reveal distance too short to appear at the early checkpoint.

- 2026-07-15 23:46:42 append: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`

- 2026-07-15 23:47:07 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- 2026-07-15 23:47:07 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-07-15 23:48:20 apply-patch: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
## Implementation status

- [x] Bottom-left metadata is a single aligned `CONSUELO OS V0.10.3` line.
- [x] Bottom-right license metadata is right-aligned with weight 500.
- [x] Editorial badge uses a portrait `4 / 5` frame with a dedicated crop rather than the square app-icon presentation.
- [x] Desktop background `CONSUELO` is reduced from 22vw to 16vw and capped at 15rem.
- [x] Mobile hides the background wordmark and keeps the character artwork fully inside the viewport.
- [x] Reveal begins 1.2 viewport-heights before the bottom and uses a softer 1.5-power curve.
- [x] Reduced-motion behavior remains immediate and non-interpolated through the existing branch.
- [x] Local preview remains available at `http://127.0.0.1:3000/` in tmux window `opensaas-website-refine-cloud-footer-to-match-hermes-4c9f04dd:preview`.

## Files changed

- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- Task metadata and this workpad under `.task/website/refine-cloud-footer-to-match-hermes/`.

## Validation evidence

- Red phase: focused source and browser tests failed only on the absent version label and late reveal checkpoint.
- Green source test: `bun test tests/homepage-responsive.test.mjs` — 6 passed, 46 assertions.
- Green browser test: `node --test tests/homepage-mobile-layout.test.mjs` — 1 passed.
- Build: `bun run build` — Astro check reported 0 errors and the static build completed; pre-existing hints remain outside this task.
- Desktop browser at 1440x900: opacity is 0.125 with 0.9 viewport remaining and 1.0 at the bottom; badge ratio is 1.25; metadata weights are 500; right alignment is active; art is fully inside the viewport; horizontal overflow is 0.
- Mobile browser at 390x844: opacity is 0.125 with 0.9 viewport remaining and 1.0 at the bottom; background wordmark is hidden; title remains two lines; art spans top 388.25 to bottom 844; badge ratio is 1.25; metadata is aligned and nowrap; horizontal overflow is 0.
- Screenshot evidence:
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-footer-desktop-bottom-2026-07-15T23-51-14.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-footer-mobile-early-2026-07-15T23-52-37.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-footer-mobile-bottom-2026-07-15T23-52-57.png`

## Key decisions

- Reuse the existing editorial Consuelo mark but give the footer badge its own portrait frame and crop. The canonical square application icon remains unchanged.
- Preserve the fixed-footer architecture from the prior task and adjust only composition and reveal math.
- Keep footer interaction disabled until 98% reveal, even though visual opacity begins earlier.

## Issues and recovery

- The first `task.start` attempt supplied the stream name to `startFrom`; retried with the supported `startFrom: stream` value and created PR #1520 correctly.
- The first verification call used an unsupported `codeFileSource` field; retried with inline `code`.
- The shared headed browser daemon was stale; closed it once and reopened the local preview successfully.
- Reading a PNG through the text-oriented Mac reader produced binary output; subsequent visual validation used browser screenshots plus computed DOM geometry instead.

- 2026-07-15 23:54:30 append: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/website/refine-cloud-footer-to-match-hermes.json`, `.task/website/refine-cloud-footer-to-match-hermes/current.json`, `.task/website/refine-cloud-footer-to-match-hermes/session.json`, `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`, `packages/consuelo-website/src/components/home/HomeCloudCta.astro`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Publish gates

- Workspace review: passed with 0 issues from this task and 0 blocking findings. One pre-existing infrastructure note remains: no Nx project exposes a `typecheck` target; the package-level Astro check completed separately with 0 errors.
- Workspace verify: passed in full mode; DB guard found 0 risks; publish-valid stamp written to `.task/website/refine-cloud-footer-to-match-hermes/verify.json`.
- The verify registry selected zero automatic suites for these paths, so the focused source/browser suites and package build listed above are the explicit test evidence.

- 2026-07-15 23:55:23 append: `.task/website/refine-cloud-footer-to-match-hermes/workpad.md`
