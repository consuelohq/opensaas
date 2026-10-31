# Compact calling window and remove duplicate sidebar presentation

branch: `task/dialer/compact-calling-window-and-remove-duplicate-sidebar-presentation`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2730
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

Behavior: one compact stable 680px desktop calling window (short/mobile capped to viewport); caller ID/mode/lines use existing accessible pipeline-style single-choice menus with outside/Escape close and correct focus, eligibility and value persistence. Native runtime must start on lightweight launcher, never paint a full embedded form before parent handoff. Parent modern chrome set at creation, so no extra header flash. Backdrop click consumes event, hides idle panel or minimizes busy owner while retaining iframe/media; inside clicks leave window open. Late launch acknowledgment must respect prior minimize.
Existing patterns: renderCombobox/createCombobox, createCallingWorkspace initialization (new pure factory), native launcher ack/retries, parent runtime JSDOM tests and intercepted Chrome harness.
New tests: factory/sidebar-first-frame contract; configured caller-ID option assertion (also resolves DEV1653), menu focus/outsideclose/persistence, backdrop idle/active/inside interactions and late acknowledgment. Red command: bun test calling-workspace.test.ts click-to-call-runtime.test.ts commercial-ui.acceptance.test.ts (full package paths). Expected failures: missing factory, radio tiles still rendered, parent lacks backdrop handling/modern marker.
Cosmetic geometry no-test waiver: validate via intercepted real Chrome geometry/no-scroll fit across normal screens and responsive short-view scrolling rather than CSS-source assertions. Preserve auth/backend/Stripe and all parallel stream changes. No calls/readiness/payments; no new subagents.

- 2026-10-31 03:35:23 append: `.task/dialer/compact-calling-window-and-remove-duplicate-sidebar-presentation/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 03:35:23 fs.write: `.task/dialer/compact-calling-window-and-remove-duplicate-sidebar-presentation/workpad.md`
- 2026-10-31 03:39:46 fs.write: `.task/dialer/compact-calling-window-and-remove-duplicate-sidebar-presentation/workpad.md`
- 2026-10-31 03:43:20 fs.write: `.task/dialer/compact-calling-window-and-remove-duplicate-sidebar-presentation/workpad.md`

## Red/green and browser evidence

Red reproduced missing workspace factory, absent modern host/backdrop behavior, and menus failing outside-close. Implemented factory for native launcher-first runtime; immediate modern host; backdrop consumes outside click and preserves busy iframe via compact presentation; late launch ack reapplies minimized state. Menus reuse accessible combobox, close on outside/focus exit/Escape, preserve focus/selected value, and are destroyed before workspace repaint to avoid document listener leaks. Configured caller-ID option assertion also addresses DEV1653. Empty-string automatic selection kept as a real value.

216 package tests /1664 assertions + tsc + build pass. Intercepted Chrome: no native full calling form during boot/snapshots,680px stable shell; inbound/outbound/options/settings fit without scroll; menus outside/Escape/select/line-mode constraints persist; backdrop closes idle and minimizes live simulated authority; same iframe survives CRM navigation; fixed page geometry; light/dark;375x812,568x320,667x375 horizontal/vertical bounds; zero browser errors/unhandled requests. Normal Settings density reduced; longer records/editor pages retain bounded content scrolling. No calling/readiness/payment commands. Evidence /private/tmp/consuelo-calling-ui/compact-refinement/evidence.json. Final responsive cap regression rerun pending after mobile680px cap tweak.

- 2026-10-31 03:39:46 append: `.task/dialer/compact-calling-window-and-remove-duplicate-sidebar-presentation/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 03:39:55 `review.run`: passed — OK
Final responsive cap/browser pass: shell540x680; desktop inbound/outbound content480=scroll480, call-options/settings504=scroll504; all management roots678px height.375x812 child678px;568x320 child294px;667x375 child349px; no horizontal overflow. First measurement failure was a stale detached locator during snapshot DOM replacement (zero-height handle); harness now queries current DOM atomically through persistent body and rejects zero height. Final screenshots/evidence pass, no runtime errors or effects.
- 2026-10-31 03:43:20 append: `.task/dialer/compact-calling-window-and-remove-duplicate-sidebar-presentation/workpad.md`
- 2026-10-31 03:43:20 `verify`: passed — OK
