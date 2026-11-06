# Polish dialer inbound outbound and compact settings navigation

branch: `task/dialer/polish-dialer-inbound-outbound-and-compact-settings-navigation`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2771
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`

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

## Test-first contract — 2026-11-05

Behavior under test: compact, consistent Consuelo Dialer overlay navigation and option selection without changing telephony/session lifecycle. Inbound Home presents mutually exclusive Web vs Cell phone choice; selecting either persists exactly one usable endpoint. Outbound Choose list/One person tabs have one underline, a plain Select a pipeline stage placeholder (no em dashes), no redundant empty-state hint, and Calling options immediately above Start calling. Inbound Queue details shares Calling options icon/layout and anchored placement. Settings landing drops its subtitle. Phone numbers Receive calls/Call from uses the same understated text-tab treatment as Inbound/Outbound. Settings inner pages and Queue details/Calling options use compact left subtle breadcrumb + right title on same line, omit redundant headings and subtitles.

Existing local tests: packages/lead-connector/src/embed/{view.test.ts,calling-workspace.test.ts,inbound-operator.test.ts,workspace-dom.test.ts} and styles.css/ workspace-pages.ts. Existing renderer: view.ts, inbound-operator-view.ts, workspace-pages.ts; interaction controller in internal-main.ts.

New/changed tests: add assertions for inbound mutual exclusion through real click handler and endpoint API contract; renderer tests for placeholder, no redundant hint, pinned elements and icon; DOM/style contract tests for exactly one active underline, compact breadcrumb header and unified phone number tabs. Use focused red before edits.

Focused red command: bun test packages/lead-connector/src/embed/view.test.ts packages/lead-connector/src/embed/calling-workspace.test.ts packages/lead-connector/src/embed/inbound-operator.test.ts packages/lead-connector/src/embed/workspace-dom.test.ts
Expected red: legacy 'This browser'/'My phone' checkbox selection, redundant page subtitle, double active tab underline, em dash placeholder, or missing compact breadcrumb assertions fail against current stream.

Scope/safety: edit only packages/lead-connector embed views/styles/related tests. Preserve parallel task work and backend behavior, no calls, no phone purchases, no recording/transcription, no migration, no main merge or production deploy. Validate focused tests, package tests, TS/build, strict review and formal verify. Publish through stream/dialer task PR #2771; keep release approval separate.

- 2026-11-06 02:43:01 append: `.task/dialer/polish-dialer-inbound-outbound-and-compact-settings-navigation/workpad.md`

## workspace-owned: files changed

- `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`

## workspace-owned: activity log

- 2026-11-06 02:43:01 fs.write: `.task/dialer/polish-dialer-inbound-outbound-and-compact-settings-navigation/workpad.md`
- 2026-11-06 02:44:44 fs.write: `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`
- 2026-11-06 02:48:40 fs.write: `.task/dialer/polish-dialer-inbound-outbound-and-compact-settings-navigation/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/src/application.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/internal-main.ts`

- 2026-11-06 02:44:44 write: `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`

- 2026-11-06 02:45:13 apply-patch: `packages/lead-connector/src/embed/inbound-operator-view.ts`
- 2026-11-06 02:45:35 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-11-06 02:46:01 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-11-06 02:46:29 apply-patch: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-06 02:46:40 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-11-06 02:46:40 apply-patch: `packages/lead-connector/src/embed/calling-workspace.test.ts`
- 2026-11-06 02:48:02 apply-patch: `packages/lead-connector/src/embed/view.ts`

## workspace-owned: validation evidence

- 2026-11-06 02:48:32 `review.run`: passed — OK
- 2026-11-06 02:49:04 `verify`: passed — OK

## Implementation and test evidence — 2026-11-05

- Preserved other agents in a new managed stream/dialer task (tsk_efc5cd1f7411, PR #2771). No main merge, production deployment, carrier calls, billing changes or browser-session modification.
- Test-first red: newly added compact-workspace-polish.test.ts ran against unmodified source: 0 pass / 5 fail for dual-active checkboxes, dashed queue placeholder, missing anchored action group, missing compact breadcrumb title and mismatched phone-purpose tabs.
- UI: mutually exclusive radio selection with Web / Cell phone labels, legacy dual-active snapshot normalization, and both readiness handler paths sending one selected endpoint; no backend call lifecycle changes.
- Outbound: removed redundant idle queue hint and em-dash placeholder; one active tab underline; Calling options placed in same bottom anchored group immediately above Start calling.
- Inbound: Queue details gets gear icon and same bottom pinned action group above Start receiving calls.
- Settings index and all inner settings, Calling options and Queue details: existing back link becomes subtle left breadcrumb, right-aligned h1 on same line; redundant secondary headings and subtitles removed. Phone number Receive calls/Call from tabs reuse outbound setup-tab classes.
- Focused green: 46 tests / 275 assertions across five embed suites; full LeadConnector: 248 passed, 0 failed, 1888 assertions; package typecheck and production embed build green; git diff --check clean.
- Isolated headless Chromium 352x640 dark theme visual QA (no user browser): inbound footer options at top 477-519 then primary top 531; outbound at 475-517 then primary top 529; settings breadcrumbs at y78-106, titles y82-102 to right edge x332; phone tabs and outbound active text-decoration none and exactly one ::after underline; Web/Cell phone radios exclusive. No overflow on those pages at the tested viewport.
- Strict review.run with base origin/stream/dialer and mine=true: 0 blocking issues, 0 failed suites, 0 documentation opportunities.
- New regression suite compact-workspace-polish.test.ts is an untracked new file until task.push; include it in publication and review. Next: formal verify, publish verified task branch through task.push and task.pr only to stream/dialer. No release to main or deployment without separate scope approval.

- 2026-11-06 02:48:40 append: `.task/dialer/polish-dialer-inbound-outbound-and-compact-settings-navigation/workpad.md`
