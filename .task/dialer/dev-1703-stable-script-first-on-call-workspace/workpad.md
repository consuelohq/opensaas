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

- `packages/lead-connector/src/embed/calling-workspace.ts`
- `packages/lead-connector/src/embed/coaching-scripts.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/inbound-operator-view.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring.ts`
- `packages/lead-connector/src/embed/mercury-call.test.ts`
- `packages/lead-connector/src/embed/mercury-call.ts`
- `packages/lead-connector/src/embed/mercury-cues.test.ts`
- `packages/lead-connector/src/embed/mercury-cues.ts`
- `packages/lead-connector/src/embed/mercury-dom.ts`
- `packages/lead-connector/src/embed/mercury-feed-api.ts`
- `packages/lead-connector/src/embed/mercury-feed.test.ts`
- `packages/lead-connector/src/embed/mercury-feed.ts`
- `packages/lead-connector/src/embed/mercury-workspace.test.ts`
- `packages/lead-connector/src/embed/mercury-workspace.ts`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/embed/view.test.ts`
- `packages/lead-connector/src/embed/view.ts`
- `packages/lead-connector/src/embed/workspace-dom.ts`
- `packages/lead-connector/src/embed/workspace-pages.ts`
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

- `packages/lead-connector/src/embed/calling-workspace.ts`
- `packages/lead-connector/src/embed/coaching-scripts.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/inbound-operator-view.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- `packages/lead-connector/src/embed/mercury-authoring.ts`
- `packages/lead-connector/src/embed/mercury-call.test.ts`
- `packages/lead-connector/src/embed/mercury-call.ts`
- `packages/lead-connector/src/embed/mercury-cues.test.ts`
- `packages/lead-connector/src/embed/mercury-cues.ts`
- `packages/lead-connector/src/embed/mercury-dom.ts`
- `packages/lead-connector/src/embed/mercury-feed-api.ts`
- `packages/lead-connector/src/embed/mercury-feed.test.ts`
- `packages/lead-connector/src/embed/mercury-feed.ts`
- `packages/lead-connector/src/embed/mercury-workspace.test.ts`
- `packages/lead-connector/src/embed/mercury-workspace.ts`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/embed/view.test.ts`
- `packages/lead-connector/src/embed/view.ts`
- `packages/lead-connector/src/embed/workspace-dom.ts`
- `packages/lead-connector/src/embed/workspace-pages.ts`
- `packages/lead-connector/src/embed/workspace-theme.css`

## workspace-owned: activity log

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
- 2026-11-13 20:54:57 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 20:54:58 fs.write: `packages/lead-connector/src/embed/mercury-feed.test.ts`
- 2026-11-13 20:56:25 fs.write: `packages/lead-connector/src/embed/mercury-feed-api.ts`
- 2026-11-13 20:56:26 fs.write: `packages/lead-connector/src/embed/mercury-feed.ts`
- 2026-11-13 20:59:15 fs.write: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 21:02:15 fs.write: `packages/lead-connector/src/embed/mercury-feed.test.ts`
- 2026-11-13 21:04:51 fs.write: `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- 2026-11-13 21:05:25 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 21:06:29 fs.write: `packages/lead-connector/src/embed/mercury-authoring.ts`
- 2026-11-13 21:08:54 fs.write: `packages/lead-connector/src/embed/mercury-feed.test.ts`
- 2026-11-13 21:09:14 fs.write: `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- 2026-11-13 21:11:05 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 21:13:34 fs.write: `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- 2026-11-13 21:14:49 fs.write: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 21:16:03 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 21:17:52 fs.write: `packages/lead-connector/src/embed/mercury-feed.test.ts`
- 2026-11-13 21:19:29 fs.write: `packages/lead-connector/src/embed/mercury-feed.test.ts`
- 2026-11-13 21:20:42 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 21:20:54 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 21:23:48 fs.write: `packages/lead-connector/src/embed/mercury-feed.test.ts`
- 2026-11-13 21:23:49 fs.write: `packages/lead-connector/src/embed/mercury-call.test.ts`
- 2026-11-13 21:25:32 fs.write: `packages/lead-connector/src/embed/mercury-authoring.test.ts`
- 2026-11-13 21:26:40 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 21:27:03 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
- 2026-11-13 21:27:13 fs.write: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

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
- 2026-11-13 21:16:11 `review.run`: passed — OK
- 2026-11-13 21:20:07 `review.run`: passed — OK
- 2026-11-13 21:20:43 `verify`: passed — OK
- 2026-11-13 21:26:52 `review.run`: passed — OK
- 2026-11-13 21:27:04 `verify`: passed — OK

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

