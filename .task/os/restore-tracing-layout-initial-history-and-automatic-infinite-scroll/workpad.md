# Restore tracing layout initial history and automatic infinite scroll

branch: `task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2465
started: 2026-09-13

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Restore the existing tracing UX: opening shows last persisted traces even after a day of inactivity; column header stays at the top and rows occupy the viewport; history loads automatically near the bottom on user scrolling without a Load older button; filtering and live prepends never recursively drain history. Preserve bounded live requests, hidden pause, authentication and backoff. No subagents; one CI review-comments round. Use existing trace-request-budget rendered-browser tests, adding actual geometry and aged-history cases. Expected red: status grid child displaces table header; button remains; aged initial snapshot omits persisted traces. Focused red command: existing OS test target with trace-request-budget suite after inspecting package config. No waiver.

- 2026-09-13 15:58:14 append: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-13 15:58:14 fs.write: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`
- 2026-09-13 16:07:52 fs.write: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`

## Implementation and evidence

Confirmed production grid bug: live status took 497px of a 565px pane; scroller only42px. Confirmed default history returns100raw rows but hides successful authentication.mcp rows, starving visible history after inactivity. Red rendered idle-history regression failed with header584px below pane top. Fixed by keeping status in footer count, removing Load older button, handling user scroll gestures including underfilled lists with one in-flight history request, failed-history15s cooldown, and preserving filter/live no-fetch behavior. Apply existing hidden-auth visibility rule in local history SQL beforeLIMIT; provide snapshot liveCursor watermark to avoid replaying hidden authentication backlog. 11 browser/stream regressions pass (58 assertions), including real SQLite250idlechecks, agedtooltrace and authfailure retained, initial live watermark253, actual header/row geometry, no button, sparse-scroll single-flight, stale searches, hidden pause and backoff. Screenshot /tmp/tracing-idle-fixed.png. User contract: preserve optimized logic, no subagents, one CI review-comments round.

- 2026-09-13 16:07:52 append: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`

## workspace-owned: validation evidence

- 2026-09-13 16:08:27 `verify`: passed — OK
