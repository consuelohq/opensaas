# release caller ID lock on machine-only completion

branch: `task/dialer/release-caller-id-lock-on-machine-only-completion`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1761/release-caller-id-lock-on-machine-only-completion
github pr: https://github.com/consuelohq/opensaas/pull/1761
started: 2026-08-03

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-03 22:09:04 `review.run`: passed — OK
- 2026-08-03 22:09:04 `review.run`: passed — OK
- 2026-08-03 22:10:08 `review.run`: passed — OK
- 2026-08-03 22:10:29 `verify`: failed — COMMAND_FAILED
- 2026-08-03 22:12:27 `review.run`: passed — OK
- 2026-08-03 22:12:43 `verify`: passed — OK

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

## production discovery

- Live call at 2026-08-03 21:21 UTC completed as AMD machine with no winner, but caller-id-lock for ***0892 remained owned by the terminal call for ~12 hours and blocked later calls with NO_CALLABLE_TARGETS.
- The lock was verified against Twilio as status completed before manual release.
- A later human call used the same number and the normal hang-up path released the lock correctly, so the defect is specific to a terminal path that bypasses normal winner/hang-up cleanup.
- No additional carrier call is required for this fix.

## test-first contract

- Add a focused regression for terminal machine/no-winner completion proving the caller-ID lock is released.
- Preserve the existing human winner and explicit hang-up cleanup behavior.
- Run the focused test red before production edits, then the package/service validation suite.

## implementation and validation

- Root cause: stale dialing recovery force-completed groups through ParallelDialerService.getGroup -> getCallSession -> terminateCallSession, but ParallelDialerService did not receive the shared CallerIdLockService, so the 12-hour active lock survived.
- Added lock-service propagation from Dialer.withCallerIdLock to ParallelDialerService.
- Added idempotent terminal lock release after stale lookup and direct termination paths.
- Focused red: missing ParallelDialerService.withCallerIdLock.
- Focused green: 45/45.
- Full dialer tests: 167/167.
- Dialer-server tests: 47/47.
- Both typechecks and builds pass.
- No carrier call used for validation.

- Strict review initially rejected async wrappers under ERROR_HANDLING; converted to direct promise composition with propagated failures.
- Strict review rerun: 0 blocking findings.

## review-driven mechanical cleanup

- No-test waiver: full verify surfaced two pre-existing async-wrapper ERROR_HANDLING findings in dialer.ts because this task correctly touches Dialer.withCallerIdLock. Converted resolveCallerId and hangup to behavior-equivalent promise composition; existing dialer suites cover both surfaces.
