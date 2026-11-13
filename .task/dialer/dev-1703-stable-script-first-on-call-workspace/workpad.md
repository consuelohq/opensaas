# DEV-1703 stable script-first on-call workspace

branch: `task/dialer/dev-1703-stable-script-first-on-call-workspace`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2799
started: 2026-11-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/mercury-call.test.ts`
- `packages/lead-connector/src/embed/mercury-call.ts`
- `packages/lead-connector/src/embed/mercury-cues.test.ts`
- `packages/lead-connector/src/embed/mercury-cues.ts`
- `packages/lead-connector/src/embed/mercury-dom.ts`
- `packages/lead-connector/src/embed/mercury-workspace.test.ts`
- `packages/lead-connector/src/embed/mercury-workspace.ts`
- `packages/lead-connector/src/embed/workspace-theme.css`

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

## Acceptance and scope

- Dedicated stable on-call surface and compact bar; idle/settings/device/billing unchanged.
- Approved view model renders up to four source-backed slots; legacy text library is explicitly Manual script, never approved coaching.
- Slot-level updates retain unchanged nodes, selections and scroll; call identity fences late cues. Off/Script and disabled AI; pin/manual navigation/return to automatic when supplied.
- Controls reuse existing handlers: outbound cancel/end, inbound accept/decline/end/finish. No fake mute/hold or queue actions. Telephony owner is untouched.
- Source PR only into coordinator integration; task.pr taskOnly true; no main merge or deploy.

## Plan

1. Add isolated Mercury presentation + bounded subscription seam and regressions.
2. Mount on confirmed connected calls and compact bar, preserve unchanged cue subtree on snapshots.
3. Wire explicit view actions without call-control authority and reset call-scoped state on identity changes.
4. Focused tests, package typecheck/build and browser fixture; strict review/formal verify and scoped push.

## Test-first contract

behavior under test: manual source labeling, call-scoped late-event rejection, same-call stable point DOM, selection preservation, confirmed timestamp only, inbound/outbound compact critical controls, disabled AI and manual fallback.
existing local pattern: Bun tests + JSDOM from calling-workspace.test.ts and workspace-dom.test.ts; pure string renderer adapters.
new or changed tests: mercury-call.test.ts and mercury-cues.test.ts; focused rendering integration assertions.
focused red command: bun test packages/lead-connector/src/embed/mercury-call.test.ts packages/lead-connector/src/embed/mercury-cues.test.ts
expected red failure: new modules absent, then behavior assertions guide implementation.
no-test waiver: none.

## Initial audit

- main1d31f05f; managed tsk_9f2a8162c4a9 / PR2799.
- Existing inbound assignment carries connectedAt; outbound DTO does not. Timer must honestly show unavailable until confirmed clock exists.
- Existing outbound pause is local presentation only; no queue progression contract. Do not add fake next/pause. Existing transfer can remain secondary.
- Legacy script library migration015 is manual sentence navigation, not conversation-aware coaching.

- 2026-11-13 20:30:33 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

## workspace-owned: files changed

- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/mercury-call.test.ts`
- `packages/lead-connector/src/embed/mercury-call.ts`
- `packages/lead-connector/src/embed/mercury-cues.test.ts`
- `packages/lead-connector/src/embed/mercury-cues.ts`
- `packages/lead-connector/src/embed/mercury-dom.ts`
- `packages/lead-connector/src/embed/mercury-workspace.test.ts`
- `packages/lead-connector/src/embed/mercury-workspace.ts`
- `packages/lead-connector/src/embed/workspace-theme.css`

## workspace-owned: activity log

