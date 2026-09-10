# RD dependency graph and work contracts

Graph revision: draft-1. Coordination protocol is established by RD0.
Implementation freeze: NOT YET APPROVED. Resolve DESIGN.md decisions before RD1.
All task branches target stream/dialer; independent PR cleanup is an external gate.

## Dependencies and waves

| ID | Depends on | Primary ownership |
| --- | --- | --- |
| RD0 | Ko's planning authorization | This coordination pack, alignment, final node contracts |
| RD1 | Frozen RD0 + verified existing-foundation integration | Domain/state/port contracts, initial durable schema |
| RD2 | RD1 | Isolated lab, carrier simulator, scenario/replay/fault infrastructure |
| RD3 | RD1 | Rep capacity authority, offer leases, acceptance fencing, wrap-up |
| RD4 | RD2 + RD3 | Queue/rep policy, bounded retry/overflow, routing evidence |
| RD5 | RD4 | Signed inbound transport, carrier/media adapters, bridge/recovery |
| RD6 | RD5 | Immediate/scheduled callback obligations and calendar adapter contracts |
| RD7A | RD4 | Rep/operator UI and thin UI-facing adapters against frozen contracts |
| RD7B | RD6 | Customer call/callback/booking entry and cancellation UI |
| RD8 | RD1 + RD2 + RD3 + RD4 + RD5 + RD6 + RD7A + RD7B | Integrated acceptance, review, scoped release and cleanup join |

Planning: RD0 alongside existing PR cleanup.
Wave 1: RD1.
Wave 2: RD2 and RD3 can run in parallel.
Wave 3: RD4.
Wave 4: RD5 and RD7A can run in parallel.
Wave 5: RD6.
Wave 6: RD7B.
Join: RD8.

RD7A may develop against stable application fixtures while RD5 implements carrier
behavior. Its live acceptance waits for RD5. Overlap is conditional: RD5 owns
carrier/runtime composition, RD7A owns UI; jointly touched bootstrap/contracts
need one integration owner. RD2 and RD3 own distinct harness/production modules.

## RD0 — Product and architecture contract

Purpose: make subsequent manual branches bounded and self-orienting.
Changes: canonical stream entry, coordination protocol, graph, durable design,
test strategy, per-node receipt convention, and resolved product/provider choices.
Acceptance: stream-context discovery works in the task; documents/links/IDs agree;
every implementation node has concrete scope and falsifiable gates; Ko has
resolved material alignment choices; existing-foundation gate is explicit.
Non-goals: implementing runtime, auto-launching siblings, editing the global Branch
skill, purchasing infrastructure, or declaring old unverified PRs complete.
Integration: coordination documents may merge while RD0 remains alignment_open.
Next in that case is an RD0 continuation, not RD1.

## RD1 — Durable lifecycle and event contracts

Purpose: establish requests, legs, assignments, bridge attempts, callback obligations,
rep capacity identities, and the initial routing-decision artifact schema.
Owns: provider-neutral SDK domain/ports and focused dialer-server migrations/adapters.
Changes: legal transitions; tenant-scoped event ingestion; state-version checks;
transactional event/state/command persistence; schema versioning and replay boundary.
Acceptance: duplicate events cannot duplicate commands; replay reconstructs state
without reissuing effects; old facts cannot revive terminated legs; contradictory
timestamps/outcomes fail appropriate validation; real Postgres migration/upgrade proof.
Non-goals: provider requests, complete scheduler, UI, or learned routing.
Integration/rollback: additive versioned contracts and migrations; existing outbound
behavior stays intact. Back up before applicable deployed schema changes.

## RD2 — Simulation and failure-testing lab

Purpose: reproduce distributed failures before carrier integration.
Owns: reusable dialer-server lab/scenario infrastructure, not RD3 production logic.
Changes: controllable time, carrier and endpoints; event ordering/loss/duplication;
crash checkpoints; deterministic seeds; scenario output with durable-state evidence.
Acceptance: isolated real Postgres/Redis migrations; reproducible traces; multiple
processes where races matter; cleanup; production credentials/providers unused.
Non-goals: making fake media evidence count as a real call or rewriting product code.
Integration: use the same application factories and schemas as deployment, with
test adapters/isolated resources. Each later node contributes its own scenarios.

## RD3 — Rep capacity, offers and fencing

