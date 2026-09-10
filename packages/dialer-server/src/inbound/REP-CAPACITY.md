# Shared rep capacity integration (RD3)

The SDK owns the version-1 capacity contract and pure reducer. The Postgres adapter
owns transactional authority for both inbound and outbound assignments. One registered
rep has one voice slot per workspace; browser and phone endpoints share that slot.
This service is an internal trusted application boundary, not an authenticated route.

## Compose the authority

Create one Postgres pool and compose `createPostgresRepCapacityLayer(pool)` or the
Promise adapter `createPostgresRepCapacity(pool)`. Run the existing migration runner
first. Register a stable capacity/rep identity, then provide readiness and healthy
endpoint snapshots. Registration starts unavailable. Readiness is independent of
ownership: heartbeat, manual away, disconnect and reconnect cannot free a call.

RD4 consumes paginated `list` results and SDK `isRepCapacityEligible` as candidate
evidence. These reads are not reservations. Every mutation carries the latest
expectedVersion, stable operationId, and (after offering) assignmentId/generation.
An optimistic conflict requires rereading and reevaluating eligibility. Never replace
a stale generation with the new owner's generation to make an old acceptance succeed.

The initial authority permits one owner per rep and one owner per request.
Future transfer/consultation capacity must extend that contract explicitly.

## Offer, accept and dispatch

1. Commit a durable request through the RD1 journal.
2. Offer with direction inbound or outbound and healthy endpoint IDs. The authority
   commits capacity ownership, generation, assignment and the offer outbox command
   together. The 12-second example is caller policy, not a hardcoded product default.
3. Accept commits exactly one endpoint against the current generation and unexpired
   offer. Device timestamps do not participate. Loser endpoint offers are cancelled.
   Acceptance means connecting; it does not prove either media leg is connected.
4. Before sending any capacity-bound offer or bridge command, call the capacity
   `dispatch` action with that commandId. This transaction validates the generation,
   request and bridge participants, protects capacity, and claims the outbox command.
   A second active/unresolved bridge claim for the assignment is rejected.
   Generic journal `updateCommand(..., 'dispatched')` rejects managed commands.
5. Execute the external effect only on the fresh successful dispatch result.
   `duplicate: true` returns the original committed snapshot for an exact operation
   retry; it is never permission to repeat a carrier effect. A changed payload with
   the same operationId is rejected. On uncertain commit/transport outcome, inspect
   the command and reconcile; do not invent another operationId and resend.

The checked-client journal helper is an internal adapter composition seam. It requires
the same transaction and tenant lock; bypassing the public port is not supported for
controllers or executors. Ordinary journal commits cannot mutate managed capacity or
its current assignment.

## Unknown effects and recovery

Offer expiry only releases capacity when no external command escaped. Dispatched or
uncertain effects retain ownership in unknown. Failed command execution and verified
absence of all relevant media effects are different facts.

The RD5 adapter must authenticate provider facts, correlate its command identity,
assignment, accepted endpoint and actual media legs, and resolve every escaped offer
and bridge command before requesting release. A successful carrier API response alone
does not establish participant connection or prove that legs ended. Reconciliation
outcomes are trusted assertions at this internal boundary: connected requires both
participants confirmed; no_effect requires authoritative absence; ended requires
confirmed termination of all owned effects. A provider timeout supplies none of these.
The evidenceId links that assertion to durable provider/reconciliation evidence.

Use tenant-scoped `list({ workspaceId, ownedOnly: true, limit, afterCapacityId })`
after a worker restart. Pages are bounded to 1000; a scan is not an atomic routing
snapshot, so reread/version-check every action and rescan periodically.
Persisted deadlines drive expire, unknown reconciliation, escalation and wrap-up work.
Escalation records overdue unknown ownership; it never frees capacity. RD4/RD5 own
scheduling/retries/operator delivery, not an unbounded loop inside this adapter.

A connected call that ends enters wrap_up. Timeout or authenticated manual completion
returns ownership; manual away/readiness and endpoint health still control eligibility.
A prior confirmed connection cannot subsequently reconcile as no_effect.

The richer version-1 capacity aggregate and immutable event history are separate from
RD1's existing version-1 journal. The projection is atomic and preserves that historical
schema. In particular, unknown after a confirmed connection remains connected/busy in
the older mirror; read the rich capacity state for recovery. Replay never executes or
appends commands.

## Migration and validation

Migration 007 adds capacity snapshots/history, unique rep and owner constraints, and an
immutable-history trigger. Down refuses owned calls and newer migrations, and locks
the authority tables against concurrent writes. Existing RD1 identities and assignment
history remain. Re-registration derives its generation floor from that retained history
and starts unavailable, preventing a rollback/reapply from reusing an old fence.
Operational rollback still requires the repository's backup procedure.

Focused real-service proof:
```sh
CONSUELO_RD3_PG_PORT=<isolated-loopback-postgres-port> bun test packages/dialer-server/src/inbound/rep-capacity.integration.test.ts
```
The test creates and drops a random database on that explicitly supplied local lab
cluster. Do not supply a production database. Unit tests run without that variable.
The shared local lab uses all seven production migrations and reverses them in order;
RD2's simulation and worker modules are preserved.

RD3 does not activate this service in the existing outbound runtime or create customer
routes, provider credentials, calls or recording. RD5 must compose both inbound and
outbound call paths through this same authority before activation. Those live carrier,
authenticated endpoint, media and recovery acceptance gates remain RD5/RD8 work.
