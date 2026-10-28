# DEV-1629 give phone offers time for acceptance

branch: `task/dialer/dev-1629-give-phone-offers-time-for-acceptance`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2649
started: 2026-10-28

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

## Scope and evidence

DEV-1629: fix the live phone acceptance timeout. The approved test created one caller and one rep offer. Reservation 21:00:23.589Z expired at 21:00:35.589Z; phone answered 21:00:29Z; prompt fetched 21:00:31Z; expiration committed 21:00:36.397Z; rep terminated at 21:00:37Z; digits=1 arrived 21:00:38Z and received Hangup. No bridge. All calls terminal, zero active calls/recordings, original routes restored and capacity unowned. Authorization consumed.

## Dependency and ownership graph

- P0: preserve provider/journal evidence and verify cleanup (complete).
- P1: SDK optional per-offer duration, backwards-compatible replay and strict existing ownership deadlines.
- P2: phone-specific server offer budget and bounded ring timeout; configuration and immutable decision evidence depend on P1.
- P3: isolated Postgres acceptance/bridge regression and full validation depend on P1/P2.
- P4: publish, review and release accepted SHA; later one-call acceptance requires fresh human authorization.
- Own SDK capacity schema/state/tests, server phone offer policy/routing/telephony/config and focused internal docs. Preserve independent documentation PR #2648, GHL SSO DEV-1619, DB-upgrade DEV-1623 and OS work DEV-1627/1628. No UI changes or direct production snapshot rewrites.

## Design frozen before mutation

New phone/mixed-device assignments get a 40-second default total budget; reserve 20 seconds for provider buffer, prompt, Gather input and control round-trip, leaving roughly 20 seconds for ringing. Twilio documents a possible 5-second extra ring buffer; Gather timeout begins after prompt audio. These are explicit deterministic policy defaults, not an empirical latency guarantee.

The SDK offer action accepts an optional validated duration; omitted values retain the registered policy, preserving old event replay. Apply the server phone policy only to new reservations containing a healthy phone endpoint. Existing owners keep their deadline; all acceptance/expiry generations and unknown-outcome ownership rules remain unchanged. Capture the phone policy in routing decision evidence. Configuration is bounded; caller maximum wait remains authoritative.

Provider references:
- https://www.twilio.com/docs/voice/api/call-resource
- https://www.twilio.com/docs/voice/twiml/gather

## Test-first contract

behavior under test: a legacy capacity registered with a 12-second base policy can accept a newly configured phone offer at +15 seconds and reach confirmed media; a genuinely expired/stale offer still cannot accept.
existing local pattern: SDK deterministic capacity tests plus telephony.integration.test.ts with isolated migrated PostgreSQL and a simulated carrier.
new or changed tests: explicit duration/replay/invalid-value SDK tests; PG phone accept after ringing/prompt delay, ring-time reserve and effective decision-policy evidence; configuration bounds.
focused red command: CONSUELO_RD5_PG_PORT=55415 bun test packages/dialer-server/src/inbound/telephony.integration.test.ts -t 'phone acceptance budget'
expected red failure: +15-second acceptance is hung up under the old +12-second deadline; expected remaining reservation/bridge state absent.
no-test waiver: none.

## Publication target

Task branch -> stream/dialer -> main. No live carrier retry in this implementation task; user approval is per initiation and the prior test is finished.

- 2026-10-28 21:19:08 append: `.task/dialer/dev-1629-give-phone-offers-time-for-acceptance/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-28 21:19:08 fs.write: `.task/dialer/dev-1629-give-phone-offers-time-for-acceptance/workpad.md`
- 2026-10-28 21:32:15 fs.write: `.task/dialer/dev-1629-give-phone-offers-time-for-acceptance/workpad.md`

## Focused red result

Five focused tests ran: 3 failed, 2 passed. The SDK rejected the new per-offer field, configuration returned no phone budget, and the real-Postgres phone acceptance regression failed under the old deadline. Production edits began only after this red evidence.

## workspace-owned: validation evidence

- 2026-10-28 21:28:51 `review.run`: passed — OK

## Validation result

- Focused red: 3 failures / 2 passes reproduced the missing duration, missing configuration policy and short phone deadline.
- Focused green: 5 passes / 42 assertions. Final policy-evidence PG checks: 2 passes / 21 assertions.
- SDK complete suite: 268 pass / 0 fail.
- Server complete suite with RD3/RD4/RD5/RD6/RD7B flags on native isolated Postgres port 55415: 307 pass / 1 unrelated opt-in lab skip / 0 fail.
- SDK build (including Node compiled-entrypoint contract), SDK/server typechecks and standalone server build passed.
- Strict review: zero reported issues. Durable full verify receipt result=pass, publishValid=true, mode=full, verifiedAt=2026-10-28T21:29:55.825Z; database guard passed. Default verify PG skips are supplemented by the full PG run and final focused PG assertions.
- Immutable decision evidence now includes the resolved phone window, selected assignment window and screening reserve. Registered policy and existing owners are untouched.

## Operator and release handoff

Twilio Individual Primary profile is twilio-approved, with no profile errors. The separate Starter profile remains in-review. One newly authorized call ran (20261028-dd4efcec); caller admission and rep delivery succeeded, digits=1 was captured, but the old 12-second offer expired before acceptance. Human heard the incoming-call prompt then immediate hangup. This test did not connect media. All test calls terminal, zero active calls, zero recordings, original VoiceURL/method and StatusCallback/method restored; rep away and capacity unowned. Its authorization is consumed.

Publish to stream/dialer, verify the exact stream SHA/review/checks, then deploy the accepted main SHA with no carrier initiation. Keep historical ended sessions for the next test; the temporary runner must select only the new run's sessions and reject active sessions, rather than requiring an empty history. A later one-call test requires a new explicit human approval. Preserve docs PR #2648 ownership.

- 2026-10-28 21:32:15 append: `.task/dialer/dev-1629-give-phone-offers-time-for-acceptance/workpad.md`
