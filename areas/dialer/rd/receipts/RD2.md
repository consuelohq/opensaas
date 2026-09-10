# RD2 receipt

- Work ID / graph revision: RD2 / rd-1.
- Observation: 2026-09-10 16:05 UTC, before publication.
- Status: validated_pending_promotion; resolve task PR live for merge state/SHA.
- Task: tsk_a1dba786266f.
- Branch: task/dialer/rd2-inbound-simulation-replay-and-failure-testing-lab.
- Task PR: https://github.com/consuelohq/opensaas/pull/2453.
- Stream review: https://github.com/consuelohq/opensaas/pull/2436.
- Source: e79b01b786a1cb62b779c3a0adcf2715db4773c3, verified ancestor.
- Prerequisites: #2446, #2448, #2451 merged into stream/dialer; no task-level
  inline/formal findings or active RD2/RD3 owner found at startup.
- Ownership: server lab simulator, worker protocol/process runner, scenario fixtures,
  evidence capture, lab teardown and its entry/test, INBOUND.md, this receipt.
  No SDK/domain, migration, production executor or RD3 capacity changes.

## Delivered behavior

The existing isolated lab now runs fourteen inbound scenarios and twenty-three
independent worker processes. It uses the production migrations, SDK reducer and
Postgres journal/outbox factory. Simulated provider/endpoint and clock controls
are opt-in lab code, never imported by the production runtime entry.

Proof covers five actual SIGKILL checkpoints, committed-fact redelivery, cross-process
duplicate/version/dispatch races, lost provider response and unavailable lookup,
known rejection, delayed endpoint acceptance after expiry, caller hangup with
unknown bridge, repeatable seeded dropped/duplicated/reordered delivery, and replay
without appended effects. Simulated carrier execution counts expose duplicate sends.
Every worker is awaited. Independent service-stop attempts and port-close checks
protect teardown; failures preserve still-live temporary resources.

See packages/dialer-server/src/lab/INBOUND.md for commands and extension contracts.
Each emitted scenario includes worker checkpoints, normalized event history,
materialized state, durable command/outcome history and simulated effect counts.

## Acceptance evidence

- RED: simulator module absent; GREEN: four simulator tests.
- RED: service result lacked RD2 evidence; GREEN after integration. Added endpoint/
  abandonment cases expanded the lab from 12 to 14 scenarios.
- RED: cleanup helper absent; GREEN: both stops attempted on failure and removal only
  after ports close. Worker protocol tests reject remote/default-port/customer
  resources, tenant crossing, truncated and oversized messages.
- Package suites: 414 pass, 1 opt-in lab skip, 0 fail; 1486 expectations / 66 files.
- Both Nx typechecks and both builds (plus dependencies) passed.
- Nx lab:verify passed. Final direct smoke at seed 4242: 14 scenarios, 23 workers,
  all exited, Postgres/Redis closed, temporary directory removed.
- Detailed synthetic transcript from that run:
  /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-rd2-proof-k2cyfhgv/lab.json.
  This local artifact is disposable; the command/seed and assertions are durable.
- Canonical review/verify, final diff and publication evidence belong to the scoped
  workpad and linked PR. No failed gate is waived by this receipt.

## Limits and next step

This is simulated provider evidence with real services and application worker
crashes. It is not real media, production activation, Redis server failover, or
database/power-loss durability proof. The inherited performance cluster disables
fsync/synchronous commit. Redis loss here means deleting a synthetic presence key.
Process-race winners can vary; seeded delivery traces reproduce, OS scheduling does not.

Connecting/unknown capacity is deliberately protected in fixtures. RD3 owns actual
capacity generation/winner/release policy; RD5 owns production executor, authenticated
provider evidence and carrier/media reconciliation. The simulator's authoritative
absent result must not be assumed for a real eventually consistent carrier.

After verified integration, RD3 is next if not already owned/integrated. Refresh all
ownership, current receipts and late reviews; RD4 waits for both RD2 and RD3.
No other node was launched. No customer resources, real calls, charges, recording,
main promotion or deployment. Clean only this task's worktree/tmux after safe
publication; preserve any recovery-needed resource and name it in the handoff.

## Late coordination refresh (2026-09-10 16:07 UTC)

RD3 is actively owned by PR #2454, task/dialer/rd3-shared-rep-capacity-offer-fencing-and-wrap-up.
Do not launch another RD3. RD4 still waits for its integration and acceptance.
Stream comment3980965865 identifies a P1 foundation concern in runtime/railway.ts:
partial provider-group creation can bypass predictive-decision finalization.
This predates RD2 and is outside the lab-owned surfaces. The coordinator must
assign/verify that correction and classify its impact before declaring the join
ready. RD2 validation does not resolve or waive that scientific-evidence finding.
