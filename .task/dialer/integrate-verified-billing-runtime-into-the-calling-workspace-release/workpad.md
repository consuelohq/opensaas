# Integrate verified billing runtime into the calling workspace release

branch: `task/dialer/integrate-verified-billing-runtime-into-the-calling-workspace-release`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2720
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
behavior under test: combined release retains deployed public checkout/catalog/entitlement and asynchronous Stripe verification while keeping the new authenticated script library and current UI.
existing local pattern: verified e11a9ce billing package tests and isolated PostgreSQL purchase/claim suite; DEV-1649 script/unit/PG/browser evidence.
new or changed tests: reuse immutable owner suites and add a combined route boundary regression if composition needs changes.
focused red command: copy verified checkout acceptance tests first and run before bringing the missing checkout modules.
expected red failure: public checkout modules/routes are absent on the main-based UI source.
no-test waiver: none for feature composition. No need to recreate the owner's checkout logic or carrier/payment test effects.

## Ownership and release boundary
Billing owner assigned composition/release to this coordinator through /tmp/consuelo-billing-ui-contract.json. Approved immutable billing source e11a9ce52e5e0c0140e109de27faa20eb5b0ee07, Railway8b6af57d. Backend-only patch SHA25627da0a44e67be748eef007eea09250a05b90842ff51124df2390e03524b25f30. Preserve current stream UI, scripts migration015, signing secrets and all deployment variables. Website preview remains independently owned. No real calls/readiness/payment/number effects.

## workspace-owned: validation evidence

- 2026-10-31 00:06:32 `review.run`: passed — OK
- 2026-10-31 00:09:04 `verify`: passed — OK

## Combined validation
- Applied the owner-provided backend patch after verifying SHA256 and package scope. Resolved only shared app/runtime imports and equivalent inbound composer formatting; retained both coaching and checkout composition.
- Server typecheck passes; combined server/provider suites441 pass,92 integration suites opt-in/skip,0 fail.
- Isolated Postgres purchase/claim/retry/ledger + credential upgrade + scripts:3 pass,85 assertions. No real provider calls/payments.
- Strict review:0 findings. Edge proxy already forwards /v1/*; no Worker/auth-route changes needed.
- Preserve script migration015 and current frontend assets. No direct subscription selector page added by this task. Website owner retains general checkout UX follow-ups.
