# RD6 receipt — immediate and scheduled callback obligations

Status: implementation complete and validated for integration into `stream/dialer` through task PR [#2474](https://github.com/consuelohq/opensaas/pull/2474). RD6 builds on RD5 and the post-RD5 RD7A acceptance closure. Live carrier/audio proof and final release remain intentionally deferred to RD8 because no exact live-call authorization was provided.

Task branch: `task/dialer/rd6-callback-obligations-and-scheduler`
Task PR: [#2474](https://github.com/consuelohq/opensaas/pull/2474)
Stream: `stream/dialer`

## Delivered

- Added durable callback-obligation state with immutable original queue-entry evidence, explicit `notBefore` / `deadline`, revisions, bounded attempts, operation-id deduplication, `cancel_pending`, `unknown`, `retry_due`, `exhausted`, `expired`, `connected`, and `fulfilled` outcomes.
- Added provider-neutral callback policy, consent/eligibility, and calendar/booking contracts. Calendar booking defaults to `unavailable`; a booking is never reported `confirmed` without both a provider reference and evidence reference.
- Added additive migration `20260913_010_callback_obligations` with callback obligations, immutable event history, callback provider-effect state, revisioned booking evidence, due/retention indexes, and rollback guards.
- Added authenticated AES-256-GCM callback-recipient encryption bound to the workspace. Plaintext recipient numbers are not stored in callback state/events, and retained ciphertext is purged on its bounded retention deadline.
- Added `DIALER_CALLBACK_RECIPIENT_SECRET` activation gating. A number cannot advertise callbacks unless both an RD6 callback policy and encrypted recipient storage are active.
- Replaced RD5's placeholder callback prompt with a real authenticated DTMF path. `Press 1` now creates the durable callback obligation in the same database transaction before the caller receives the saved-confirmation TwiML.
- Preserved the original live request as historical evidence and created a separate callback-fulfillment request linked to it. The fulfillment request carries the original queue-entry timestamp for FIFO without reviving the ended caller leg.
- Reused RD4 routing and RD3 shared capacity instead of introducing a second reservation authority. No rep capacity is held before a callback becomes due.
- Added rep-first callback fulfillment. A callback attempt is recorded only after a rep accepts the RD3 assignment; RD6 bridges the rep first, then permits the customer dial to cross the provider boundary.
- Extended RD3's managed-command dispatch fence to `start_callback`. The command must prove the same callback, request, assignment, capacity ID, generation, and winning endpoint before it may dispatch an external effect.
- Added dedicated callback provider-effect reconciliation for rep bridge, customer dial, and cleanup effects. Lost provider-create responses move capacity/callback state to `unknown` and cannot trigger a duplicate customer dial.
- Added participant-confirmed connection, connected teardown/wrap-up, customer no-answer retry/release, bounded retry exhaustion, missed-window expiry, and restart-safe convergence.
- Made cancellation durable before cleanup. Pre-accept escaped rep offers and active callback dials remain capacity-protected until provider evidence proves the external effect ended or never existed; only then can cancellation finalize.
- Bound reschedule operations to the authoritative RD4 queue timezone and staffed service window. Original queue entry and prior attempts remain immutable across revisions.
- Added explicit repeated-hour DST coverage: service bounds are stored as absolute UTC instants plus the IANA timezone, so fall-back ambiguity cannot silently shift a callback window.
- Advanced the isolated migration/lab rollback chain through migration 010 and retained the older RD3/RD4/RD5 rollback guarantees.
- Updated inbound ownership documentation to describe the implemented RD6 authority boundary.

## Capacity and ordering invariants

- RD3 remains the only shared rep-capacity authority for inbound, outbound, and callback work.
- RD4 remains the only routing/queue authority. RD6 schedules obligations by making them eligible for RD4; it does not reserve a rep hours in advance.
- A callback provider attempt is counted only after a rep wins/accepts the assignment. Rep offer rejection/expiry does not consume a customer-attempt budget.
- Customer dialing is ordered after successful rep bridging. Duplicate scheduler ticks and worker restarts converge on the same durable `start_callback` command/effect ledger.
- Unknown external provider effects retain capacity and block unsafe retries/cancellation until reconciliation evidence resolves them.
- `connected` requires both rep and customer participant evidence. A transient missing participant snapshot cannot tear down an otherwise connected callback.
- Customer no-answer before connection ends the remaining rep leg, releases RD3 capacity with no-effect evidence, and enters the configured bounded retry path.
- Cancellation is `cancel_pending` first. Provider cleanup and RD3 reconciliation must complete before terminal `cancelled` is recorded.

## Privacy and activation boundary

- Callback recipient plaintext is accepted only at the authenticated admission/runtime boundary, encrypted before durable storage, and never written into callback snapshots/events.
- Ciphertext is workspace-bound with authenticated encryption and fails closed for the wrong workspace or secret.
- Callback IVR language is hidden unless the number has an RD6 policy and the runtime has callback-recipient encryption configured.
- Consent/eligibility is an explicit provider-neutral port for non-DTMF creation. The authenticated DTMF path records its consent fact before creating the obligation.
- No real calendar provider was invented. The provider-neutral calendar adapter can record `requested`, `confirmed`, `cancelled`, or `unavailable` evidence, but this task does not activate or claim a production calendar integration.

## RD7A stream coordination

RD7A post-RD5 operator/browser acceptance landed on `stream/dialer` while RD6 was in progress. RD6 integrated that current stream head before final validation. The only source overlap was `telephony-admission.ts`; the resolved result preserves RD7A's per-action browser acceptance fencing/idempotency and RD6's callback admission/encryption path. The combined LeadConnector, Dialer, Dialer Server, real-Postgres, lab, build, and strict-review gates all passed after that integration.

## Validation

- Full `packages/lead-connector/src`: **136 passed, 0 failed** after RD7A + RD6 integration.
- Full `packages/dialer/src`: **261 passed, 0 failed**.
- Full ordinary `packages/dialer-server/src`: **189 passed, 0 failed; 48 service-backed cases skipped by the ordinary command as designed**.
- Combined isolated real-Postgres RD3 + RD4 + RD5 + RD6 matrix: **43 passed, 0 failed, 258 assertions**.
- RD6 callback carrier subset inside that matrix: **5 passed, 0 failed**. Proven cases include rep-first/customer-second ordering, duplicate worker convergence, lost customer-create response recovery after restart, authenticated DTMF persistence/encryption, no-answer retry/release, and provider-escaped pre-accept cancellation.
- RD6 callback persistence subset inside that matrix: **4 passed, 0 failed**. Proven cases include no early reservation, rep-accept attempt creation, policy backoff/FIFO preservation, rollback safety, calendar truthfulness, reschedule revision preservation, and recipient purge.
- Isolated Postgres + Redis local dialer lab: **1 passed, 0 failed, 36 assertions**. The lab applies migration 010, exercises the existing deterministic failure/replay scenarios, proves the rollback chain, and tears temporary services down.
- `@consuelo/dialer`, `@consuelo/dialer-server`, and `@consuelo/lead-connector` typechecks: passed after merging the current dialer stream head.
- `@consuelo/dialer` and `@consuelo/dialer-server` production builds: passed after merging the current dialer stream head.
- Strict `review.run` against `origin/stream/dialer`: **0 task findings / 0 task blockers / 0 pre-existing findings**.

## Remaining release boundary

RD6 does not authorize or claim a production Twilio call, real two-way carrier audio, recording/transcription, provider spend, production deployment, or external calendar booking. RD7B may now consume the callback/booking contracts for customer-facing entry and management. RD8 still owns final stream/main reconciliation, integrated release review, deployment evidence, exact live-provider acceptance if separately authorized, and final rollback/release proof.
