# Repair Bun Stripe webhook verification and publish pricing preview

branch: `task/website/repair-bun-stripe-webhook-verification-and-publish-pricing-preview`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2714/repair-bun-stripe-webhook-verification-and-publish-pricing-preview
github pr: https://github.com/consuelohq/opensaas/pull/2714
started: 2026-10-30

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

- 2026-10-30 22:44:43 `verify`: passed — OK

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Scope and test-first contract
Follow-up to merged #2710, whose remote branch was automatically deleted. Carry only the five verified repair files; do not recreate or force-push the merged branch.
Acceptance: real SDK validates valid Stripe signatures under Bun; stale/tampered data is rejected before persistence; deployed actual Stripe expiry is acknowledged; pricing preview has enabled real checkout and all requested visual refinements. Preserve existing paid subscribers, calling UI/edge ownership, and production marketing domains. No payment/card entry or carrier call.
Test-first evidence: prior managed task tsk_d7a98df5be09 reproduced failure using real Stripe WebCrypto plus application dispatch. Focused red 1 pass/1 fail; async repair green 23 tests/78 assertions and typecheck. Full gate passed seven suites and DB guard immediately before transport. New task repeats exact-source gate after verified file transfer. Pricing browser visible-label fix already passed full eight viewports.
Plan: carry exact repair, verify/push/promote, deploy Railway and isolated Pages preview, prove browser-to-Stripe and signed expiry, update DEV-1644 and coordinator contract.
