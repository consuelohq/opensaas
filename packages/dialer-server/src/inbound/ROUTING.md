# RD4 deterministic inbound routing

## Boundary and authority

`createPostgresInboundRouting(pool)` is a trusted application adapter. RD5 owns
authenticated HTTP/carrier ingress, DID-to-tenant binding, the worker loop and real
offer/media effects. RD7A owns thin authenticated UI adapters. Do not expose these
methods directly to untrusted clients or let clients supply authority clocks.

An inbound caller keeps its existing leg. This router never dials the customer.
Callback metadata represents a due routing request projected by RD6; RD6 still
owns explicit permission, obligation identity, scheduling, cancellation,
rescheduling, customer no-answer and actual rep-first execution.

Postgres is the authority. A tick holds the existing RD1 tenant advisory
transaction lock while it reads state, evaluates policy, invokes the RD3 capacity
transition, writes commands and persists the decision. Redis may wake workers or
index queues; it does not own assignment. Runtime composition must route all
inbound AND outbound occupancy through RD3 before enabling inbound traffic.

## Configuration and application calls

1. Register rep capacity/readiness through RD3.
2. `configureQueue(policy, expectedVersion)` installs queue membership, skill
   profiles, hours and retry policy. Version 0 creates; later writes use the
   returned integer. A mismatch rejects instead of overwriting another operator.
3. Create the durable RD1 request with its original `enteredAt` and queue identity.
   Call `configureRequest(workspaceId, requestId, metadata, expectedVersion)`.
   Resolve CRM owner to an opaque rep ID or classify missing/unavailable/ambiguous.
   Normalize skills; never copy phone numbers, names, CRM free text or calendar
   payloads into these records. A metadata update cannot clear attempt history or
   reset a pending fallback.
4. Call `tick({ workspaceId, queueId, decisionId })` after relevant state changes
   and on a bounded scheduling cadence. Reuse decisionId for a retry of the SAME
   logical tick; use a new ID for reevaluation. IDs are tenant scoped; reusing one
   across queues rejects. Duplicate ticks return the original result with
   `duplicate: true`, including its historic reservation (which may now be stale).
5. Dispatch the resulting durable RD3 commands through RD3's guarded dispatch and
   acceptance APIs. Never treat the returned proposal or old duplicate result as
   permission to call Twilio. It is local ownership evidence, not media evidence.
6. Discover pending choices using `listFallbacks(workspaceId, queueId,
afterRequestId?)` (100 rows, ascending request ID). Read the corresponding
   immutable decision with `readDecision(workspaceId, decisionId)`. RD5 delivers
   the callback/voicemail choice idempotently and rechecks live caller state before
   acting. A choice is NOT already a callback obligation or permission to record.
   RD1 terminal caller transitions remove it from discovery. No delivery or
   exactly-once carrier guarantee is claimed by this polling projection.

The Effect layer exposes `InboundRouting.tick` and `routeInboundQueue` in the SDK;
the Promise adapter also exposes configuration, decision reads and fallback
discovery. Tenant configuration/activation requirements remain in DESIGN.md.

## V1 ordering and time rules

A tick chooses at most one offer or fallback. Callers are ordered by original
entry time, then request ID. A caller without an eligible rep does not block a
later serviceable caller. This is FIFO among serviceable callers; it is not global
optimal matching or a guarantee against starvation when required skills are
unstaffed. A finite maximum live wait and offer count end retries.

Rep eligibility requires same tenant, queue membership, all required skills,
manual readiness, fresh presence, a healthy endpoint, no owner, no cooldown and
no still-active repeat exclusion. Busy owners never delay the wider team.
A known eligible CRM owner gets the first attempt only. Otherwise choose longest
idle, then rep ID. Decline/expiry does not restore owner preference.

