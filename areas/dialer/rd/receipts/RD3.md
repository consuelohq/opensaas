# RD3 receipt

- Work ID / graph revision: RD3 / rd-1.
- Observation: 2026-09-10 16:35 UTC, before publication.
- Status: validated_pending_promotion; resolve task PR live for merge state/SHA.
- Task: tsk_c25c239ad74d.
- Branch: task/dialer/rd3-shared-rep-capacity-offer-fencing-and-wrap-up.
- Task PR: https://github.com/consuelohq/opensaas/pull/2454.
- Stream review: https://github.com/consuelohq/opensaas/pull/2436.
- Original source: e79b01b786a1cb62b779c3a0adcf2715db4773c3.
- Combined validation base: 13134a0fc959ca03acecaf55044a83be70064947, RD2 #2453 merged.
- Prerequisites #2446/#2448/#2451 are merged ancestors.
- Ownership: SDK capacity contracts/reducer/port; server Postgres authority,
  journal composition/dispatch guard, additive migration 007, capacity tests,
  integration guide, this receipt and scoped workpad.
- Shared integration: after RD2 merged, RD3 owns the minimal migration-007 additions
  to the lab rollback entry and learning rollback sequence. RD2 simulator, workers,
  scenarios, evidence/cleanup modules and receipt are unchanged.

## Delivered behavior

One workspace/rep voice slot is shared by inbound and outbound assignment directions.
Fresh readiness, endpoint health, manual status, cooldown and ownership are separate.
An offer deadline never releases an escaped/unknown effect. Generation and version
checks select one committed browser/phone acceptance and invalidate losing endpoints.

Offer/bridge dispatch atomically claims its durable command with capacity protection.
A second active/unresolved bridge command cannot claim the same assignment. Generic
journal mutation/dispatch cannot bypass managed capacity fencing. Unknown states survive
service recreation and expose bounded discovery for reconciliation/escalation. Confirmed
termination enters wrap-up; timeout or authenticated manual completion restores capacity
without overriding manual away. Repeated operation identities return original results,
changed payloads collide, and replay creates no effects.

Migration 007 stores a separately versioned aggregate and immutable history while
atomically projecting compatible RD1 facts/commands. Down rejects owned calls and locks
against concurrent writes. Retained assignment history seeds re-registration generations
after rollback/reapply, preventing old fences from becoming current.

Integration contract: packages/dialer-server/src/inbound/REP-CAPACITY.md.

## Acceptance evidence

- Test-first RED: missing reducer API; GREEN: eight adversarial domain tests.
- Real Postgres RED exposed generic command-dispatch bypass; fixed through managed
  authority guards. Additional RED checks exposed missing restart enumeration and
  competing bridge dispatch; both now pass.
- Real isolated Postgres: eight capacity integration cases with independent connections,
  racing callers/directions/endpoints, idempotency, transaction rollback, abandoned
  requests, unknown work, replay, discovery, wrap-up and migration down/up.
- Combined command:
  CONSUELO_RD3_PG_PORT=62593 CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION=1
  bun test packages/dialer/src packages/dialer-server/src
  Result: 431 pass, 0 fail, 1599 assertions, 68 files. Port is this run's disposable
  loopback cluster; a future run supplies its own isolated port.
- RD2 local lab passed with real Postgres/Redis, its existing worker crash/simulation
  assertions, all seven production migrations and verified teardown.
- Both Nx typechecks and both builds (including compiled SDK Node import smoke) passed.
- Strict scoped review against the combined base: zero findings, zero failed suites.
  Canonical verification/publication evidence is recorded by the task workflow and PR;
  this receipt does not waive a failed gate.

## Limits and readiness

No provider calls, production migration, recording, deployment or main promotion.
These are database and simulated-media proofs, not real carrier/media acceptance.
RD5 must authenticate evidence and compose BOTH live inbound and outbound paths through
this authority before activation. The existing outbound runtime is not switched here.
Unknown reconciliation is a trusted internal assertion; the adapter must prove all
relevant effects absent/ended or both actual participants connected. API command success
alone is not media evidence. RD4/RD5 own scheduler/retry and operator delivery.

RD2 is merged and RD3 was the only active RD node found in the full stream PR scan.
The coordinator must refresh ownership and late reviews before RD4. A late pre-existing
foundation P1 remains to be resolved/classified:
https://github.com/consuelohq/opensaas/pull/2436#discussion_r3980965865
Partial provider group creation can skip predictive-decision finalization in runtime/
railway.ts. RD3 does not touch that outbound experiment path or waive the finding.
Do not declare RD4 ready solely from RD2/RD3 merge status.

Cleanup belongs to this task after verified promotion. Final handoff reports exact
merge SHA, remote content verification and own worktree/tmux/service cleanup.
