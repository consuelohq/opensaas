# Fix trace table mobile scroll ownership

## Acceptance criteria
- Mobile trace modal long-pull scrolling should feel less choppy.
- Preserve desktop wheel behavior unless evidence shows a regression.
- Preserve mobile chrome: fixed top row with traffic dots, centered Traces, right clock.
- Preserve horizontal table behavior: Tool column pins, Time column scrolls away.
- Validate with browser tools on iPhone and desktop.

## Implementation plan
- The tracked task worktree does not contain the generated trace artifact source or the ignored `.od` archive state.
- Apply the approved runtime fix to the served Open Design archive artifact in the main worktree.
- Keep this workpad as evidence because the public route is served from ignored archive files, not from tracked repo source.

## Test-first contract
Behavior under test: mobile trace modal scroll ownership and sticky table behavior.
Existing pattern: browser-based validation against `https://sites.consuelohq.com/tracing`.
Changed tests: no tracked unit test is appropriate because the editable trace artifact source is not present in the task worktree and the live artifact is ignored archive output.
Focused red command: browser/DOM baseline before patch.
Expected red failure: current modal uses the fixed modal as the combined horizontal and vertical scroll container and installs a touchmove axis guard that can reset horizontal scroll during vertical pulls.
No-test waiver: generated/ignored live artifact hotfix; replaced by browser DOM/scroll-owner checks, JS syntax checks, and visual screenshots.

## Key decisions
- Choose native mobile scroll ownership over adding Lenis/GSAP touch physics.
- Do not hand-edit `packages/os/**`.
- Do not copy third-party library internals into the artifact.

## Validation log
- Pending.


## Implementation notes
- Patched the served Open Design archive artifact directly because the trace artifact source is ignored runtime state and absent from the task worktree.
- Changed mobile scroll model from fixed modal as combined x/y scroller to inner `.trxTableScroll` as the native x/y scroller.
- Removed the runtime call to the touch axis guard on coarse/touch devices by changing the touch fallback mode from `native-scroll-axis-guard` to `native-scroll`.
- Left desktop wheel smoothing path intact: `window.__traceGsapScroll.mode === "tight-wheel-only"` on desktop validation.

## Files changed outside tracked task worktree
- `/Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-mobile-scroll-fix-v9.css`
- `/Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-table-overview-v20.js`
- `/Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-gsap-scroll-v4.js`
- Backup directory: `/Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_nonrender_backups/scroll-ownership-20260626121545`

## Validation log
- Baseline browser check showed `#tbmLiveTraceModal.open` was both horizontal and vertical scroll owner: `overflow-x:auto`, `overflow-y:auto`, `scrollWidth:1620`, `clientWidth:402`.
- `node --check` passed for `trace-gsap-scroll-v4.js` and `trace-table-overview-v20.js`.
- CSS/JS markers verified: `trace-mobile-scroll-ownership-v11` exists once in the standalone CSS and once in embedded overview CSS.
- Mobile browser validation on iPhone preset:
  - URL: `https://sites.consuelohq.com/tracing?scrollFix=v11-final`
  - Modal: `overflow:hidden`, `scrollWidth:402`, `clientWidth:402`; fixed overlay no longer scrolls.
  - Inner table scroller: `overflow:auto`, `scrollWidth:1620`, `clientWidth:402`, `scrollHeight:5225`, `clientHeight:836`, `touch-action: pan-x pan-y`.
  - After programmatic scroll: `scrollTop:240`, `scrollLeft:300`.
  - Header stayed pinned: `.trxHead` y=38.
  - Tool stayed pinned horizontally: Tool x=0.
  - Time scrolled offscreen: Time x=-266.
  - Chrome stayed fixed: y=0, height=38.
- Programmatic scroll stress on iPhone preset:
  - 70 requestAnimationFrame samples.
  - 0 frames over 34ms.
  - max frame 13ms, average frame 7ms.
  - reached `scrollTop:3080`, `scrollLeft:360`.
- Desktop browser validation:
  - URL: `https://sites.consuelohq.com/tracing`
  - viewport 1440x900.
  - Desktop toolbar remains visible.
  - Desktop table scroller still scrolls x/y: `scrollLeft:300`, `scrollTop:240`.
  - GSAP mode remains `tight-wheel-only`.
- Screenshot evidence: `/tmp/opensaas-screenshots/tracing-iphone-v11-scroll-owner-2026-06-26T16-28-49.png`.

## Remaining risk
- Browser tool can prove DOM ownership, scroll positions, sticky behavior, and frame sampling. It cannot fully prove physical iPhone thumb feel; Ko should still check the long-pull gesture on device.
