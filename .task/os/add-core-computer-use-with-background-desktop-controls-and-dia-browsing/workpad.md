# Add core computer use with background desktop controls and Dia browsing

branch: `task/os/add-core-computer-use-with-background-desktop-controls-and-dia-browsing`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2811
started: 2026-11-18

## acceptance criteria

- One discoverable core tool, computer.use, with background desktop refs, opt-in headed input, and isolated browser automation. Preserve existing browser tools.
- Exercise installed Agent Desktop on the Mac. Report measured Dia support for the existing session and for isolated web automation.
- Ship a small Senior Engineer skill note, focused tests, generated contracts, strict review, full verification, and reviewed PR.

## Test-first contract

- Follow the typed facade, Effect provider process, and core manifest patterns. Pass text by stdin to desktop input. Keep desktop content out of tool execution traces.
- Test default background input, explicit headed mode, surface-specific refs and inputs, scoped browser lifecycle, and provider failures through the facade.
- Red command: run the OS Vitest computer-use suite. Expect the new service and schema to be missing.

## plan

1. Measure the upstream binaries and Dia on this Mac. Build the tool against the observed CLI contract, verify on a disposable page, then publish and handle review.

## files changed

- OS utility registration, typed facade, provider process adapter, Dia launcher, manifests, locked runtime packages, privacy tests, tool reference and Senior Engineer guidance.

## key decisions

- A single computer.use facade uses Agent Desktop 1.3.1 and Agent Browser 0.43.0. Browser sessions default to headless Dia on supported Macs. UI targets use provider refs. Desktop fill and browser fill pass text through stdin. The OS records execution metadata for computer use and containing batches.
- Each browser session uses an OS-owned profile. Existing personal Dia sessions stay separate. Dia uses a 1280 by 800 viewport to make ref clicks actionable. Chromium supports durable web sign-in across launch modes.

## notes for ko

- Tested on macOS arm64 with Dia 1.57.1. The isolated browser opened a loopback fixture, snapshotted it, filled a field, clicked a link with server-observed delivery, saved a screenshot and rejected a mode change until close. Chromium retained a synthetic sign-in through a headed-to-headless restart.
- Agent Desktop reported granted Accessibility and returned refs for the running Dia menu bar. Its window snapshot reported renderer accessibility activation was unsupported on this build. Agent Browser handles web content inside the dedicated profile.

## improvements noticed

- Retest Dia sign-in across restarts when its browser-context behavior changes.

## errors i ran into

- Test-first red reproduced the missing service, then 798 focused tests passed across six suites. The direct Dia executable timed out because its DevToolsActivePort is nested. The launcher accounts for that layout.
- Dia lost page authentication across restarts in the disposable fixture, including when upstream reported a restore. The shipped path uses native profiles without exporting session state.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-11-18 21:39:26 apply-patch: `.task/os/add-core-computer-use-with-background-desktop-controls-and-dia-browsing/workpad.md`
- 2026-11-18 21:41:17 apply-patch: `packages/os/tests/computer-use.test.ts`

## workspace-owned: validation evidence

- 2026-11-18 21:48:03 `review.run`: passed — OK
- 2026-11-18 21:48:38 `review.run`: passed — OK
- 2026-11-18 21:57:03 `review.run`: passed — OK
- 2026-11-18 22:00:10 `review.run`: passed — OK
- 2026-11-18 22:05:34 `review.run`: passed — OK
- 2026-11-18 22:08:30 `review.run`: passed — OK
- 2026-11-18 22:11:20 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
