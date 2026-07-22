# repair live AMD and caller-ID lock lifecycle

branch: `task/dialer/repair-live-amd-and-caller-id-lock-lifecycle`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1555/repair-live-amd-and-caller-id-lock-lifecycle
github pr: https://github.com/consuelohq/opensaas/pull/1555
started: 2026-07-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/dialer/src/services/caller-id.spec.ts`
- `packages/dialer/src/services/caller-id.ts`
- `packages/dialer/src/services/parallel-dialer.spec.ts`
- `packages/dialer/src/services/parallel-dialer.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-22 19:51:46 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`
- 2026-07-22 19:52:12 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`
- 2026-07-22 19:55:19 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`
- 2026-07-22 19:59:26 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`
- 2026-07-22 20:04:45 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`
- 2026-07-22 20:10:19 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`

## workspace-owned: validation evidence

- 2026-07-22 20:06:55 `review.run`: passed — OK
- 2026-07-22 20:09:51 `review.run`: passed — OK
- 2026-07-22 20:16:59 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Live single-call evidence: the allowlisted 980 leg reached Twilio, customer TwiML, and status callback; synchronous AMD returned `machine_start`, but the leg remained provider-active until manually terminated.
- `ParallelService.customerTwiml` ignores `AnsweredBy`; machine/human decision logic currently exists only in `statusCallback`.
- Caller-ID locks use a five-minute TTL and were absent while the provider call was still active.
- Scope: DEV-1601 and DEV-1602 only. Fan-out remains blocked until single-call AMD termination and active-lock ownership are proven.

## Test-first contract

Behavior under test:
- Twilio `AnsweredBy` delivered to customer TwiML must enter the same idempotent group lifecycle as an `in-progress` status callback.
- Non-terminal activity must refresh the caller-ID lock without preventing stale-lock expiry; terminal paths must still release promptly.

Existing local pattern:
- `parallel.service.spec.ts` for callback orchestration and lock release.
- `parallel-dialer.spec.ts` for AMD winner/machine behavior.
- `caller-id.spec.ts` for Redis lock scripts and TTL behavior.

New or changed tests:
- customer TwiML: machine_start, human, unknown, absent AnsweredBy, duplicate callback.
- lock service: refresh preserves ownership/TTL and refuses mismatched ownership; terminal release remains unchanged.
- parallel callback orchestration refreshes active locks and releases terminal locks.

Focused red commands:
- server parallel service Jest spec.
- dialer caller-id and parallel-dialer Jest specs.

Expected red failure:
- customer TwiML does not call lifecycle handling with `in-progress` + `AnsweredBy`.
- no lock-refresh method/script exists.

- 2026-07-22 19:51:46 append: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`

Discovery recovery: direct `explore` failed twice with exit code 1 for both a descriptive query and `AnsweredBy`. Continued with bounded Bun/Python code reads and exact file inspection; no production edit was made during the failure.

- 2026-07-22 19:52:12 append: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`

## workspace-owned: files read

- `packages/dialer/package.json`
- `packages/dialer/src/services/caller-id.spec.ts`
- `packages/dialer/src/services/caller-id.ts`
- `packages/dialer/src/services/parallel-dialer.spec.ts`
- `packages/dialer/src/services/parallel-dialer.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`

## summary

### changes

- Route synchronous Twilio `AnsweredBy` values from customer TwiML through the same idempotent parallel-call lifecycle used by status callbacks.
- Terminate machine/fax and policy-rejected AMD legs before returning empty TwiML; allow the selected winner to join unmuted.
- Preserve duplicate callback idempotency so repeated winner callbacks cannot terminate the winner.
- Promote pending caller-ID locks to a 12-hour active provider-call lease when the real call SID is known.
- Refresh active leases on trusted TwiML/status activity and release them promptly on terminal/group-completed callbacks.
- Transfer pending locks to provider call SIDs in both GraphQL and migrated REST initiation paths.

### why

- The first controlled live call reached `machine_start` but remained provider-active until manual termination because synchronous AMD arrived at customer TwiML and that handler ignored `AnsweredBy`.
- The same call outlived the original five-minute lock TTL, making its caller ID reusable while the provider leg was still active.

### validation

- Entire `@consuelo/dialer` suite: 10 suites, 132 tests passed.
- Focused server lifecycle/call-start suites: 2 suites, 34 tests passed.
- Dialer TypeScript check passed.
- Changed-path server TypeScript errors: zero; project-wide baseline still fails outside changed paths.
- Change-owned repository review: zero issues, zero blocking findings, two focused suites passed.
- `git diff --check` passed.
- Added non-test/durable content contains no complete E.164 number, Twilio credential shape, or secret assignment.
- Live single evidence: synchronous `machine_start` automatically completed in 4 seconds with no manual termination; terminal lock count returned to zero.
- Exact-branch lease evidence: one active lock had approximately 43,199 seconds remaining and returned to zero after terminal completion.
- Live two-leg predictive evidence: both non-980 allowlisted tester legs reached `machine_start`, completed in 3 and 2 seconds without cleanup, held two approximately 43,199-second active leases, and released all locks at terminal state.

### issues

- DEV-1601: synchronous AMD lifecycle defect addressed here.
- DEV-1602: active caller-ID lease defect addressed here.
- DEV-1603: tester aliases/nicknames intentionally separated from this lifecycle repair.
- Inherited worktree tooling: server ESLint cannot load a missing local Twenty rule package, and full server typecheck retains unrelated baseline failures. Neither reports a changed-path defect after this change.

- 2026-07-22 20:10:19 append: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`

- 2026-07-22 20:14:43 apply-patch: `packages/dialer/src/services/parallel-dialer.ts`
- 2026-07-22 20:14:43 apply-patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- 2026-07-22 20:15:27 apply-patch: `packages/dialer/src/services/parallel-dialer.ts`
