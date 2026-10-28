# RD7B receipt — customer callback and booking entry

Status: implementation complete and validated for integration into `stream/dialer` through task PR [#2477](https://github.com/consuelohq/opensaas/pull/2477). RD7B consumes merged RD6 callback/booking authority rather than creating a second scheduler, capacity system, or calendar truth source. Live carrier/audio proof, external calendar booking, production deployment, and final stream release remain intentionally deferred to RD8.

Task branch: `task/dialer/rd7b-customer-entry-and-booking-ui`
Task PR: [#2477](https://github.com/consuelohq/opensaas/pull/2477)
Stream: `stream/dialer`

## Delivered

- Added explicit opt-in `customerEntry` configuration on enabled inbound numbers. Public entry requires a unique `publicId`, a durable admission window, and explicit per-client/per-number request ceilings; RD7B does not invent production rate-limit defaults.
- Added public customer routes at `/v1/inbound/customer/:publicId` for entry state, callback creation, status, reschedule, and cancellation. They are intentionally mounted before ordinary `/v1/*` bearer authentication while all internal workspace/queue/number authority is derived server-side.
- Added a real `tel:` entry surface plus immediate and scheduled callback UI. Immediate copy promises only “as soon as staffed capacity permits”; no synthetic wait-time ETA is generated.
- Added server-authored service-window selection from the RD4 queue policy and authoritative IANA timezone. Window capabilities are HMAC-bound to public entry, policy version, and absolute start/end instants, so the browser cannot invent arbitrary local datetimes.
- Added live staffing truth from RD3 rep-capacity state. “No staff available right now” is separate from whether an RD6 callback can still be accepted for a staffed window.
- Added explicit one-request permission evidence for public callbacks. Consent is persisted before RD6 authorization and is bound to workspace, callback, activation reference, disclosure hash, and bounded expiry; it does not imply marketing consent.
- Added migration `20260913_011_customer_entry` for durable callback admission and explicit permission evidence. Admission stores HMAC-pseudonymized client/request identifiers and management-token hashes; raw client IPs and public recipient phone numbers are not stored in the RD7B admission/consent ledgers.
- Added transactionally enforced, restart-safe per-client and per-number abuse/cost admission. Exact idempotency duplicates converge on one callback obligation and do not consume another rate slot, including concurrent submissions.
- Added opaque HMAC management capabilities for callback status, reschedule, and cancellation. Public clients never receive workspace IDs, queue IDs, internal number IDs, callback IDs as authority, recipient ciphertext, or provider credentials. Tampered, expired, or wrong-entry capabilities fail closed.
- Extended management-capability expiry when a callback is moved to a later service window so customers retain cancellation/status access for the rescheduled obligation.
- Bound reschedule operation IDs to the current RD6 callback revision plus service-window capability. A sequence such as A → B → A cannot be mistaken for an old duplicate operation.
- Kept status reads side-effect free. Reading callback status only reads persisted RD6 booking evidence; it cannot initiate a calendar provider request.
- Preserved RD6 booking truth exactly: `requested` is not rendered as booked, and `confirmed` is rendered only when both provider and evidence references exist. The current runtime has no calendar adapter, so booking remains truthfully `unavailable` rather than being invented.
- Delegated cancellation to the RD6 callback obligation. `cancel_pending` is rendered explicitly as pending until RD6 reaches terminal `cancelled`; RD7B does not claim cancellation earlier than provider/reconciliation evidence permits.
- Added a dedicated `/call/:publicId` LeadConnector customer surface. Browser boot now code-splits customer entry from the authenticated admin/overlay controller: the public bootstrap does not load the iframe parent bridge, CRM session/controller, or Twilio Voice chunk.
- Added customer-edge isolation: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `microphone=()`, and a self-only `connect-src` with no Twilio WebSocket source on the customer shell. Existing admin/overlay iframe + browser-voice policies remain unchanged.
- Added customer-only responsive layout, permission controls, truthful request/booking/cancellation states, reload continuity through session-scoped management capability storage, and server-driven reschedule controls.
- Advanced the isolated dialer migration/lab rollback chain through migration 011 while preserving older rollback/reapply safety checks.

## Authority and safety invariants

- RD6 remains the only callback-obligation scheduler and booking-evidence authority. RD7B is an entry/management adapter only.
- RD4 remains the queue/timezone/service-window authority; RD7B does not create a second routing calendar.
- RD3 remains the shared capacity authority; RD7B only reports derived staffing availability and never reserves capacity itself.
- Public browser input cannot choose a workspace, queue, internal number, callback ID, callback revision, or provider reference.
- Public callback creation is committed behind durable idempotency and abuse bounds before any later provider-costing fulfillment can occur.
- Duplicate browser submits are coalesced in the controller and also deduplicated transactionally on the server, so browser behavior is not the safety boundary.
- Direct phone calling remains a plain `tel:` link. Customer browser telephony, microphone access, recording, transcription, and agent voice are outside RD7B.
- A calendar appointment is never claimed from a request alone. Only RD6 `confirmed` evidence with provider + evidence references may render “Appointment confirmed.”

## Validation

- Full `packages/dialer/src`: **261 passed, 0 failed, 609 assertions**.
- Full ordinary `packages/dialer-server/src`: **196 passed, 0 failed; 50 service-backed cases skipped by the ordinary command as designed**.
- Full `packages/lead-connector/src`: **142 passed, 0 failed**.
- RD7B isolated real-Postgres customer-entry integration: **2 passed, 0 failed, 24 assertions**. Proven cases include concurrent duplicate collapse, per-client and per-number rate limits, pseudonymized admission/consent persistence, restart continuity, tampered-capability rejection, revision-safe A → B → A reschedule, management-expiry extension, and cancellation.
- Isolated Postgres + Redis local dialer lab: **1 passed, 0 failed, 37 assertions**. The lab applies migration 011, exercises the existing deterministic failure/replay scenarios, proves the expanded rollback/reapply chain, and tears temporary services down.
- `@consuelo/dialer`, `@consuelo/dialer-server`, and `@consuelo/lead-connector` typechecks: passed.
- `@consuelo/dialer`, `@consuelo/dialer-server`, and `@consuelo/lead-connector` production builds: passed. The Dialer build includes its compiled Node smoke.
- Customer-browser architecture contract proves the small public bootstrap contains neither internal `SessionId` logic nor Twilio Voice imports; internal CRM/voice code remains in a separate lazy chunk.
- Top-level HTTP contract proves customer entry is explicitly public while ordinary `/v1/*` routes still require authentication.
- Strict `review.run` against `stream/dialer`: **0 task findings / 0 blockers / 0 pre-existing findings**.

## Remaining release boundary

RD7B does not authorize or claim a production Twilio call, real two-way carrier audio, recording/transcription, provider spend, production deployment, or a real external-calendar booking/cancellation. The current runtime intentionally reports booking `unavailable` because no calendar adapter is active. RD8 still owns final stream/main reconciliation, integrated browser/service acceptance, deployment evidence, exact live-provider proof if separately authorized, and final rollback/release validation.
