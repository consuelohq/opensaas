# Unify floating dialer presentation and simplify calling options

branch: `task/dialer/unify-floating-dialer-presentation-and-simplify-calling-options`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2728
started: 2026-10-31

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior: trusted sidebar entry opens one parent-owned floating workspace with an acknowledged presentation-only launch; repeated snapshots/retries never activate calling or steal a minimized live owner. Untrusted origins/sources cannot acknowledge the launcher. Queue details and Calling options are separate navigable pages; Mercury exists only in Settings. Stable 75%-height window, consistent neutral surfaces, full-parent blurred backdrop, compact session preserved.
Existing patterns: protocol.ts exact parent validation, workspace-launch.ts action=open, parent single iframe owner, calling-workspace/view DOM tests and owned browser mock harness.
Tests: add native-launcher retry/ack unit tests, parent runtime acknowledgement/reuse/route survival tests, protocol trust tests, view option/details/navigation tests. Focused red: bun test packages/lead-connector/src/embed/{native-workspace,calling-workspace,click-to-call-runtime,protocol}.test.ts. Expect missing native launcher module and old header/collapsibles to fail. Geometry/colors validated in intercepted browser and safe signed-in Wet Stone smoke; no carrier/availability/payment actions.
Scope: preserve main 7a73d1fa billing work. UI/parent presentation only; no backend/OS/auth routing changes. No-test waiver: cosmetic tokens use browser geometry and screenshot validation, no implementation-mirroring CSS tests.

- 2026-10-31 03:10:35 append: `.task/dialer/unify-floating-dialer-presentation-and-simplify-calling-options/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 03:10:35 fs.write: `.task/dialer/unify-floating-dialer-presentation-and-simplify-calling-options/workpad.md`
- 2026-10-31 03:15:07 fs.write: `.task/dialer/unify-floating-dialer-presentation-and-simplify-calling-options/workpad.md`

## Evidence / implementation

DEV-1652. Red reproduced (missing launcher module + old collapsibles/header). Implemented acknowledged presentation-only native launcher with 4 bounded attempts; snapshots do not reopen after ack. Trusted parent/source validation remains pinned; one live iframe reused. Native route stays eligible while idle; admin fallback remains usable without parent support. Full-parent 8px blur clears on minimize. Stable desktop 75dvh (540px width) with short/mobile bounds. Queue-details/call-options pages, direct radio choices, consistent surfaces, Mercury only Settings. Radio draft identity includes value so focus belongs to the correct option.

Validation: 212 LeadConnector tests / 1640 assertions pass; tsc green; embed build green. Intercepted real Chrome harness /private/tmp/consuelo-calling-ui/floating-browser.mjs: parent auto-open/ack/native launcher, snapshots, queue/options navigation, option changes, 75% geometry (787.5/1050), light/dark surfaces, same page heights, live-state minimize/CRM navigation, 375x812 /568x320 /667x375 responsive, zero browser errors or unhandled requests. All HTTP intercepted; no calls/readiness/payment effects. New proof directory /private/tmp/consuelo-calling-ui/floating-refinement.

- 2026-10-31 03:15:07 append: `.task/dialer/unify-floating-dialer-presentation-and-simplify-calling-options/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 03:15:17 `review.run`: passed — OK
- 2026-10-31 03:15:27 `verify`: passed — OK
