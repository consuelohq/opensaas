# Build source-faithful interactive GHL Dialer demo and ship website

branch: `task/website/build-source-faithful-interactive-ghl-dialer-demo-and-ship-website`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2794
started: 2026-11-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-website/.gitignore`
- `packages/dialer-website/astro.config.mjs`
- `packages/dialer-website/package.json`
- `packages/dialer-website/scripts/materialize-public-assets.ts`
- `packages/dialer-website/src/pages/demo.astro`
- `packages/dialer-website/scripts/test-demo-browser.mjs`
- `packages/dialer-website/src/pages/demo/workspace.astro`
- `packages/dialer-website/src/scripts/demo/dialer-simulator.ts`
- `packages/dialer-website/tests/interactive-demo.test.ts`


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

## User-approved acceptance criteria
Build and ship an ungated, highly interactive `/demo` of the actual Consuelo dialer as used inside GoHighLevel (GHL). Research effective examples and use source-owned design and authentic layout; use only fully synthetic contacts and deterministic simulated call states. Show outbound multi-line selection/dial/pickup/call/disposition/CRM update, inbound call routing/answer, Mercury guidance and analytics if verified in source, with realistic operator interactions. No carrier, CRM, billing, auth, phone, or AI backend requests. Strong direct-to-pricing CTA and homepage cross-link, clear simulated status. Responsive including phone/tablet, accessible keyboard and reduced motion; capture screenshot/browser evidence. Confine changes to `packages/dialer-website` and tests. Strict review/verify, publish main-only isolated PR and Cloudflare Pages deploy. Preserve other agents, stream/website's unrelated billing changes and all existing customer data.

## Research evidence
- Navattic 2026 research: optimal flows 5-13 steps; highest completion 1-6, 2-3 aha moments; choose-own-adventure and ungated tours; 25-30 words per overlay. Source https://www.navattic.com/blog/best-practices-building-interactive-demos
- Nooks parallel dialing product pattern: choose cadence/line count, start calling, progress to live pickup and voicemail; draw conceptual inspiration without cloning Nooks proprietary UI. Source https://support.nooks.ai/articles/2435906474-parallel-dialing-explained
- User requires actual Consuelo GHL embed fidelity, not static mockup. Ground every meaningful control and status in `packages/lead-connector/src/embed` and verified runtime contracts, not competitor screenshots.

## Plan
1. Inspect actual lead-connector/GHL embed DOM/CSS, simulator/state machine, available safe first-party screenshots and frontend build. Inspect website `/demo` placeholder and marketing links.
2. Write executable red/green tests for isolated simulation, no external calls, expected stage transitions, browser interactions and CTA routes.
3. Implement production-ready demo route & reusable isolated component/styles, source-accurate dark/neutral GHL workspace, guided tips, optional paths and working simulated transitions.
4. Build, screenshot 1440/768/375, interaction/reduced-motion and security verification, formal review/verify, publish only website and live smoke.

## Test-first contract
behavior under test: `/demo` provides direct, coherent interactive simulation of the actual embedded Dialer (no login, no API calls or real dialing), with outbound/inbound choices, multi-line progress, connected call, safe dispositions and CTA; responsive and accessible.
existing local pattern: `packages/dialer-website/tests/landing-conversion.test.ts`, `scripts/test-marketing-browser.mjs`, `scripts/test-pricing-browser.mjs`; implementation must be grounded in `packages/lead-connector/src/embed/view.ts`, `styles.css`, `controller.ts` and state-machine.
new or changed tests: `packages/dialer-website/tests/interactive-demo.test.ts` and `scripts/test-demo-browser.mjs`, include fixture requests interception and representative viewports.
focused red command: `bun test packages/dialer-website/tests/interactive-demo.test.ts` (run before implementation).
expected red failure: existing `/demo` is a placeholder and lacks the real GHL dialer simulator and guided stage interactions.
no-test waiver: none.

## Scope and safety
- No source copying from Nooks or other competing product. Own dialer source is source of truth.
- No real GHL, Twilio, phone, recording or backend credentials; never make live calls from a publicly accessible marketing demo.
- Browser profile currently has an active SingletonLock; do not terminate/restart user's Chrome. Use isolated Playwright fixtures for screenshots until a safe read-only signed-in browser is available.
- `artifacts.generateDemo` work-order command failed because its local runtime references a missing DESIGN.md in ~/.consuelo/runtime; use canonical DESIGN.md + Astro repo source and formal site QA instead, without modifying design subsystem.

- 2026-11-08 15:29:20 append: `.task/website/build-source-faithful-interactive-ghl-dialer-demo-and-ship-website/workpad.md`

## workspace-owned: files changed

- `packages/dialer-website/scripts/test-demo-browser.mjs`
- `packages/dialer-website/src/pages/demo.astro`
- `packages/dialer-website/src/pages/demo/workspace.astro`
- `packages/dialer-website/src/scripts/demo/dialer-simulator.ts`
- `packages/dialer-website/tests/interactive-demo.test.ts`

## workspace-owned: activity log

- 2026-11-08 15:29:20 fs.write: `.task/website/build-source-faithful-interactive-ghl-dialer-demo-and-ship-website/workpad.md`
- 2026-11-08 15:30:22 write: `packages/dialer-website/tests/interactive-demo.test.ts`
- 2026-11-08 15:30:22 fs.write: `packages/dialer-website/tests/interactive-demo.test.ts`
- 2026-11-08 15:31:35 write: `packages/dialer-website/src/pages/demo/workspace.astro`
- 2026-11-08 15:31:35 fs.write: `packages/dialer-website/src/pages/demo/workspace.astro`
- 2026-11-08 15:32:14 write: `packages/dialer-website/src/scripts/demo/dialer-simulator.ts`
- 2026-11-08 15:32:14 fs.write: `packages/dialer-website/src/scripts/demo/dialer-simulator.ts`
- 2026-11-08 15:32:49 write: `packages/dialer-website/src/pages/demo.astro`
- 2026-11-08 15:32:49 fs.write: `packages/dialer-website/src/pages/demo.astro`
- 2026-11-08 15:34:20 apply-patch: `packages/dialer-website/tests/interactive-demo.test.ts`
- 2026-11-08 15:35:01 write: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:35:01 fs.write: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:35:25 apply-patch: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:35:35 apply-patch: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:35:48 apply-patch: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:37:21 apply-patch: `packages/dialer-website/src/pages/demo.astro`
- 2026-11-08 15:37:21 apply-patch: `packages/dialer-website/src/scripts/demo/dialer-simulator.ts`
- 2026-11-08 15:37:41 apply-patch: `packages/dialer-website/src/scripts/demo/dialer-simulator.ts`
- 2026-11-08 15:37:45 apply-patch: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:37:45 apply-patch: `packages/dialer-website/package.json`
- 2026-11-08 15:38:15 apply-patch: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:38:44 apply-patch: `packages/dialer-website/src/pages/demo/workspace.astro`
- 2026-11-08 15:38:44 apply-patch: `packages/dialer-website/tests/interactive-demo.test.ts`
- 2026-11-08 15:38:52 fs.write: `.task/website/build-source-faithful-interactive-ghl-dialer-demo-and-ship-website/workpad.md`

## Implementation and focused QA
- Created source-faithful simulated Dialer using the genuine `renderLeadConnectorEmbed` and `reduceEmbedState`/`createInitialEmbedState` from `packages/lead-connector/src/embed/`; actual first-party embed CSS/fonts/logo; fictional GHL CRM context only. No customer data or live authentication.
- `/demo` is now ungated public interactive experience: outbound choose-list/one-person, 1–3 lines, call options, auto simulated pickup, Mercury script cues, hang up and disposition with note, synthetic GHL pipeline update and call history; inbound browser readiness, synthetic offer/answer, hangup, disposition; Mercury standalone script view. Switch flows and restart. Direct-to-pricing CTAs.
- Real call widget code/CSS retained, rather than manually approximating it; GHL sidebar and cards are explicitly fictional because the shared signed-in browser profile is locked and no private GHL screenshot should be republished.
- Isolated iframe at `/demo/workspace/` with `Content-Security-Policy: connect-src 'none'`, no real data/actions/transports; noindex standalone stage. Same-origin postMessage control with event-origin/source checks. Client-side call state only.
- Real first-party font assets came from existing source `build-embed.ts` materializer. Bundled license notices for redistribution. No generated images.
- Focused contract was RED 0/4 against the old placeholder, then GREEN 4/4 after code (18 assertions); package unit tests GREEN 47/47 (323 assertions), Astro build 11 pages, 0 errors / 0 warnings / 7 existing hints.
- New Playwright end-to-end `scripts/test-demo-browser.mjs`: successful 1440 desktop, 768 tablet, 375 mobile; outbound answer/disposition, inbound answer/disposition, Mercury script, reset, no external frame network requests, CSP checks, no overflow. Screenshots under `/tmp/consuelo-dialer-interactive-demo/` on task Mac. Additional 1–3 line test now validates chosen fanout (2-line run).
- Added browser test into website `test:browser` CI script so formal verification covers the full demo. Preserved pricing checkout and server boundaries.
- Visual screenshot QA: source-derived floating window over fictional GHL board and concise step guide; corrected footer inherited-white background and call-count setting before final QA.

## Remaining gates
- Run final build and all package tests; strict `review.run` and full `verify` with `origin/main` base (async, do not repeat workers), then task.push, main-based PR #2794 exact file check, CI, merge and Cloudflare website-only deployment. No `task.pr` merge into billing-heavy `stream/website`.

- 2026-11-08 15:38:52 append: `.task/website/build-source-faithful-interactive-ghl-dialer-demo-and-ship-website/workpad.md`

## workspace-owned: validation evidence

- 2026-11-08 15:39:10 `review.run`: passed — OK
- 2026-11-08 15:39:15 apply-patch: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:39:21 `review.run`: passed — OK
- 2026-11-08 15:41:20 `verify`: passed — OK
- 2026-11-08 15:41:54 apply-patch: `packages/dialer-website/scripts/materialize-public-assets.ts`
- 2026-11-08 15:41:54 apply-patch: `packages/dialer-website/.gitignore`
- 2026-11-08 15:41:54 apply-patch: `packages/dialer-website/tests/interactive-demo.test.ts`
- 2026-11-08 15:42:13 apply-patch: `packages/dialer-website/astro.config.mjs`
- 2026-11-08 15:42:13 apply-patch: `packages/dialer-website/tests/interactive-demo.test.ts`
- 2026-11-08 15:42:38 `review.run`: passed — OK
- 2026-11-08 15:44:38 `verify`: passed — OK
- 2026-11-08 15:47:07 apply-patch: `packages/dialer-website/scripts/test-demo-browser.mjs`
- 2026-11-08 15:47:17 apply-patch: `packages/dialer-website/tests/interactive-demo.test.ts`
- 2026-11-08 15:47:27 `review.run`: passed — OK
- 2026-11-08 15:49:33 `verify`: passed — OK
