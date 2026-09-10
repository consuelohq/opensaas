# Inbound journal (RD1, schema version 1)

The provider-neutral contracts and reducer live in `@consuelo/dialer` under
`src/inbound`. This adapter supplies the Effect `InboundJournal` and
`InboundOutbox` capabilities using a PostgreSQL pool. It performs no carrier,
Redis, calendar or browser operations and registers no HTTP route.

## Atomic authority

A commit contains one normalized fact, ordered entity events, an optional
pre-transition routing decision and commands caused by applied events.
The checked-out client commits fact identity, entity snapshots, same-tenant
links, append-only history, decision and outbox entries together. A short
transaction-scoped advisory lock serializes each tenant, including creation of
absent rows. Hash collisions only cause extra serialization. This is the initial
correctness baseline, not measured high-throughput scheduling. RD3 may narrow
locks only while retaining absent-row, version and cross-entity guarantees.

Create referenced entities before their dependents in the batch. Six independent
identities cover requests, participant legs, assignments, bridge attempts,
callback obligations and rep capacity slots. A unique tenant/rep/voice-slot
index prevents duplicate capacity identities. These are not six independent
reservation authorities: RD3 must implement shared inbound/outbound ownership,
acceptance generation and endpoint winning policy against these contracts.

Fact deduplication is tenant/source/event-key scoped. The server computes a
canonical SHA-256 digest of normalized fact content and semantic event data.
Entity identities and normalized semantic transitions must be stable across redelivery.
Delivery observation times, optimistic versions and event IDs are excluded:
redelivery may have new local observation metadata. A repeated key with different
semantic facts fails; a matching repeat returns the original committed result.
Events must use the fact's occurred time. Each event ID and each event/command
type is unique within a tenant. Invalid batches consume no fact identity.

Version 1 accepts canonical millisecond UTC timestamps in years 0000–9999.
Provider occurrence cannot follow observation, and applied forward transitions
cannot move event time backward. Adapters must quarantine contradictory clocks
or normalize stale facts into legal no-op history; they must not fabricate time.
Terminal and same-state facts are retained as unapplied history and cannot emit
commands. Expected versions are still required. Schema versions and unknown
fields fail validation rather than being silently stripped.

## Effects and recovery

Acceptance is distinct from connection. Assignment offer expiry does not expire
capacity. Protected connecting/unknown capacity requires reconciled no-effect
or ended evidence before release. A connected transition requires normalized
participant confirmation. These evidence classifications are **trusted internal
application input**, not user claims: RD3/RD5 must derive them from authoritative
state/provider reconciliation after authentication.

Commands have stable identities and bounded types; arguments are resolved from
their durable entity links by the later executor. A bridge command must be caused
by a bridge entering connecting, for example. RD5 must additionally validate live
participants, capacity ownership and its fenced generation before external work.
There is no general-purpose arbitrary provider payload or executable command.

Outbox listing uses tenant/status and a command-ID cursor, capped at 100.
Transitioning pending to dispatched commits the local winner using the expected
command version. It does not execute the effect. Dispatched may become succeeded,
failed or unknown; unknown can resolve only with explicit reconciliation.
Unknown cannot return to pending/dispatched. A worker crash after dispatch must
be found by listing dispatched commands and reconciled, never blindly retried.
RD5 owns worker leases, provider idempotency capabilities and reconciliation.
Outcome history is append-only; terminal outcomes reject contradictory updates.

Replay reads ordered events, validates the version-1 reducer and returns state.
It never materializes outbox entries or invokes effect ports. Rebuilding a cache
is a separate administrative action. Upcasters/reducer version dispatch must be
added before introducing a future schema; never reinterpret old events silently.

## Scientific artifact

Decisions capture policy identity, request/queue identity and version, pre-decision
request state, elapsed original queue age, candidate capacity state/version,
eligibility reasons and proposed capacity. The adapter validates request/capacity
snapshots against the transaction's pre-transition state. Queue version and
eligibility reasons are policy-supplied evidence until RD4 implements that authority.
They are not assertions that the proposal was reserved or connected.

The immutable decision links to its causal fact; committed assignments/events and
command outcomes provide the separate observed result. Use internal/pseudonymous
IDs, never phone numbers, transcripts or arbitrary CRM payloads in these fields.
RD4 extends bounded normalized signals and policy evidence; it must not put
post-decision outcomes into immutable decision-time features. Served, abandoned,
callback, overflow and provider failure remain different exits. Latent patience
requires explicit competing-risk/censoring assumptions.

## Migration and next branches

Migration 006 is additive to the outbound schema. Its up query installs the schema,
immutable-history triggers and migration marker atomically. Its down query refuses
newer migrations and removes only inbound tables and the 006 marker. **Down removes
inbound data**: a deployed rollback needs a backup and deliberate recovery plan.
The lab uses only newly created isolated resources, verifies populated up/down/up,
and preserves the existing outbound observations throughout. No deployed migration
or live traffic is activated by RD1.

RD2 owns reusable simulator/process-crash infrastructure; reuse the isolated lab
entry and `runInboundJournalScenarios`. RD3 owns reservation services, endpoint
acceptance, capacity ownership generations and wrap-up. Add versioned state/event
extensions for those fields; do not repurpose identity fields or add Redis ownership.
RD5 owns provider/media reconciliation. RD6 owns callback attempts, scheduling and
rescheduling revisions. The current callback identity records the original promise;
it is not yet a scheduler. These contracts do not prove two-way audio or authorize calls.
