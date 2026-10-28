# disconnect browser agent after terminal call session

branch: `task/dialer/disconnect-browser-agent-after-terminal-call-session`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1760/disconnect-browser-agent-after-terminal-call-session
github pr: https://github.com/consuelohq/opensaas/pull/1760
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

- 2026-08-03 21:29:15 `review.run`: passed — OK
- 2026-08-03 21:29:16 `review.run`: passed — OK
- 2026-08-03 21:29:31 `verify`: passed — OK

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

- Production evidence: customer carrier leg completed as AMD machine, backend group completed with no winner and empty cleanup failures, but browser agent call and conference remained in-progress until manual termination.
- Root cause: `refreshSession` dispatches terminal backend state but never calls `voice.disconnect()`; stop/hang-up and startup-failure paths do.
- Polling stops after the first terminal update because `wrapping-up` is not an active refresh phase.
- Adjacent state defect: `phaseFromSession` checks `winnerSid` before terminal status, so a completed group retaining a winner SID can remain projected as connected.
- No additional carrier call is authorized or required for this fix.

## test-first contract

- Controller regression: after an initially connected session, a completed/no-winner refresh disconnects the browser voice leg exactly once and projects wrapping-up.
- Idempotency regression: a repeated terminal refresh does not issue a second disconnect.
- State regression: terminal status projects wrapping-up even when `winnerSid` remains populated.
- Red proof must fail before implementation.

## implementation and validation

- Added controller-owned active voice-session lease; terminal session projection, stop, hang-up, and startup failures release it through one idempotent disconnect helper.
- Added shared terminal-session predicate and made terminal status outrank retained winner metadata.
- Red proof: focused controller and state tests failed exactly on missing disconnect and connected projection.
- Focused green: 14/14.
- Full LeadConnector tests: 70/70.
- Typecheck: pass.
- Production build: pass.
- Strict review against `origin/stream/dialer`: 0 blocking findings.
- No additional carrier call was made.
