# RD4 deterministic inbound queue routing and decision evidence

branch: `task/dialer/rd4-deterministic-inbound-queue-routing-and-decision-evidence`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2464
started: 2026-09-13

## acceptance criteria

- [x] Define bounded RD4 ownership and test-first contract below.
- [x] Implement and validate routing, transactions, replay and safe migration.
- [x] Strict review and canonical verification.
- [ ] Publication and safe cleanup.

## plan

1. Completed prerequisite inspection and policy design.
2. Completed SDK/server implementation and isolated validation.
3. Finish canonical gates, publish, verify stream ancestry and clean owned resources.

## files changed

- `packages/dialer/src/inbound/routing-policy.test.ts`

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

## RD4 ownership and test-first contract

Ko explicitly designated this task RD4 and approved implementation. Work only on SDK deterministic routing, server transactional routing configuration/decision/outcome persistence and RD3 composition seam, migration/rollback integration, meaningful policy and real-service scenarios, RD4 guide/receipt. Preserve RD2 and RD3 behavior; no live transport, UI, recording, callbacks execution or deployments.

Behavior: FIFO serviceable caller selection; due callbacks retain original age; hard tenant/queue/skill/readiness/capacity constraints; available owner preference once then longest-idle team; bounded attempts/cooldowns/wait fallback; hours/holidays/closure; immutable decision-time evidence committed atomically with actual fenced reservation. Unknown effects remain owned. Versioned histories and retry operation identity survive process restart.

Test-first: add focused SDK tests importing new routing evaluator and demonstrate missing module RED; then implement and expand adversarial cases. Add opt-in real Postgres tests using existing isolated lab cluster pattern; prove duplicate tick, competing request/rep, transaction rollback, no false committed evidence, immutable history, migration up/down/up and protected unknown. Run existing RD2 simulation lab plus both package tests/typechecks/builds; strict review and canonical verification before publication.

Prerequisite review classification (2026-09-13): #2436 comment3980965865 is a valid pre-existing outbound partial-provider-creation experiment-evidence issue in runtime/railway.ts, not a missing inbound capacity/routing contract. RD4 does not execute that path and will independently persist proposal/committed reservation atomically before provider dispatch. Keep it an unresolved foundation/release blocker for RD5/RD8; no waiver or causal-learning claims. Comment3981314996 is pre-existing commercial-target-authorization test fixture hygiene, outside RD4 files, to be retained in join review; RD4 uses symbolic IDs and no phone literals. Neither prevents isolated inbound implementation; neither is marked fixed. Nx Cloud is not configured; use one read-only GitHub CI snapshot rather than pretend Nx monitoring is available.

- 2026-09-13 15:54:34 append: `.task/dialer/rd4-deterministic-inbound-queue-routing-and-decision-evidence/workpad.md`

## workspace-owned: files changed

- `packages/dialer/src/inbound/routing-policy.test.ts`

## workspace-owned: activity log

- 2026-09-13 15:54:34 fs.write: `.task/dialer/rd4-deterministic-inbound-queue-routing-and-decision-evidence/workpad.md`
- 2026-09-13 15:55:17 write: `packages/dialer/src/inbound/routing-policy.test.ts`
- 2026-09-13 15:55:17 fs.write: `packages/dialer/src/inbound/routing-policy.test.ts`

## Validation checkpoint — 2026-09-13 16:13 UTC

452 tests pass, zero failures, 1692 assertions/70 files including actual isolated RD3/RD4 Postgres and RD2 Postgres/Redis lab. Both Nx typechecks/builds pass. See ROUTING.md and RD4 receipt for public contracts and prerequisite classifications. Strict review initial invocation timed out after a mistakenly short explicit timeout; inspect its durable run before retry. No source review result claimed yet. The isolated RD4 Postgres resource remains running until final verification.

## workspace-owned: validation evidence

- 2026-09-13 16:14:31 `review.run`: passed — OK
- 2026-09-13 16:15:21 `review.run`: passed — OK
- 2026-09-13 16:15:42 `verify`: passed — OK
- 2026-09-13 16:16:27 `verify`: passed — OK

## Final local gates — 2026-09-13 16:16 UTC

Review found six missing local async error boundaries; contextual typed handlers added without changing transaction authority. Strict review rerun passed with zero findings. Canonical verify passed (full, publish-valid, 17 files). Complete 452-test service-backed suite rerun after fixes passed. Both package typechecks/builds passed; only contextual catches changed since builds and review typecheck passed. Task-scoped stream.context resolves current areas/dialer/AGENTS.md and lists only RD4 among active RD nodes; RD5/RD7A have not started.
