# W1 connect evidence figure

branch: `task/website/w1-connect-evidence-figure`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2335
started: 2026-08-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- [ ] Replace CONNECT's decorative ultra-wide strip with a documentary evidence figure that can accept real product footage later without redesign.
- [ ] Use a 4:3 CONNECT evidence stage with HTML figure metadata/captioning and an explicit ChatGPT -> Codex -> Claude -> Cursor sequence.
- [ ] Keep the current `connect.svg` only as the temporary stage poster; do not generate or invent product screenshots.
- [ ] Make the feature grid 2 columns at iPad/tablet widths so evidence remains legible; keep 3 columns on wide desktop and 1 column on phones.
- [ ] Preserve the existing visual language: Hermes blue/white, Bodoni display, mono evidence metadata, no generic SaaS-card chrome.
- [ ] Move the private port-4323 preview to the W1 worktree and verify desktop/iPad/iPhone geometry plus Vite HMR.
- [ ] Do not weaken the Tailscale/Vite hostname boundary. The ChatGPT iOS in-app black screen should be treated separately unless server evidence shows a website request reached the Mac.

## Test-first contract

behavior under test: CONNECT renders a semantic evidence figure with a 4:3 media stage, agent-sequence metadata, and responsive feature-grid geometry that gives iPad/tablet widths two columns while preserving one column on phones and three on wide desktop.
existing local pattern: `website-structure.test.js` for source contracts plus `homepage-mobile-layout.test.mjs`/OS browser geometry for rendered responsive behavior.
new or changed tests: first update the focused product-panel source contract to require the CONNECT evidence figure, 4:3 ratio, ordered agent sequence, and tablet breakpoint; then use live OS-browser geometry as rendered proof.
focused red command: `bun test packages/consuelo-website/tests/website-structure.test.js -t "evidence"` after adding the assertions and before editing production components.
expected red failure: current panel renders every feature through generic `FeatureMedia` at `475 / 178`, has no semantic evidence figure/agent sequence, and remains three columns at 1024px.
no-test waiver: not applicable; this is user-visible layout and component behavior.

## Black-screen observation

- At 17:03, the W0 Astro process was healthy and both localhost and the Tailscale URL returned HTTP 200, but the dev-server request log shows no request from the user's phone around that attempt. That strongly points to the ChatGPT iOS in-app webview/network path rather than a page render crash. Keep the private preview unchanged; ask Ko to open the URL in Safari/Tailscale after W1 is running.

- 2026-08-31 21:05:21 append: `.task/website/w1-connect-evidence-figure/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-31 21:05:21 fs.write: `.task/website/w1-connect-evidence-figure/workpad.md`
- 2026-08-31 21:11:56 fs.write: `.task/website/w1-connect-evidence-figure/workpad.md`

## Implementation status

- Added `FeatureEvidenceFigure.astro` as the CONNECT-specific documentary figure. It is 4:3, semantic `<figure>/<figcaption>`, keeps the existing `connect.svg` as a temporary poster, and already supports an optional real `videoSrc` without another component redesign.
- CONNECT metadata is HTML: FIG. 01, one-workspace/four-agents context, ordered ChatGPT -> Codex -> Claude -> Cursor sequence, and an editorial caption.
- Changed the feature grid breakpoint so 1024px/iPad renders 2 columns; <=580px remains 1 column; wide desktop remains 3 columns.
- Left the other five feature media strips unchanged intentionally. W1 is a vertical-slice comparison before deciding whether 4:3 becomes the site-wide evidence format.

## Validation evidence

- Test-first red: `bun test packages/consuelo-website/tests/website-structure.test.js -t evidence` failed because `FeatureEvidenceFigure.astro` did not yet exist.
- Focused green: same source-contract test passes 1/1 with 35 assertions.
- Production build: `bun run build` passes; Astro check reports 0 errors / 0 warnings / 24 existing hints and 24 pages build successfully.
- The existing Playwright mobile integration could not execute because the local Playwright Chromium headless-shell binary is absent. This is a test-environment dependency issue, not a product failure; no global browser install was performed. The syntax collision introduced while extending that test was fixed before final validation.
- OS browser live proof over the private Tailscale URL:
  - 1440x1000 desktop: 3 columns, CONNECT stage ~366x274, ratio 1.333, ordered four-agent sequence, zero horizontal overflow.
  - 1024x1366 iPad: 2 columns, CONNECT stage ~408x306, ratio 1.333, zero horizontal overflow.
  - 402x874 phone: 1 column, CONNECT stage ~346x260, ratio 1.333, sequence strip fits, zero horizontal overflow.
- W1 Astro/HMR is live in tmux `opensaas-website-w1-connect-evidence-figure-3f275bb1` on `127.0.0.1:4323`; the same tailnet-only URL remains `https://picassos-mac-mini.tail38ed59.ts.net:4323/`.

## Black-screen finding

- When Ko saw a black screen inside ChatGPT iOS, the Astro process and both localhost/Tailscale HTTP paths were healthy, but the dev-server request log showed no corresponding phone request. Evidence therefore points to the ChatGPT in-app browser/network path failing before it reached the Mac, rather than the website returning a black page. Preferred next check is opening the same tailnet URL directly in Safari while Tailscale is connected.

## Current comparison artifact

- CONNECT is intentionally taller than the remaining five cards because it is the only 4:3 evidence figure in W1. On wide desktop, row 1 therefore has extra whitespace beneath the two legacy strip cards. Do not normalize the remaining five until Ko evaluates this in-context comparison.

- 2026-08-31 21:11:56 append: `.task/website/w1-connect-evidence-figure/workpad.md`

## workspace-owned: validation evidence

- Test-first red: `bun test packages/consuelo-website/tests/website-structure.test.js -t evidence` failed because `FeatureEvidenceFigure.astro` did not yet exist.
- Focused green: same source-contract test passes 1/1 with 35 assertions.
- Production build: `bun run build` passes; Astro check reports 0 errors / 0 warnings / 24 existing hints and 24 pages build successfully.
- The existing Playwright mobile integration could not execute because the local Playwright Chromium headless-shell binary is absent. This is a test-environment dependency issue, not a product failure; no global browser install was performed. The syntax collision introduced while extending that test was fixed before final validation.
- OS browser live proof over the private Tailscale URL:
  - 1440x1000 desktop: 3 columns, CONNECT stage ~366x274, ratio 1.333, ordered four-agent sequence, zero horizontal overflow.
  - 1024x1366 iPad: 2 columns, CONNECT stage ~408x306, ratio 1.333, zero horizontal overflow.
  - 402x874 phone: 1 column, CONNECT stage ~346x260, ratio 1.333, sequence strip fits, zero horizontal overflow.
- W1 Astro/HMR is live in tmux `opensaas-website-w1-connect-evidence-figure-3f275bb1` on `127.0.0.1:4323`; the same tailnet-only URL remains `https://picassos-mac-mini.tail38ed59.ts.net:4323/`.
- 2026-08-31 21:12:14 `review.run`: passed — OK
- 2026-08-31 21:12:23 `verify`: passed — OK