Repeat exclusion is measured from the previous offer deadline plus
`reofferMilliseconds`, across all capacity slots of that rep. The maximum offer
count comes from durable offer events, not a resettable in-memory counter.
RD3 separately enforces rep cooldown and occupancy. Safe undispatched offers can
expire; dispatched/unknown effects retain capacity until authenticated
reconciliation. A tick also advances elapsed wrap-up and escalates overdue unknown
owners through RD3, without releasing those unknown owners.

Business hours use the queue's IANA timezone and local wall clock, with exclusive
end minute. Split an overnight window across two weekdays. Holiday dates are
local calendar dates. Both repeated DST hours follow the same local window;
nonexistent hours create no operating interval. Emergency closure overrides hours.
When closed, exhausted or too old, a live request gets a persisted fallback
proposal and leaves routing; reopening the queue does not silently reset it.

Callbacks cannot reserve before `notBefore`. Once due, their original queue age
participates in FIFO. At the exclusive deadline they fall back. This window
governs eligibility to BEGIN the rep-offer phase; it does not promise connection
by the deadline. RD6 must recheck its obligation and customer-initiation window,
consent, cancellation and staffing before placing any customer call. Callbacks
are not assigned the live-call patience budget.

The worker scheduler must share ticks fairly across queues and trigger deadline
reevaluation even without new webhooks. Each tick is per queue, not a cross-queue
priority optimizer. Use bounded work/backpressure, not an unbounded busy loop.

## Decision evidence and replay

Migration `20260913_008_inbound_routing` adds configuration/entry tables and an
append-only `dialer_routing_decisions` table. RD1's schema-1 decisions remain
unchanged. RD4 frames/evaluations are schema 2.

Each successful tick stores the exact queue policy/version, request metadata
versions, normalized request/attempt state, all tenant capacity snapshots,
decision time, policy version, considered callers and candidate exclusions for
the selected/waiting caller. The result separately stores the actual committed
reservation and fencing generation. Candidate formation is explicitly bounded:
at most 1,000 tenant capacity records and 1,000 active registered requests in that
queue; more rejects the entire tick rather than silently truncating. Attempt
evidence is capped at 100,000 events and similarly fails closed. These are
operational bounds, not load/performance certification. Monitor admission and
alerts before reaching them; configuration currently does not enforce admission
capacity on its own.

Call `evaluateInboundRouting(savedFrame)` to replay the pure policy without
commands. Reads return the saved result; a new tick is not replay. A database
write failure rolls back both reservation and decision. Failed transactions do
not pretend to be successful decisions; the caller must report/retry errors.
Persisted proposal/reservation evidence does not prove offer pickup, connection,
abandonment or business outcome. RD5/RD6 join authenticated outcomes by request,
assignment and generation; preserve competing exits and censoring assumptions.
Never train served calls as simple non-abandonment labels or claim causal
challenger evaluation from deterministic allocation logs.

## Verification and rollback

Run focused policy and database migration tests with Bun. The opt-in service test
`CONSUELO_RD4_PG_PORT=<isolated-loopback-port> bun test
packages/dialer-server/src/inbound/routing.integration.test.ts` creates and drops
its own random databases on that explicitly supplied disposable cluster. It
checks competing Bun worker processes, duplicate identity, immutable replay,
failed persistence rollback, cooldown/bounded offers, unknown effects, callback
windows, clock consistency and guarded down/up. Never supply production services.

RD2's existing Postgres/Redis failure lab remains available with
`CONSUELO_RUN_LOCAL_DIALER_LAB_INTEGRATION=1`. Both packages expose Nx typecheck
and build targets. These checks prove simulated application/database behavior;
live authenticated transport and carrier/media proof belong to RD5/RD8.

Back up deployed data before migration/rollback. Down refuses newer migrations,
any owned routing request or any active routing request. After draining and
reconciliation, an explicit down removes RD4 configuration/evidence only, retaining
RD1/RD3 history. Down/up is not evidence retention; restore from backup if needed.
No production activation is part of RD4.
