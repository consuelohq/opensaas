# reconcile winner after conference participant entry

branch: `task/dialer/reconcile-winner-after-conference-participant-entry`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1762/reconcile-winner-after-conference-participant-entry
github pr: https://github.com/consuelohq/opensaas/pull/1762
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

- 2026-08-03 22:23:24 `review.run`: passed — OK
- 2026-08-03 22:23:25 `review.run`: passed — OK
- 2026-08-03 22:23:42 `verify`: passed — OK

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

- Human live test group pg_65428cb97bdb selected the customer winner at 2026-08-03T21:45:44.721Z.
- The provider unmute action returned participant 404 because customer conference TwiML was not served until roughly 2026-08-03T21:45:46Z.
- The persisted winner caused customer TwiML to join with muted=false; live conference truth showed both agent and customer present, muted=false, hold=false, and two participants.
- Backend nevertheless retained a false non-retryable unmute-winner cleanup failure until explicit hang-up reconciliation.
- No additional carrier call is authorized or required.

## test-first contract

- Reproduce winner selection before conference participant creation.
- A provider participant-not-found result for unmute-winner must not become a durable false cleanup failure when winner TwiML is authoritative and will join unmuted.
- Preserve durable failures for other unmute errors and existing retry/reconciliation behavior.
- Focused red command will target the callback/lifecycle contract before implementation.

## implementation and validation

- Added a provider-boundary classifier for Twilio participant 404 / code 20404 during winner unmute.
- The participant update is treated as deferred success only after an active conference has already been found; winner-aware customer TwiML remains authoritative and joins muted=false.
- Missing conference and all other provider failures retain existing durable failure/reconciliation behavior.
- Focused red reproduced the false non-retryable cleanup failure.
- Focused green: 10/10 lifecycle contract tests.
- Full dialer tests: 168/168.
- Dialer-server tests: 47/47.
- Both typechecks and builds pass.
- No carrier call used for validation.