- 2026-11-13 20:30:33 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 20:31:33 write: `packages/lead-connector/src/embed/mercury-cues.test.ts`
- 2026-11-13 20:31:33 fs.write: `packages/lead-connector/src/embed/mercury-cues.test.ts`
- 2026-11-13 20:31:34 write: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 20:31:34 fs.write: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 20:32:38 write: `packages/lead-connector/src/embed/mercury-cues.ts`
- 2026-11-13 20:32:38 fs.write: `packages/lead-connector/src/embed/mercury-cues.ts`
- 2026-11-13 20:32:39 write: `packages/lead-connector/src/embed/mercury-call.ts`
- 2026-11-13 20:32:39 fs.write: `packages/lead-connector/src/embed/mercury-call.ts`
- 2026-11-13 20:33:16 apply-patch: `packages/lead-connector/src/embed/calling-workspace.ts`
- 2026-11-13 20:33:16 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-11-13 20:33:16 apply-patch: `packages/lead-connector/src/embed/inbound-operator-view.ts`
- 2026-11-13 20:34:01 write: `packages/lead-connector/src/embed/mercury-dom.ts`
- 2026-11-13 20:34:01 fs.write: `packages/lead-connector/src/embed/mercury-dom.ts`
- 2026-11-13 20:34:02 apply-patch: `packages/lead-connector/src/embed/workspace-dom.ts`
- 2026-11-13 20:34:02 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-11-13 20:34:03 append: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-13 20:34:03 fs.write: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-13 20:34:17 apply-patch: `packages/lead-connector/src/embed/workspace-dom.ts`
- 2026-11-13 20:35:58 write: `packages/lead-connector/src/embed/mercury-workspace.test.ts`
- 2026-11-13 20:35:58 fs.write: `packages/lead-connector/src/embed/mercury-workspace.test.ts`
- 2026-11-13 20:36:33 write: `packages/lead-connector/src/embed/mercury-workspace.ts`
- 2026-11-13 20:36:33 fs.write: `packages/lead-connector/src/embed/mercury-workspace.ts`
- 2026-11-13 20:36:34 apply-patch: `packages/lead-connector/src/embed/calling-workspace.ts`
- 2026-11-13 20:36:34 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-11-13 20:36:34 apply-patch: `packages/lead-connector/src/embed/view.test.ts`
- 2026-11-13 20:38:10 append: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:38:10 fs.write: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:38:23 append: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 20:38:23 fs.write: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 20:39:03 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-11-13 20:39:03 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-11-13 20:39:03 apply-patch: `packages/lead-connector/src/embed/calling-workspace.ts`
- 2026-11-13 20:39:03 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-11-13 20:39:27 append: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:39:27 fs.write: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:39:42 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-11-13 20:41:03 append: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-13 20:41:03 fs.write: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-13 20:41:19 apply-patch: `packages/lead-connector/src/embed/mercury-call.ts`
- 2026-11-13 20:41:48 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:42:02 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:45:16 fs.write: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-13 20:46:28 fs.write: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 20:47:18 fs.write: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:48:42 fs.write: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:49:28 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 20:51:23 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

## workspace-owned: validation evidence

- 2026-11-13 20:42:37 `review.run`: passed — OK
- 2026-11-13 20:45:16 append: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-13 20:46:28 append: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 20:46:38 apply-patch: `packages/lead-connector/src/embed/mercury-dom.ts`
- 2026-11-13 20:47:18 append: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:47:45 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-11-13 20:48:42 append: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-13 20:48:52 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-11-13 20:48:52 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-11-13 20:49:36 `review.run`: passed — OK
- 2026-11-13 20:50:51 `review.run`: passed — OK
- 2026-11-13 20:51:08 `verify`: passed — OK

## Implementation and proof checkpoint — 2026-11-13

