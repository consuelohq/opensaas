# w2 connect real footage

branch: `task/website/w2-connect-real-footage`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2341
started: 2026-08-31

## acceptance criteria

- [x] Replace CONNECT's temporary poster with the final real Consuelo screen recording.
- [x] Keep the raw Desktop recording untouched and derive web-safe media from it.
- [x] Preserve the full 2032:1192 frame with no cover-cropping.
- [x] Preserve muted inline loop playback and a poster-only reduced-motion fallback.
- [x] Verify focused source contracts, production build, and desktop/tablet/phone browser geometry.
- [ ] Publish the reviewed task into `stream/website`.

## plan

1. Extend the existing CONNECT evidence contract and prove it red against W1.
2. Derive the MP4/poster from the final raw take without touching the source.
3. Wire the media through typed homepage data and preserve the source aspect ratio.
4. Validate build and responsive/reduced-motion behavior in the workspace browser.
5. Review, verify, push, and promote into `stream/website`.

## files changed

- `packages/consuelo-website/public/media/home/connect-live-session-poster.webp`
- `packages/consuelo-website/public/media/home/connect-live-session.mp4`
- `packages/consuelo-website/src/components/home/FeatureEvidenceFigure.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/tests/website-structure.test.js`

## key decisions

- Use the actual final take as the evidence instead of a new illustration or fake product mockup.
- Remux the existing H.264 stream rather than re-encode it; the source is already web-sized at about 3.1 MB for 39.9 seconds.
- Preserve the native 2032:1192 frame with `object-fit: contain` instead of forcing the old temporary 4:3 crop.
- Use a 2.5-second derived WebP frame as the poster and reduced-motion state.

## notes for ko

- The Desktop master recording remains unchanged at `~/Desktop/Screen Recording 2026-08-31 at 17.39.04.mov`.
- This task targets `stream/website` only. It does not deploy production or merge the website stream to main.

## improvements noticed

- The task bootstrap only linked root/workspace `node_modules`; website-local Astro dependencies were missing in the task worktree. A local ignored symlink was added for validation only. The task bootstrap could eventually link package-local dependencies automatically.

## errors i ran into

