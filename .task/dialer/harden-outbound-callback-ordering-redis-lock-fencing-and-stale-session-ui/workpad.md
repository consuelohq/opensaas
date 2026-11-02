# Harden outbound callback ordering, Redis lock fencing, and stale session UI

branch: `task/dialer/harden-outbound-callback-ordering-redis-lock-fencing-and-stale-session-ui`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2766
started: 2026-11-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer/src/domain/parallel-transition.spec.ts`
- `packages/dialer/src/infrastructure/memory/parallel-state-store-layer.test.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/inbound-operator.test.ts`

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

## Wave 2 — Test-first contract

Behavior under test:
1. Outbound Twilio callbacks cannot regress a leg from answered/ringing to earlier progress; repeated or late callbacks cannot issue unsafe winner actions; terminal remains immutable.
2. After group-lock lease ownership is lost, old workers cannot persist group state or claim a winner; state commits must be atomically fenced against the Redis lock token. An expired lease must fail the enclosing Effect rather than returning an early success. Before external provider cleanup, check current lock ownership; explicitly document non-atomic provider boundary and preserve idempotent cleanup behavior.
3. A delayed session poll or transfer status cannot overwrite newer active session state or resurrect a returned-home call; a stale inbound snapshot cannot overwrite newer server time or reject current browser work.

Existing patterns: packages/dialer/src/domain/parallel-transition.spec.ts, infrastructure/redis/redis-parallel-store.test.ts (FakeRedis eval simulation), infrastructure/memory/parallel-state-store.ts (Effect adapter), packages/lead-connector/src/embed/controller.test.ts and inbound-operator.test.ts.

New or changed tests: ordered callback permutations; lost lease after atomic lock replacement, stale winner/group writes, and Effect error forwarding; deferred promises for overlapping active-session polls / return home; inbound serverTime older than last applied snapshot.

Focused RED commands:
- bun test packages/dialer/src/domain/parallel-transition.spec.ts packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts
- bun test packages/lead-connector/src/embed/controller.test.ts packages/lead-connector/src/embed/inbound-operator.test.ts
Expected red: out-of-order status becomes ringing, stale Redis lock can overwrite group/winner, stale async UI poll replaces active session, older inbound snapshot overwrites newer.

Safety and scope: new isolated task from current stream/dialer SHA 1934aba45283; no live calls, credentials, billing, deployment, main merge, or edits outside task worktree. Follow test-first, run targeted tests/typecheck/build then review.run strict, verify, task.push/task.pr only after gates.

- 2026-11-02 02:55:24 append: `.task/dialer/harden-outbound-callback-ordering-redis-lock-fencing-and-stale-session-ui/workpad.md`

## workspace-owned: files changed

- `packages/dialer/src/domain/parallel-transition.spec.ts`
- `packages/dialer/src/infrastructure/memory/parallel-state-store-layer.test.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/inbound-operator.test.ts`

## workspace-owned: activity log

- 2026-11-02 02:55:24 fs.write: `.task/dialer/harden-outbound-callback-ordering-redis-lock-fencing-and-stale-session-ui/workpad.md`
- 2026-11-02 02:56:05 append: `packages/lead-connector/src/embed/inbound-operator.test.ts`
- 2026-11-02 02:56:05 append: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-02 02:56:05 fs.write: `packages/lead-connector/src/embed/inbound-operator.test.ts`
- 2026-11-02 02:56:05 append: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-11-02 02:56:05 append: `packages/dialer/src/domain/parallel-transition.spec.ts`
- 2026-11-02 02:56:05 fs.write: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-11-02 02:56:05 fs.write: `packages/dialer/src/domain/parallel-transition.spec.ts`
- 2026-11-02 02:56:05 write: `packages/dialer/src/infrastructure/memory/parallel-state-store-layer.test.ts`
- 2026-11-02 02:56:05 fs.write: `packages/dialer/src/infrastructure/memory/parallel-state-store-layer.test.ts`
- 2026-11-02 02:58:38 append: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-02 02:58:38 fs.write: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-11-02 02:58:59 append: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-11-02 02:58:59 fs.write: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-11-02 02:59:40 fs.write: `.task/dialer/harden-outbound-callback-ordering-redis-lock-fencing-and-stale-session-ui/workpad.md`
- 2026-11-02 03:02:24 fs.write: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-11-02 03:04:05 fs.write: `.task/dialer/harden-outbound-callback-ordering-redis-lock-fencing-and-stale-session-ui/workpad.md`

## Implementation and verification log — 2026-11-01

RED reproduced before fixes: 6 failures in dialer-focused tests (callback order, Redis lease protection, Effect early-success), 3 failures in embed tests (stale outbound requests and inbound snapshot), and 1 subsequent stale-rejection test.

GREEN after fixes: dialer 276 passed; LeadConnector 243 passed; dialer-server 240 passed, 102 skipped (real PostgreSQL and other environment-dependent integration tests). All three package typechecks pass. Dialer package build and embed package build pass. `git diff --check` is clean.

Changes: monotonic call-status transitions and preserving confirmed human AMD; atomic lock-token-verified Redis group/winner/mapping/registration/telemetry/deletion writes; Effect adapter only returns after successful lock completion; lease precheck before provider cleanup; outbound per-request/session response and error gating; inbound serverTime monotonic snapshots and media side-effect gates.

Provider safety caveat: Redis Lua fencing is atomic for Redis state, but remote carrier side effects cannot be atomically committed with Redis. Each provider command checks the lease immediately before dispatch; existing idempotency, cleanup/reconciliation remain essential. No carrier call was initiated.

Next gates: strict review.run, formal verify, then task.push/task.pr to stream/dialer only. No main merge or deployment authorized.

- 2026-11-02 02:59:40 append: `.task/dialer/harden-outbound-callback-ordering-redis-lock-fencing-and-stale-session-ui/workpad.md`

## workspace-owned: validation evidence

- 2026-11-02 03:01:24 `review.run`: passed — OK
- 2026-11-02 03:01:42 `review.run`: passed — OK
- 2026-11-02 03:01:47 `review.run`: passed — OK
- 2026-11-02 03:02:24 append: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-11-02 03:03:15 `review.run`: passed — OK
- 2026-11-02 03:03:42 `verify`: failed — COMMAND_FAILED
- 2026-11-02 03:04:15 `review.run`: passed — OK
- 2026-11-02 03:04:27 `verify`: passed — OK

## Final review correction

Formal verification first selected package tests successfully but blocked publication on a related-pre-existing ERROR_HANDLING finding in the touched LeadConnector controller: cancelTransfer lacked the try/catch normalization present in initiateTransfer and completeTransfer. Applied the minimal consistent error-boundary fix. Re-run strict review and verify on final worktree before publication. Formatter diagnostics also occur on unchanged baseline files; do not reformat entire files or widen diffs unnecessarily.

- 2026-11-02 03:04:05 append: `.task/dialer/harden-outbound-callback-ordering-redis-lock-fencing-and-stale-session-ui/workpad.md`