- Added Mercury presentation view/source seam, caller-scoped workspace history/pin/manual/auto state, four fixed cue slots, source details, light/dark/reduced-motion CSS and compact identity/status/timer/End bar.
- Current text/Markdown library is explicitly Manual script. Approved points require the validated presentation adapter. AI stays disabled.
- Existing transfer remains secondary. No unsupported mute/hold/Next/Pause action is enabled. Legacy local-only queue pause and lack of consumed-target continuation are release gaps.
- Added authoritative End pending state; termination response must be completed before wrap-up, repeated End coalesces, old in-flight snapshots cannot resurrect a confirmed-ended caller, and refresh results are fenced by current caller id.
- Root independent review caught cancellation during voice.prepare returning phantom wrap-up. Added a failing test (trc_dc7e925553b1) and START_CANCELED now returns selected setup without server call/disposition. Cancellation during a pending server create terminates the created session before connecting media.
- Original new-module red: trc_145c865f9b78 (missing Mercury modules). First green: trc_9887017bef5b (7 tests). Additional control reds: trc_899525f1569f (optimistic wrap-up/unknown result), trc_5d0eef0cd17b (pending create still connected media), trc_452bb584ce7d (late snapshot resurrected ended caller). Additional fade red trc_f278e1b18156 (unchanged snapshot re-faded old changed node).
- Latest broad embed proof before START_CANCELED:221 tests/1234 assertions across30 files green (trc_76171e4f68d6); package tsc --noEmit and build:embed green. Final gates run after last change below.
- Old view tests were updated because product intentionally adds the compact Mercury mode selector and contact identity; transcript review remains secondary. No behavior assertion was weakened to avoid a new regression.

## Browser proof (synthetic fixture only)

- Actual production renderer/workspace DOM/action helpers bundled into /tmp/dev1703-mercury-fixture; no server cue feed, Voice SDK, mic, paid model, GHL writes or provider calls.
- OS browser shared profile was locked; used browser.raw with isolated --session dev1703-mercury --profile /tmp/dev1703-mercury-browser on every call. Did not close or alter the shared profile.
- 420x680 light,320x568 dark,420x96 compact screenshots at /tmp/dev1703-mercury-fixture/mercury-420x680.png, mercury-dark-320x568.png, mercury-compact-420x96.png.
- Browser measurement: one point changed; other nodes retained and all4point rectangles were byte-identical before/after. End remained visible (bottom659.75/680;547.75/568), no horizontal overflow (320px body/320px viewport). Pin held incoming update; Return to auto showed latest; compact/restore retained same scope and cue, with End available.
- Human glance review: four short points readable at both sizes; monochrome, no decorative dividers. At shortest viewport the source disclosure may require scrolling within the cue region; bottom call controls stay fixed.
- Owned browser session closed and exact owned fixture server PID46655 stopped after verifying its command. Temp screenshots/source retained for coordinator recovery; no owned background process remains.

## Remaining release gates

- Server frozen cue transport adapter to follow this initial source publication on this same lane; fixture output is not production live coaching.
- Outbound DTO has no confirmed both-leg timestamp. answeredAt in call-operations/persistence.ts:729 is AMD human detection, unsuitable for a talking timer. UI exposes workspace.confirmedConnection={scopeKey,at}; shows an honest dash when absent. Inbound uses confirmed assignment.connectedAt only.
- Queue continuation: controller startCall submits all selectedTargets, while runtime/railway.ts:1230 consumes pendingQueues then falls back to provided contact/phone list without attempted-contact exclusion. Reusing it blindly can redial. Need consumed-target/cursor contract before Next/Continue.
- Actual provider callbacks, inbound/outbound full browser contracts, role/capability revocation, source transport resume, and production release remain DEV1707 integrated acceptance. Do not mark DEV1703 Done from this fixture-only checkpoint.

- 2026-11-13 20:49:28 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

## Initial source publication gates

- Final focused embed package:222 tests/1239 assertions green across30 files (trc_4110b80b934d), including root-caught pre-create cancellation. Package typecheck green. Embed build green (trc_2d2193044cc9).
- Strict review against correct origin/main:0 findings (trc_6d3a0be71f2f), includes all new Mercury TypeScript modules/tests.
- Formal verify origin/main:passed and publishValid=true (trc_42a09f8dceea). It ran strict static/lint/typecheck/spec review, selected LeadConnector provider contracts over packages/lead-connector/src, and DB guard with0 risks/findings.
- Tooling note: status with top-level taskSession incorrectly reported the user's main checkout; treated as non-task evidence only, touched nothing. task-scoped code.call/git.diff/review/verify all resolve the correct isolated worktree and branch.
- Initial scoped PR remains2799; taskOnly publication prevents divergent shared stream promotion. Continue on this same lane only for the frozen authenticated cue feed adapter after initial source is pushed.

- 2026-11-13 20:51:23 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
