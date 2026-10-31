# Polish rep calling workflows and workspace continuity

branch: `task/dialer/polish-rep-calling-workflows-and-workspace-continuity`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2732
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

Ko-approved wave: neutral borderless UI except phone entry / Learn more underline; browser-first eligible default and disabled start when none selected; aligned persistent action rows with queue/options above; unified searchable contact-or-number chooser (destination distinct from Call from); close icon; safe scoped8-hour last-view restore with no contacts/tokens/PII persisted; valid plan-gated predictive/sequential labels, automatic source when local presence on; clear team access vs Stripe billing and phone answering vs owned calling numbers. Manual Mercury script mode reuses existing durable script library; AI/Pi live integration and notifications remain explicit follow-ups rather than simulated features.

Session contract: bounded fresh trusted-parent bootstrap renewal before expiry and on auth expiry, preserving active phase/media/assignment and never retrying an external call command. Parent refuses fresh context across owned-location changes or replaced frames. No token persistence. Initial boot can show connecting; renewal must not blank the working UI or spin forever.

Tests: pure preference/TTL/scope/redaction and target-choice tests; DOM workflows for browser defaults/none selected, action order, pickers/mode/source semantics/team/settings/Mercury; controller/state renewal regressions proving no voice disconnect or active-state reset; scheduler bounded retry/timeouts; trusted-parent source/location tests; intercepted Chrome full user navigation, reload restores view, chooser search/direct-number with no call, script upload/edit persistence on stub and manual on-call script; short/mobile/normal no-scroll fits; safe signed-in live UI/source-hash proof.

Focused red first: bun test packages/lead-connector/src/embed/rep-workflows.test.ts and new workspace-preferences/contact-picker helpers. Cosmetic CSS no-test waiver: use geometry/visual browser checks rather than implementation-mirroring style assertions. All repo/provider operations via taskSession. Preserve existing billing/OS auth/stream work; no calls/readiness/payment/number effects; no new subagents.

- 2026-10-31 04:41:47 append: `.task/dialer/polish-rep-calling-workflows-and-workspace-continuity/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 04:41:47 fs.write: `.task/dialer/polish-rep-calling-workflows-and-workspace-continuity/workpad.md`

## Workflow progress
Browser-first defaults, one target chooser, text tabs, border cleanup, pinned action baseline, purpose-separated number settings, honest team access page, scoped 8-hour view memory, and manual Mercury script cues implemented. Session renewal uses pinned trusted-parent context, preserves call phase/media and bounds retries. Controlled query focus regression and short-token renewal storm both reproduced red, fixed green. Package 230 tests pass, TypeScript pass; intercepted browser acceptance in progress. No live calls, readiness, purchases or billing writes.

Continuation issues: DEV-1655 durable answering devices/forwarding registration; DEV-1656 ringtone/desktop notifications; DEV-1657 eligible member directory/seat assignment. DEV-1645 updated with Pi extension paths and manual cue boundary. DEV-1651 is this wave's renewal fix. DEV-1643 existing number-assignment UI remains separate from full team directory.

## workspace-owned: validation evidence

- 2026-10-31 04:56:04 `review.run`: passed — OK
- 2026-10-31 04:56:50 `review.run`: passed — OK
- 2026-10-31 04:57:07 `verify`: passed — OK
