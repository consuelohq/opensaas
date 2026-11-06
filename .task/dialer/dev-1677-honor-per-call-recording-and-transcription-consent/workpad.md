# DEV-1677 honor per-call recording and transcription consent

branch: `task/dialer/dev-1677-honor-per-call-recording-and-transcription-consent`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2774
started: 2026-11-06

## acceptance criteria

- [x] Backend distinguishes per-call capture consent from plan capability; absent/false stays off, true requires entitlement.
- [x] Normal GHL single/queue requests include explicit consent bits, with off default and authenticated in-UI opt-in.
- [x] Untrusted launcher messages cannot enable capture.
- [x] Returning from a call clears its capture consent; caller ID, queue selection and other settings remain intact.
- [x] Test-first red confirmed (7 failures); full affected suites and builds green; formal review/verify and production release pending.

## plan

1. Locate backend authorization, call session persistence, UI controller/state/options and launcher boundary.
2. Add red tests and run focused suite.
3. Implement gated per-call capture settings and reset consent at return home.
4. Run focused + full affected suites, typecheck, builds, strict review/verify.
5. Promote only reviewed diff and prepare isolated exact-source main-based release.

## files changed

- Backend commercial authorization and acceptance tests.
- LeadConnector embed state-machine, controller, view, internal handlers, launcher boundary and tests.

## key decisions

- Capture is opt-in independently per capability; do not infer consent from entitlement or another capture flag.
- Capture setting resets after a session; normal calling preferences remain persistent.
- GHL launcher action is untrusted and cannot assert capture consent.

## notes for ko

- Use agent-browser managed Chrome in future, not personal Arc; do not steal desktop focus.
- S01 one-shot prior approval remains unspent, and will not be exercised in this change set.

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

## workspace-owned: files read

- `packages/lead-connector/src/embed/commercial-ui.acceptance.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`

## DEV-1677: Test-first contract

behavior under test: Commercial authorization must treat plan recording/transcription flags as maximum entitlements, not automatic permission to capture calls. Absent or false per-call request defaults OFF, explicit true only when entitled, with independent explicit opt-in for each. Embedded GHL direct and queue start requests explicitly communicate consent state and keep settings OFF by default. UI calling options display clear opt-in toggles and don't enable unavailable capabilities.
existing local pattern: `packages/dialer-server/src/commercial-application.acceptance.test.ts` exercises `authorizeCall` with single and standard plans; `packages/lead-connector/src/embed/controller.test.ts` asserts direct/queue `startCallSession` shape; `packages/lead-connector/src/embed/calling-workspace.test.ts` verifies calling-options UI.
new or changed tests: (1) commercial test matrix absent, false/true and plan single/standard; (2) GHL controller direct/queue request flags; (3) calling options opt-in/disabled based on entitlement, state defaults and setup guards.
focused red command: `bun test packages/dialer-server/src/commercial-application.acceptance.test.ts packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/embed/calling-workspace.test.ts` (run using `code.call` with taskSession).
expected red failure: existing standard-plan test expects true when request says false; revised tests expect false, plus GHL request flags missing and UI controls missing.
no-test waiver: not applicable.
release safety: no live calls, no changes to personal Arc, Keychain, credentials, billing, sessions, Railway/Cloudflare until exact-source release gate. Limit any deployment to isolated verified main-based release. Use independent Consuelo agent-browser Chrome for future GHL inspection; don't steal focus.

- 2026-11-06 03:24:29 append: `.task/dialer/dev-1677-honor-per-call-recording-and-transcription-consent/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-06 03:24:29 fs.write: `.task/dialer/dev-1677-honor-per-call-recording-and-transcription-consent/workpad.md`

## Validation evidence

- Red tests: 7 failures in 65 tests before production edits (server consent matrix, direct + queue requests, UI, launcher).
- Green: 74/74 focused tests, 251/251 dialer-server suite (93 integration skips for unavailable real Postgres lab), 248/248 LeadConnector suite.
- Typecheck: dialer-server and LeadConnector passing.
- Build: dialer-server compiled binary + LeadConnector embed assets succeeded (not deployed).

## workspace-owned: validation evidence

- Red tests: 7 failures in 65 tests before production edits (server consent matrix, direct + queue requests, UI, launcher).
- Green: 74/74 focused tests, 251/251 dialer-server suite (93 integration skips for unavailable real Postgres lab), 248/248 LeadConnector suite.
- Typecheck: dialer-server and LeadConnector passing.
- Build: dialer-server compiled binary + LeadConnector embed assets succeeded (not deployed).
- 2026-11-06 03:29:05 `review.run`: passed — OK
- 2026-11-06 03:29:47 `review.run`: passed — OK
- 2026-11-06 03:29:57 `review.run`: passed — OK
- 2026-11-06 03:30:36 `verify`: passed — OK
