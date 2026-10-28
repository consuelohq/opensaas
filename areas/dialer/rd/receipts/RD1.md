# RD1 receipt

- Work ID / graph revision: RD1 / rd-1.
- Observation: 2026-09-10 03:37 UTC, before task promotion.
- Status: validated_pending_promotion. Resolve PR state and merge SHA live.
- Task: tsk_27858470a64a.
- Branch: task/dialer/rd1-durable-inbound-lifecycle-event-and-command-contracts.
- Worktree: /Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd1-durable-inbound-lifecycle-event-and-command-contracts.
- Task PR: https://github.com/consuelohq/opensaas/pull/2448.
- Integration target: stream/dialer.
- Stream review PR: https://github.com/consuelohq/opensaas/pull/2436.
- Validated base: 91fcb9662e3eec519a1f8ad082a1717dbcfdb031.
- Task head: bootstrap cd20f0e1e8e03a07beb18bcf8b54eee45f95429f plus validated working diff;
  final publication SHA belongs to the live PR and coordinator handoff.

## Prerequisites

RD0 PR #2442 is merged, contract frozen. Foundation PR #2446 is merged at the
validated base above. See FOUNDATION.md for source-package equivalence to
37c6531965a365e5886f5c75fdec275c6e330430 and the additive migration-005 rollback
repair. This does not claim that the entire algorithm/OS cleanup reached main.
Independent cleanup PR #2445 merged into stream/dialer-algorithm during RD1;
some broader CI checks failed at the last observation. Preserve its owner's work.

## Scope and behavior

SDK `src/inbound` owns versioned identity/event/command/decision contracts, the
pure six-lifecycle reducer, replay and Effect journal/outbox ports.
Server `src/inbound` owns migration 006, checked-client PostgreSQL transactions,
normalized-fact deduplication, optimistic state versions, same-tenant entity links,
append-only event/decision/outcome history and durable commands.

Decisions capture and validate pre-transition request/capacity evidence; proposals
remain distinct from committed assignment or media outcomes. Duplicate facts
cannot create duplicate events/commands. Terminal late facts cannot revive legs.
Expired offers cannot accept. Unknown effect outcomes require reconciliation;
the outbox cannot redispatch unknown work. Replay returns state without effects.

See packages/dialer-server/src/inbound/README.md for API boundaries, stable
deduplication identity expectations, trusted evidence classification, command
recovery, schema evolution and downstream ownership. The initial per-tenant
transaction lock prioritizes correctness; throughput is not established.

## Acceptance

- RED: lifecycle import missing (1 failure), then GREEN: initial 6 domain tests.
- RED: service result lacked inbound proof; GREEN after PostgreSQL implementation.
- Additional RED/GREEN: expired assignment acceptance and a bridge command caused
  by the wrong lifecycle.
- Final package suites: `bun test packages/dialer/src packages/dialer-server/src`:
  403 pass, 1 opt-in lab skip, 0 fail, 1426 expectations across 63 files.
- `NX_DAEMON=false yarn nx run-many -t typecheck -p @consuelo/dialer @consuelo/dialer-server`:
  both projects passed.
- `NX_DAEMON=false yarn nx run @consuelo/dialer-server:lab:verify`:
  1 pass, 0 fail, 29 outer expectations plus the inbound scenario assertions.
  Uses isolated real Postgres/Redis and the production migrations/adapter.
  Proves concurrent duplicate ingestion, one version writer, one outbox claimant,
  transactional rollback, tenant/reference isolation, immutable decision/history,
  replay equivalence without effects, unknown command reconciliation, populated
  inbound up/down/up and preservation of outbound observations. Services and
  temporary data are removed afterward.
- Canonical `verify` at the base above: full pass, publishValid=true,
  zero new/related/pre-existing review findings, database checks pass.
- Formatting exposed a pre-existing lab error-rule heuristic; retained existing
  unrelated lab formatting and reran verification successfully.

## Limitations and next wave

No HTTP/provider integration, live calls, production migration, customer data,
deployment or provider spend. Not yet a working inbound product. RD3 still owns
shared capacity ownership/generations, endpoint winning and wrap-up policy;
RD5 owns authenticated provider evidence, media and external reconciliation.
RD2 adds reusable simulator, crash/restart and multiple-process scenarios.
RD6 supplies callback scheduling/rescheduling semantics. Versioned extension
must precede new persisted event/state fields; never reinterpret old history.

Migration 006 down removes inbound data and refuses newer migrations. A deployed
rollback requires a backup and explicit recovery plan. Only isolated local
resources were migrated here.

At publication, use normal task.finish after safe merge inspection. Preserve any
dirty lifecycle/recovery worktree and identify it in the final handoff.
No sibling cleanup resources were modified.

Suggested next: RD2 and RD3 become technically ready after verified RD1 stream
promotion and a fresh ownership/review scan. They may run in parallel with distinct
harness vs production ownership. RD4 waits for both. This receipt does not authorize
starting another node. Return the COORDINATION.md handoff and await Ko's selection.

## Follow-up acceptance

PR #2451 addresses the late migration002–004 rollback review and the compiled
RD1 Node import defect. See [FOUNDATION-REVIEW.md](FOUNDATION-REVIEW.md). Resolve
that correction on stream/dialer before launching RD2/RD3.