- The installed ffmpeg does not include the `libwebp` encoder. Recovered by extracting a temporary PNG frame and converting it with the installed `cwebp`; the temporary PNG was removed.
- The first website build could not find `astro` because `packages/consuelo-website/node_modules` was absent from the task worktree. Recovered with an ignored symlink to the main checkout's package-local dependencies, then the build passed.
- The full `website-structure.test.js` currently has three unrelated stale assertions in the stream (hero copy, header navigation, and design-operator contract). The CONNECT-focused test is green; these unrelated failures were not changed in this task.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/AGENTS.md`
- `packages/consuelo-website/COMPONENTS.md`
- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/animations.md`
- `packages/consuelo-website/src/styles/primitives.css`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/consuelo-website/tests/website-structure.test.js`

## Acceptance criteria

- Replace CONNECT's temporary illustration poster with Ko's final real screen recording from `~/Desktop/Screen Recording 2026-08-31 at 17.39.04.mov`.
- Preserve the recording as product evidence: no fake UI, no generated imagery, no decorative overlay that obscures the session.
- Produce a web-safe H.264 MP4 plus a lightweight poster derived from the recording; keep the raw Desktop recording untouched.
- Show the entire captured browser frame without destructive cropping; size the evidence stage to the recording's native 2032:1192 aspect ratio.
- Keep autoplay muted/inline/loop behavior, but preserve the poster as the reduced-motion fallback.
- Keep the existing editorial figure metadata/caption treatment and responsive feature grid.
- Verify desktop, iPad, iPhone, and reduced-motion states in the workspace browser.
- Publish only to `stream/website` in this task; do not merge to main or deploy production unless separately requested.

## Plan

1. Lock a source contract for real CONNECT footage and fail it against the current temporary-poster implementation.
2. Remux/optimize the final raw take and derive a poster without modifying the raw source.
3. Wire the video/poster into typed homepage data and change the evidence stage to the source aspect ratio with `object-fit: contain`.
4. Run focused tests and production build, then live browser checks at desktop/tablet/phone/reduced-motion sizes.
5. Review, verify, push, and promote the task into `stream/website`.

## Test-first contract

behavior under test: CONNECT uses a real local product recording and derived poster, the media files exist in the public website bundle, the evidence component preserves the 2032:1192 source aspect ratio without cover-cropping, and reduced-motion still falls back to the poster.
existing local pattern: the existing `website-structure.test.js` CONNECT evidence contract from W1 plus `FeatureEvidenceFigure.astro`'s optional `videoSrc`/`posterSrc` support and reduced-motion CSS.
new or changed tests: extend the focused CONNECT evidence test to require `/media/home/connect-live-session.mp4`, `/media/home/connect-live-session-poster.webp`, exact public-file existence, source-native aspect ratio, `object-fit: contain`, and the current reduced-motion fallback.
focused red command: `bun test packages/consuelo-website/tests/website-structure.test.js -t "documentary evidence figure"` before production/media edits.
expected red failure: current W1 data has no `videoSrc`/`posterSrc`, the public media files do not exist, and the evidence stage is still 4:3 with `object-fit: cover`.
no-test waiver: not applicable; this is user-visible media/layout behavior.

- 2026-08-31 21:49:38 append: `.task/website/w2-connect-real-footage/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/public/media/home/connect-live-session-poster.webp`
- `packages/consuelo-website/public/media/home/connect-live-session.mp4`
- `packages/consuelo-website/src/components/home/FeatureEvidenceFigure.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/tests/website-structure.test.js`

## workspace-owned: activity log

- 2026-08-31 21:49:38 fs.write: `.task/website/w2-connect-real-footage/workpad.md`
- 2026-08-31 21:49:46 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-08-31 21:50:29 apply-patch: `packages/consuelo-website/src/data/home-content.ts`
- 2026-08-31 21:50:33 apply-patch: `packages/consuelo-website/src/components/home/FeatureEvidenceFigure.astro`
- 2026-08-31 21:54:18 apply-patch: `.task/website/w2-connect-real-footage/workpad.md`
- 2026-08-31 21:54:28 fs.write: `.task/website/w2-connect-real-footage/workpad.md`
- 2026-08-31 21:55:11 fs.write: `.task/website/w2-connect-real-footage/workpad.md`

## Implementation and validation status

- Source media: H.264, 2032x1192, about 39.9s, about 3.13 MB. The web MP4 is a fast-start remux of the original video stream, so there is no generational encode loss.
- Poster: WebP derived from the 2.5s frame, 20,570 bytes.
- Focused red: CONNECT documentary evidence test failed on the old 4:3 stage before production edits (`trc_d382949fab34`).
- Focused green: CONNECT documentary evidence test passes 1/1 with 40 assertions (`trc_9e60f8a5c387`).
- Production website build passes: Astro check 0 errors / 0 warnings / 24 existing hints; 24 pages built (`trc_0db84a686cd8`).
- Full website structure suite: 17 pass / 3 unrelated stale-contract failures already present on the stream. No failure is in the CONNECT evidence contract (`trc_34509ad08f1a`).
- Browser source: W2 dev server on `http://127.0.0.1:4324/` from the W2 task worktree.
- Desktop 1440x900: 3 feature columns, CONNECT media ratio 1.7048, native video reports 2032x1192, `object-fit: contain`, zero horizontal overflow. Video loads with readyState 4 and plays without media error when the figure is in view.
- iPad 1024x1366: 2 feature columns, CONNECT stage about 408x239, ratio 1.7048, zero horizontal overflow.
- iPhone 402x874: 1 feature column, CONNECT stage 346x203, ratio 1.7048, zero horizontal overflow.
- Reduced motion: media query is active, video computes to `display: none`, derived poster remains visible.
- Browser evidence screenshots:
  - desktop figure: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/w2-connect-desktop-final-2026-08-31T21-54-06.png`
  - iPad: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/w2-connect-ipad-live-2026-08-31T21-53-17.png`
  - iPhone: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/w2-connect-iphone-live-2026-08-31T21-53-26.png`

## Current status

Implementation and browser validation are complete. Next: workspace review, verify, push, and promote to `stream/website`.

- 2026-08-31 21:54:28 append: `.task/website/w2-connect-real-footage/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 21:54:54 `review.run`: passed — OK
- 2026-08-31 21:55:07 `verify`: passed — OK

## Final gates

- Strict mine-only review: 0 issues from this task, 0 blockers; one unrelated pre-existing Nx typecheck-target note remains (`trc_0079a0e26669`).
- Full task verifier: passed, publish-valid, no DB risks, no task-owned review findings (`trc_b7ad15f601a1`).

- 2026-08-31 21:55:11 append: `.task/website/w2-connect-real-footage/workpad.md`
