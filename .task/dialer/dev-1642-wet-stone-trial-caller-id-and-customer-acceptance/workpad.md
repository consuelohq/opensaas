# DEV-1642 Wet Stone trial caller ID and customer acceptance

branch: `task/dialer/dev-1642-wet-stone-trial-caller-id-and-customer-acceptance`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2701
started: 2026-10-30

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

Behavior under test: ordinary Wet Stone trial -> tenant-owned number -> first customer-style call, preserving real signed context and tenant/provider boundaries.
Existing local pattern: DEV-1619 production evidence and normal commercial admin/provider flows.
New or changed tests: none for read-only provider/browser acceptance; any discovered code defect requires its own focused regression before editing.
Focused red command: not applicable to read-only acceptance.
Expected red failure: current deployed caller UI reports NO_CALLER_ID with no provisioned tenant numbers.
No-test waiver: justified for the initial read-only runtime inspection and preparing a concrete reviewed purchase/call step; no production source edits planned.

No number purchase, paid Stripe change, secret rotation or new carrier call is authorized. Do not trigger the number-search path until the existing tenant account is reconciled because search can create a subaccount.

- 2026-10-30 02:26:17 append: `.task/dialer/dev-1642-wet-stone-trial-caller-id-and-customer-acceptance/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 02:26:17 fs.write: `.task/dialer/dev-1642-wet-stone-trial-caller-id-and-customer-acceptance/workpad.md`
- 2026-10-30 19:14:57 fs.write: `.task/dialer/dev-1642-wet-stone-trial-caller-id-and-customer-acceptance/workpad.md`

## Trial provisioning defect — 2026-10-30

Production proof: normal signed admin number search200 created exactly one tenant subaccount. One guarded native provision POST400 INVALID_PLAN_CODE occurred before provider purchase. Independent DB and Twilio readback both show zero numbers. Prior purchase claim stays preserved; no unknown carrier effect is retried.

## Updated test-first contract

Behavior under test: a genuine free-trial workspace with no paid-seat row can provision/assign its included number using the configured trial plan, retain trial500-minute/one-number limits, and leave paid billing/seat rows untouched. Missing seats in a paid/subscribed workspace must still be rejected before the provider boundary; malformed actual seat plans must not silently fall back.
Existing local pattern: commercial-application.acceptance.test.ts mock provider/database boundaries and caller-context acceptance.
New tests: first trial number -> included assignment -> trial caller context; second purchase rejected before provider; unassigned paid inventory or subscribed workspace rejected.
Focused red command: bun test packages/dialer-server/src/commercial-application.acceptance.test.ts --test-name-pattern 'trial number|unassigned paid'
Expected red: fresh trial provisioning rejects INVALID_PLAN_CODE before provider; paid missing-seat cases lack intentional SEAT_NOT_ASSIGNED classification.
No-test waiver: superseded; code change requires the red/green evidence and strict/full gates.
Scope: commercial application assignment-plan resolution and focused regressions only. Raw-user-ID form usability will be recorded separately rather than mixed into this backend fix. Do not add a paid seat or alter real Stripe quantities as a workaround. Preserve shared stream and all other work.

- 2026-10-30 19:14:57 append: `.task/dialer/dev-1642-wet-stone-trial-caller-id-and-customer-acceptance/workpad.md`

## workspace-owned: validation evidence

- 2026-10-30 19:16:38 `review.run`: passed — OK
- 2026-10-30 19:17:19 `verify`: passed — OK