Purpose: one shared authority for inbound and outbound capacity.
Owns: capacity/reservation service, endpoint offer generation, acceptance and wrap-up.
Changes: separate offer deadline and ownership; generation checks; atomic first-valid
accept; protected connecting/unknown states; recovery and operator escalation.
Acceptance: concurrent callers cannot own one capacity slot; expired generations
cannot accept; endpoint losers cannot win later; offer expiry cannot free unknown
external work; stale presence cannot override occupancy; terminal cleanup is idempotent.
Non-goals: carrier effect execution, queue optimization, or freeing active calls on TTL.
Integration: no second independent reservation authority in Redis or TaskRouter.

## RD4 — Queue policy and routing evidence

Purpose: explainable caller selection and eligible-rep allocation.
Owns: SDK policy and immutable routing decision artifacts, not transport.
Changes: eligibility constraints; documented ordering/ties; aging; cooldowns;
bounded reoffers; business hours; overflow; relevant decision-time snapshots.
Acceptance: FIFO/affinity/skill/fairness boundaries; no endless reoffer; no immediate
retry to a cooled-down rep; scarce-skill cases; actual reservation outcome distinguished
from proposed assignment; adversarial scenarios using RD2/RD3.
Non-goals: learned policy, causal claims from deterministic logs, or static matching
described as a proven optimal dynamic policy.
Integration: version policies and retain deterministic fallback plus evidence.

## RD5 — Live inbound telephony and recovery

Purpose: retain the already-live caller while connecting an eligible human rep.
Owns: Hono signed ingress, tenant/DID binding, provider adapters, waiting experience,
rep browser/phone delivery, bridge commands, participants, transfer/recovery seams.
Changes: bounded webhook responses; waiting/DTMF/hangup events; offer delivery;
authorized endpoint admission; bridge evidence; uncertain-effect reconciliation;
connection recovery and capacity release through RD3.
Acceptance: real application + simulator end-to-end first; public signature/route
proof; separately authorized real-call ladder; no false connected state or orphaned
legs; restart continuity; transfer boundaries; no outbound regression.
Non-goals: redialing the inbound customer or claiming browser presence proves audio.
Integration: per-number opt-in and rollback to verified existing behavior. Customer-
side browser ingress is included only if RD0 explicitly selects it, before RD7B UI.

## RD6 — Immediate and scheduled callbacks

Purpose: fulfill an explicit durable customer request once a caller leg no longer
exists or has not yet been created.
Owns: obligation scheduler, consent/eligibility ports, cancellation/no-answer policy,
rep-first initiation and provider-neutral calendar integration.
Acceptance: no reservation hours before due time; no duplicate initiation from retry;
customer no-answer releases the rep correctly; cancellation during dialing reconciles;
original entry/deadline retained; timezone/DST, rescheduling, and restart proofs.
Non-goals: automatic marketing after a generic form or unsupported place-preservation
promises; booking alone does not prove consent or staffed capacity.
Integration: customer-facing activation requires chosen jurisdiction/provider policy.

## RD7A — Rep and operator UI

Purpose: make authoritative routing state usable.
Owns: rep/operator UI and narrow adapters against RD1/RD4 contracts.
Changes: readiness/endpoint selection, incoming offer, recovery, wrap-up, queue
visibility, number/team/hours/overflow configuration, manual operational recovery.
Acceptance: browser E2E including concurrent tabs, stale Accept, reconnect, expiry,
permissions, failed devices and truthful media status; live proof joins with RD5.
Non-goals: client-owned routing or local timers that grant capacity.
Integration: preserve existing LeadConnector launcher and outbound flows.

## RD7B — Customer entry and booking UI

Purpose: direct inbound calling and explicit callback requests.
Owns: phone call links, callback/booking/cancellation UI and narrow adapters.
Acceptance: duplicate submissions, abuse boundaries, timezone and promise accuracy,
permission evidence, no available staffing, full obligation fulfillment/cancellation.
Non-goals: implied marketing permission, invented ETA, or adding an unapproved
customer-browser telephony stack inside a UI task.
Integration: customer-browser UI depends on the corresponding approved RD5 adapter.

## RD8 — Integrated acceptance and release

Purpose: deliberate join for all release-blocking work.
Changes: reopen every task/stream PR and late review; verify prerequisites and
scientific invariants; reconcile current main; fix graph-attributed integration
defects; prove stream integrity; safe resource cleanup; publish approved artifacts.
Acceptance: integrated lower-level/browser/service tests, failure/load scenarios,
separately authorized real calls, explicit deployed SHA/config evidence, rollback
and recovery gates, no orphaned capacity/media, no exposed PII/secrets.
Non-goals: hiding new product work in finalization or assuming earlier node approval
authorizes main promotion, calls, provider spend, recording, or production activation.
Release authority: freeze the exact permitted promotion/deployment/live scope before
RD8 executes. This draft is not authorization for those operations.