## Server feed follow-up Test-first contract

- Production adapter owns only authenticated normalized Mercury cue API, scope/version/body validation, bounded non-overlapping polling and Off cleanup. No transcript ingestion or provider payload enters browser.
- Test behavior: encoded scoped paths/Bearer auth, strict response validation, delayed old-call/old-mode response rejection, source cancellation on Off/script/call changes, confirmed off-before-reopen, manual/unavailable/denied truth, no overlapping polls, remote closed-set controls.
- Focused red command: bun test packages/lead-connector/src/embed/mercury-feed.test.ts; expected red missing new adapter modules.
- Frozen server packet from conversation_core: POST /v1/coaching/sessions {scopeKey,scriptId,version?:number}->{view,publishedVersion:string}; GET encoded scope/cue?afterRevision=N; POST encoded scope/control {action:pin|auto|next|previous|off}->{view,publishedVersion}. POST same scope after Off re-admits with server-fenced new worker generation; browser never chooses generation.
- 409 SCRIPT_UNPUBLISHED,403 COACHING_ACCESS_DENIED,409 SCRIPT_CONFLICT,503 COACHING_UNAVAILABLE; manual-only session200statusmanual is approved reference only, never live. No automatic production capability grant created.

- 2026-11-13 20:54:57 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

- 2026-11-13 20:54:58 write: `packages/lead-connector/src/embed/mercury-feed.test.ts`

- 2026-11-13 20:56:25 write: `packages/lead-connector/src/embed/mercury-feed-api.ts`

- 2026-11-13 20:56:26 write: `packages/lead-connector/src/embed/mercury-feed.ts`

- 2026-11-13 20:58:34 apply-patch: `packages/lead-connector/src/embed/calling-workspace.ts`
- 2026-11-13 20:58:34 apply-patch: `packages/lead-connector/src/embed/mercury-workspace.ts`
- 2026-11-13 20:58:34 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-11-13 20:59:15 append: `packages/lead-connector/src/embed/mercury-call.test.ts`

- 2026-11-13 20:59:36 apply-patch: `packages/lead-connector/src/embed/mercury-workspace.ts`
- 2026-11-13 20:59:36 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-11-13 20:59:36 apply-patch: `packages/lead-connector/src/embed/mercury-call.ts`
- 2026-11-13 21:00:16 apply-patch: `packages/lead-connector/src/embed/mercury-feed.ts`
- 2026-11-13 21:02:15 append: `packages/lead-connector/src/embed/mercury-feed.test.ts`

- 2026-11-13 21:04:51 write: `packages/lead-connector/src/embed/mercury-authoring.test.ts`

## Narrow authoring hook test-first contract

Root requested a small existing-script preview/publish hook after the adapter. No Settings redesign. Existing server canPublish projection is the capability source (absent/false hides actions); no inferred grant. Preview shows exact compiled3–4points/source; explicit unchecked approval plus user-supplied reviewed industry/company version identifiers is required. No factual/synthetic default labels are inserted. Saved revision and published ordinal fence the mutation. New preview gets a unique form draft key so prior approval cannot be resurrected by snapshot draft preservation.

New mercury-authoring.test.ts red trc_5e14015ecfc4 proves missing module. Tests cover capability gating, escaped exact preview, fresh required approval, no default policy labels, authenticated typed revision/version publication body and malformed cards. Existing upload/save path is retained. The shared bounded authenticated JSON request primitive is reused by feed/authoring rather than duplicate provider or token code.

Feed test contract clarification: same-call/caller change does NOT start a second mutation concurrently while an earlier admission is pending. The original draft test expected parallel starts; corrected it before production driver implementation because aborting POST is not proof of no commit. Driver serializes admission→authoritative Off→next admission, while UI hides stale content immediately.

- 2026-11-13 21:05:25 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

- 2026-11-13 21:06:29 write: `packages/lead-connector/src/embed/mercury-authoring.ts`

- 2026-11-13 21:06:30 apply-patch: `packages/lead-connector/src/embed/coaching-scripts.ts`
- 2026-11-13 21:06:30 apply-patch: `packages/lead-connector/src/embed/calling-workspace.ts`
- 2026-11-13 21:07:49 apply-patch: `packages/lead-connector/src/embed/workspace-pages.ts`
- 2026-11-13 21:07:49 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
- 2026-11-13 21:08:54 append: `packages/lead-connector/src/embed/mercury-feed.test.ts`

- 2026-11-13 21:09:13 apply-patch: `packages/lead-connector/src/embed/mercury-feed.ts`
- 2026-11-13 21:09:14 append: `packages/lead-connector/src/embed/mercury-authoring.test.ts`

