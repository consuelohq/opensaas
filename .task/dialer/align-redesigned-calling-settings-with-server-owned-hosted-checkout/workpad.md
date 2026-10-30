# Align redesigned calling settings with server-owned hosted checkout

branch: `task/dialer/align-redesigned-calling-settings-with-server-owned-hosted-checkout`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2713/align-redesigned-calling-settings-with-server-owned-hosted-checkout
github pr: https://github.com/consuelohq/opensaas/pull/2713
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

- 2026-10-30 22:32:12 `verify`: passed — OK

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

## Test-first contract

DEV-1648 continuation. Original UI task2711 was already merged/deleted by normal stream promotion; do not resurrect it. This managed follow-up carries only the verified three-file checkout/catalog adjustment into the same stream.

Behavior: new trials must open the configured server-owned website checkout in a separate tab, and cannot reach legacy-priced billing. Gate checkout/purchase claim on new backend contract publicPurchase. Learn more stays on public pricing. Catalog display name is server-owned. Existing active legacy subscriptions keep existing controls.

Existing patterns: commercial-ui.acceptance.test.ts and openHostedBilling. First import the changed acceptance assertion only, prove it fails against the old direct hardcoded website link, then apply the two implementation file hunks. No new backend, payment, number, media or OS authentication effects.

Source evidence/remaining work: /private/tmp/consuelo-calling-ui/*.json, *.png, hosted-checkout-followup.patch; previous task tsk_5385a75d6dc3. Strict/full gates and 197 package tests had passed on exact same three-file patch in previous worktree. Repeat task-scoped validation before publication. Preserve other agents’ stream work.