Authoring contract corrected by root before publication: implementation version identifiers are NOT meaningful product choices. Removed temporary industry/company fields. Final client publish body is only expectedRevision,expectedPublishedVersion,approved:true. Server derives honest tenant-source/revision provenance; it does not claim an external approved industry pack exists. Added corrected failing proof trc_109a642810b3 (metadata fields still rendered and client initially rejected missing labels), then removed those requirements. This supersedes the earlier draft test contract requiring user-entered labels. Explicit fresh approval/canPublish/revision fences remain.

- 2026-11-13 21:11:05 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

- 2026-11-13 21:13:34 append: `packages/lead-connector/src/embed/mercury-authoring.test.ts`

- 2026-11-13 21:14:49 append: `packages/lead-connector/src/embed/mercury-call.test.ts`

- 2026-11-13 21:15:15 apply-patch: `packages/lead-connector/src/embed/calling-workspace.ts`
- 2026-11-13 21:15:15 apply-patch: `packages/lead-connector/src/embed/mercury-workspace.ts`
- 2026-11-13 21:15:15 apply-patch: `packages/lead-connector/src/embed/mercury-call.ts`
- 2026-11-13 21:15:15 apply-patch: `packages/lead-connector/src/embed/internal-main.ts`
## Final UI/adapter/authoring implementation checkpoint

- Authenticated real API adapter is wired in internal-main for Script + selected script + confirmed connection + current embed auth only. Source responses are bounded to256KB and15s, strictly validate caller/revision/kind/status/publishedVersion/slot identity/text/source lengths, and reject pinned-version changes. No provider/transcript payload enters the browser.
- Polls run1500ms after completion, never overlap; transient failures back off to8s. Off/script/caller/auth changes invalidate local delivery epochs and abort reads; mutating admission settles, then Off acknowledgement precedes re-admission. An unknown start retains its scope for cleanup; typed403/409 admission denial is definitive and cannot poison the next eligible caller. Closed remote cue controls have no telephony access. Source statusmanual remains Manual reference; unavailable/denied preserves truthful manual fallback.
- Root/core final publication contract is only expectedRevision/expectedPublishedVersion/approved:true. Existing script detail has a prominent Preview entry before long source, exact3–4point/source preview, fresh required approval and explicit Publish. Server canPublish must be exactly true. No user-facing implementation version IDs, automatic upload publication or invented industry/company approval. A new preview's formkey prevents old checkbox approval restoration; publication error clears preview before retry. Active feeds are not restarted by publishing a new version.
- Current inbound customer/queue context is retained from the offered label only for the same assignment/generation; a different caller sees no old name. Added original red trc_b902696951b8 and passing regression.
- Additional source reds: trc_8fd1cb2158c7 (adapter absent), trc_cef4cc291aac (manual-only published source mislabeled), trc_df3a4cd43339 (denied admission blocked next caller). Authoring reds: trc_5e14015ecfc4 (module absent), trc_109a642810b3 (root-corrected metadata fields), trc_6504be9afdd2 (preview entry buried after long source).
- Final focused proof:237embedtests/1311assertions across32files green, package tsc --noEmit green (trc_820d61ef4fc0); final build:embed green (trc_18ae33b6d021). Actual app.fetch↔Hono/PG combined proof is owned by replay_release_validation after both immutable sources publish; no uncommitted peer source imported here.
- Remaining current gaps: signed live capture/capability authority and normalized outbox activation/default manual source, actual inbound runtime ownership adapter, outbound confirmed-both-leg timestamp, consumed-target queue continuation/pause semantics, broader full-browser/provider/multi-user/revocation/resume and release. Core owner is checking same-call Off→reopen preserves the original publishedVersion while advancing worker generation. UI does not claim those gates complete or enable unsupported actions.

- 2026-11-13 21:16:03 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

- 2026-11-13 21:17:52 append: `packages/lead-connector/src/embed/mercury-feed.test.ts`

- 2026-11-13 21:18:35 apply-patch: `packages/lead-connector/src/embed/mercury-feed-api.ts`
- 2026-11-13 21:18:35 apply-patch: `packages/lead-connector/src/embed/mercury-feed.ts`
- 2026-11-13 21:19:29 append: `packages/lead-connector/src/embed/mercury-feed.test.ts`

## Final projection protocol and gates

- Root/server review added REQUIRED opaque projectionToken in every successful open/read/control response. All client controls now send {action,projectionToken}; server rejects stale tokens before mutation. Browser never displays or invents this token, never adopts a foreign token from a poll, and changes it only on successful admission. Unknown admission recovers the actual token through an authorized cue read before Off. Same-call Off acknowledgement precedes new admission; tests verify old/new token use. Core confirmed same-call original publication pin is retained across reopened worker generations.
- Original projection-token red trc_34543d0cf19f caught missing validation/body/fence;11source tests/48assertions green (trc_d08b3304e3f8) include token absence, different-projection poll, unknown admission token recovery and same-call fresh token controls.
- First final strict review found4 async-boundary ERROR_HANDLING findings (trc_c523d5b9e42d); repaired by explicit typed error normalization in feed boundary and direct Promise composition in authoring adapters, retaining user-level catch paths. Nothing was waived.
- Latest full focused proof after protocol freeze:240embedtests/1319assertions across32files green + package typecheck (trc_eab0a78383d0); latest browser build green (trc_9c66a58fb97b); strict origin/main review0findings (trc_880149623b08). Final formal verify is running before exact-head source update.
- PR2799 was retargeted by coordinator into task/dialer/mercury-script-first-integration-and-release-candidate. Do not call task.pr again and reset its base. task.push updates the existing ready source PR only; root owns fresh exact-SHA CI/review/integration merge and release.

- 2026-11-13 21:20:42 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

Formal verify after final projection-token implementation: passed=true,publishValid=true (trc_c9b9ff0c551b). Full LeadConnector provider contract registry suite passed; strict review0findings; DB guard0risks/findings. Source ready for coordinator exact-SHA CI and combined real Hono adapter proof. No new owned process was started during feed/authoring follow-up.

- 2026-11-13 21:20:54 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

- 2026-11-13 21:23:16 apply-patch: `packages/lead-connector/src/embed/mercury-feed.ts`
- 2026-11-13 21:23:48 append: `packages/lead-connector/src/embed/mercury-feed.test.ts`

- 2026-11-13 21:23:49 append: `packages/lead-connector/src/embed/mercury-call.test.ts`

- 2026-11-13 21:25:32 append: `packages/lead-connector/src/embed/mercury-authoring.test.ts`

- 2026-11-13 21:26:01 apply-patch: `packages/lead-connector/src/embed/mercury-authoring.ts`
## Safety correction superseding unknown-admission recovery

Root independent review caught that reading the latest authorized projectionToken after a lost admission response does NOT prove it is our admission: another device may have reopened the projection. SHA116925e0329a0581c4a2749c898826071fb47d17 was held from integration and is superseded by this follow-up. Removed automatic read-latest-token/Off/re-admission. Unknown admission now stays explicit unknown/manual reference for that caller; no token is guessed/adopted and no unknown projection is mutated. Off does not falsely claim confirmed worker termination. Own successful admission responses remain safe token authority; late foreign-token polls are rejected. A different caller starts its own scoped admission without touching the old unknown projection. Server terminal cleanup and future own-admission correlation are required for automatic recovery; default live authority remains absent/manual-only.

Original adversarial red trc_2ea331b7b356 caught the unsafe read; green trc_99bcbc7cad77 covers no read/Off/rebind, unknown status and caller-bound state. This supersedes the earlier workpad claim that latest-authorized-read token recovery was safe.

Core minimum baseline update: omitted rules derives exact normalized source-heading aliases (no synonyms/model/industry facts), explicit rules:[] is manual-only. UI Preview now displays meaningful Listen for aliases per card, or Manual selection for this card when no phrases exist, before explicit approval. Original red trc_7fa7d10f15c0;6authoringtests green trc_690484c3a81d. Plaintext with3–4bullets may use saved title as heading. Existing inline formatting guidance/manual fallback remains; no semantic AI claim.

- 2026-11-13 21:26:40 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

Final safe-source focused gates:243embedtests/1329assertions across32files green and tsc green (trc_b99c54d808ab), browser build green (trc_a527c8ec274f), strict origin/main review0findings (trc_291debde2d8f). Formal verify rerun after the unknown-ownership correction and listening-preview addition; coordinator must use the next pushed SHA, not held116925.

- 2026-11-13 21:27:03 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`

Final safe-source formal verify passed=true,publishValid=true (trc_5c1b3f159c76): strict0findings, full LeadConnector contract registry suite passed, DB guard0risks/findings. No remaining owned transient process. Ready for exact-source coordinator CI/route roundtrip and integration review; DEV1703 remains In Progress pending integrated release acceptance.

- 2026-11-13 21:27:13 append: `.task/dialer/dev-1703-stable-script-first-on-call-workspace/workpad.md`
