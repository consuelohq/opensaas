# RD product and scientific design

Status: contract_frozen (rd-1). This is an implementation contract, not an implemented feature.
Explicit customer choices, engineering defaults and tenant activation gates are distinguished below.

## Locked product direction

- Human sales reps first, reachable through browser dialer or existing phones.
- Primary flow: customer calls the advertised business number, remains on that
  carrier leg, and the platform offers a second leg to an eligible rep. Normal
  inbound does not call the customer back to establish the conversation.
- Explicit immediate/scheduled callbacks are additional entry paths; a customer
  no-answer risk belongs to callback execution, not the ordinary inbound flow.
- Backend/SDK ownership: packages/dialer owns provider-neutral rules; dialer-server
  composes Hono/Effect, Postgres/Redis and carrier adapters; CRM adapters provide facts.
- All RD task work goes through stream/dialer and its canonical AGENTS.md.
- An existing carrier leg can end while a conversation request/callback obligation
  remains open. Support participant-based calls so transfers do not end the request.
- Keep mature outbound/scientific behavior. Preserve D1-D4 when integrating old PRs.

## State and authority invariants

Separate request, leg, assignment, bridge attempt, callback obligation, and rep
capacity state. A flat status enum must not conflate these lifetimes.

Offer lease: a bounded opportunity to accept an assignment.
Capacity ownership: a capacity unit belongs to an assignment generation, including
connecting, connected, uncertain external effect, and applicable wrap-up states.

An offer timeout before side effects may release capacity. If an external bridge
command escaped and its outcome is unknown, capacity remains protected until
reconciliation establishes a safe transition. Escalation thresholds and manual
recovery are necessary; blindly freeing capacity on TTL is unsafe.

Winner = first valid acceptance committed against the current generation by the
transactional authority. Client timestamps do not establish global order.
Exactly one local owner is distinct from a global exactly-once carrier transaction.

Durable workflow: ingest/deduplicate fact -> transactionally record event, apply
legal state transition and enqueue command -> execute external effect -> record
success/failure/unknown -> reconcile uncertainty. Replay must not reissue effects.
Provider support for event IDs, sequence numbers and idempotent requests must be
verified per adapter. Do not invent a universal provider_event_id.

Preserve late facts for history/accounting/model labels when valid, even when they
cannot advance current operational state. Webhook retries can duplicate and reorder
facts; bounded retries do not guarantee that every fact is eventually delivered.
Correlate observed_at and provider_occurred_at without inventing clock precision.

Presence is not availability. Eligibility combines tenant/queue/skills, manual
readiness, device health, occupancy, reservations, capacity and wrap-up. Inbound
and outbound use one authority. Multiple endpoints share one rep capacity unit.

Acceptance, authorized bridge, carrier membership, media establishment and audio
quality are distinct evidence levels. Browser disconnect is not necessarily
carrier disconnect. Phone pickup is not necessarily human acceptance.
A conference membership flag does not prove both humans can hear each other.

## Waiting experience and exits

Model admission, answer-by-platform, queueing, offers, bridging, connection and
terminal legs. Preserve separate abandonment, callback choice, overflow, rejection,
voicemail, provider failure and service outcomes as appropriate.
DTMF and hangup facts update durable state. Provide bounded wait/reoffer policy,
rep cooldowns, overflow rules, hours/holidays/emergency closure, and admission limits.
Waiting media needs carrier-side continuity and reachable fallback behavior;
database durability alone does not keep audio alive.

Post-call occupancy includes bounded wrap-up. Slow CRM synchronization should
normally be asynchronous rather than monopolize rep capacity. Transfer may
temporarily involve several authorized participants with distinct capacity owners.

## Routing scientific contract

There are two decisions: which request next, and which eligible rep/capacity unit.
Hard tenant, qualification, permission and capacity constraints precede any score.
Start with transparent deterministic rules, documented ties, aging and bounded retries.
Handle scarce-skill allocation deliberately. Deliberately waiting for a better
future rep is a later stochastic-control challenger, not a static matching claim.

Inbound waiting-time data is a competing-risks process. Do not train served as the
negative class for abandonment. Distinguish the observed operational estimand under
the current routing policy from any latent caller-patience estimand, and state
censoring/identification assumptions explicitly.

For a conditional survival model S, residual patience is S(w + delta | x) / S(w | x)
where the conditioning is valid and S(w | x) > 0. Serving at w only reveals patience
beyond w, not the unobserved eventual limit. Callback, overflow and carrier failures
are separate exits. Routing can affect censoring and identification.

Every decision produces immutable evidence: decision_id, request_id, policy version,
decision time, considered candidate set, eligibility reasons, rep/queue state
versions and relevant normalized snapshots, proposed assignments, committed
reservation results, and observed outcomes. Bound snapshot size; capture which
candidates were screened out and how the candidate set was formed.

Deterministic logs do not create randomized action probabilities or causal/off-policy
support. Counterfactual business outcomes require additional assumptions/evidence.
Retain D4 principles: useful normalized features, explicit missingness, no fabricated
confidence, pseudonymous grouping where appropriate, and no unnecessary raw PII.
Offer losers canceled because another endpoint won are not rep pickup failures.
Provider failures and abuse-filtered calls are not ordinary sales negatives.

Record request wait, offer latency, rep pickup/accept, actual bridge latency,
abandonment, callback deadlines, workload fairness, availability and business outcome.
Do not optimize raw conversion without addressing selection effects and lead mix.

## Security and operational boundaries

Resolve tenant/DID from validated carrier/account/number ownership; caller phone
matching enriches context but does not authenticate the person. CRM failure must
have explicit routing fallback. Public callback forms require abuse/duplicate/cost
limits so strangers cannot cause unlimited calls to arbitrary recipients.

Consent, recording/transcription policy, retention/deletion, access control and
sensitive segments are explicit policy boundaries. Do not add recording incidentally.
Event durability does not justify indefinite storage of PII. Provider spend and
controlled live tests require the existing explicit authorizations.

## Frozen first-release decisions

Contract revision: rd-1, frozen on 2026-09-09 America/New_York.
Ko explicitly confirmed owner-first routing, callback plus voicemail, and deferring
customer browser calling, then authorized completion of RD0. Engineering defaults
below are implementation decisions under that authorization, not claims that Ko
specified every mechanism or that a tenant launch configuration is already known.

### Caller and rep selection

Serve waiting eligible requests in original queue-entry order; stable request ID
breaks equal timestamps. Select the longest-idle eligible rep, then stable rep ID.
Tenant, queue, skills, readiness, device health and shared capacity are hard gates.
Skip a request with no eligible rep without blocking unrelated serviceable requests.
Callback obligations retain original entry and explicit not-before/deadline fields;
a not-yet-due callback is not a serviceable waiting caller. The baseline combines due callbacks and live queued requests in original-entry FIFO
order, with stable request ID ties; neither preempts existing capacity ownership.
RD4/RD6 version this rule and test starvation and missed-window handling.

For a customer with an unambiguous CRM-assigned salesperson, offer that owner first
only if currently eligible and available. Do not wait for a busy, away, reserved,
wrapping-up or ineligible owner. Allow one bounded owner offer per routing cycle;
decline/timeout goes to the wider team with cooldown and attempt history preserved.
Do not reset owner preference on every retry to starve the wider pool. If CRM is
unavailable or ownership is ambiguous, use the normal eligible pool and record why.
Affinity never bypasses tenant/skill gates, grants capacity, or preempts a call.

One human rep has one live voice capacity unit across inbound and outbound initially.
Browser and phone endpoints share it. Explicit browser acceptance or screened phone
acceptance must commit against its current assignment generation. Phone carrier
answer alone, including voicemail pickup, cannot win. RD5 owns the provider-specific
private acceptance prompt and losing-endpoint cancellation proof.

### Waiting, fallback and callbacks

Expose callback and voicemail choices when a caller cannot be served, including
max-wait and after-hours paths. No silent automatic callback on hangup, form submit,
or voicemail. Caller choice creates its own durable outcome. Stop new offers and
reconcile escaped effects before final resource release. Preserve an explicit
provider-unavailable terminal fallback if either service cannot be fulfilled.
External forwarding and customer browser ingress are later extensions.

For explicit callbacks, reserve and confirm a rep when the obligation is due, then
dial the customer. A no-answer is a bounded attempt, not a connected conversation.
Persist each attempt and the next eligible time; exhausted, canceled, missed-window
and uncertain outcomes remain distinct. Do not retain the rep between retry attempts
unless an escaped effect still requires protected ownership and reconciliation.

Immediate callback means as soon as staffed capacity permits, not a guaranteed ETA.
Scheduled callback means a disclosed team service window with a timezone, start and
end; it does not automatically guarantee a named rep or an exact-second call.
RD6 owns a provider-neutral booking port and a deterministic test adapter. A real
calendar provider is a tenant activation dependency, not permission to invent a
Google/GoHighLevel integration. Never confirm an external booking without evidence.
UI must hide unavailable booking capabilities and distinguish requested from confirmed.
Original queue entry is retained for policy/evidence; do not promise that callbacks
keep a precise place in line without a proved policy.

### Runtime, testing and delivery

Consuelo Postgres owns requests, capacity, generations, event/state transitions and
durable commands. Redis accelerates presence, indexes and notifications; it is not
a second allocation authority. Twilio is the initial carrier/media adapter.
Do not introduce TaskRouter as another scheduler. This choice favors SDK ownership,
shared inbound/outbound capacity and one replayable authority, while accepting the
operational burden of leases, reconciliation and queue recovery. TaskRouter remains
an alternative requiring a deliberate contract amendment, not a parallel fallback.

Use the same application factories, migrations and durable stores in the isolated
lab and deployment. Inject clocks/provider/endpoints for tests; never share customer
data or enable fault injection in production. RD1 owns focused real-Postgres proof;
RD2 adds the reusable lab so RD1 does not circularly depend on RD2.

Inbound conversation recording/transcription is off by default. Voicemail is a
separate explicitly selected recording feature: RD5 must define its bounded storage,
access, retention/deletion and unavailable behavior. This is a scoped exception to
the existing no-retained-conversation-audio guidance, not permission to retain live
call audio. Tenant disclosure/retention policy is required before voicemail activation.
No voicemail-to-transcription automation is implied.

Participant and transfer/recovery contracts are required. A new customer transfer
UI, supervisor controls, learned matching, deliberate waiting for a better rep and
customer browser telephony are deferred. Existing outbound transfers must not regress.
RD5/RD8 prove participant boundaries without claiming a new embedded transfer UI.

Each implementation node ends at tested task-to-stream integration and its receipt.
RD8 joins release evidence. Main promotion, deployment, recording, real calls and
provider charges require the existing explicit scope; this contract does not grant it.

## Tenant configuration and activation gates

These unknown operating facts do not block RD1's provider-neutral schema/ports.
They must not be guessed into production defaults or silently treated as approved.

| Required fact/configuration | Owner and gate |
| --- | --- |
| Launch country/jurisdiction, customer permission/disclosures, recording/voicemail retention | RD5/RD6 policy adapters; verify before corresponding tenant activation |
| Queue timezone, hours, holidays/closure, team/skills/endpoints | RD4 configuration contract, RD7A setup; required before number activation |
| Offer deadline, presence freshness, wait budget, cooldown, total attempts, wrap-up limit, unknown-effect escalation | RD3/RD4 bounded configuration and validation; RD2 supplies labelled simulation fixtures, not optimized production defaults |
| Callback attempt limit/backoff, service window, overdue handling and calling eligibility | RD6 policy contract, RD7B truthful UX; required before callback activation |
| Actual CRM ownership mapping and calendar provider/credentials/capabilities | RD4 normalized enrichment fallback; RD6/RD7B external-booking activation |
| Team size, arrival/burst volume, service targets and alert/load thresholds | RD2 parameterized scenarios; RD8 must obtain measured/agreed launch envelope |
| Source/destination/fanout, spend and audio policy for live tests; deployed scope/rollback | RD8 release plan plus each separately authorized live test |

Missing settings prevent the affected feature/number from activating, with a clear
operator-visible reason. Internal tests use explicit versioned fixtures. An expiry
setting never overrides the invariant protecting unknown external effects.
Each owner records resolved values, assumptions and evidence in its own receipt.
Material changes to the frozen contract come back to RD0; filling tenant values
within these ports does not require reopening the dependency graph.

## Evidence and references

Repository discovery found purchased numbers configured for customer-twiml while
that handler expects an existing outbound parallel group. This is an inbound gap,
not proof of current deployed behavior. Reverify after existing PR reconciliation.
Existing reusable surfaces include conference/transfer services, signed webhooks,
browser voice, call history and the isolated local Postgres/Redis lab.

- [Click-to-call/callback pattern](https://www.twilio.com/docs/glossary/what-is-click-to-call)
- [TaskRouter model](https://www.twilio.com/docs/taskrouter/how-taskrouter-works)
- [Webhook retry/time limits](https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides)
- [Call progress ordering](https://www.twilio.com/docs/voice/twiml/number)
- [Test credential limitations](https://www.twilio.com/docs/iam/test-credentials)
- [US telemarketing guidance](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule)

External sources and repository snapshots are evidence to recheck, not immutable
provider guarantees or a complete jurisdiction-specific legal determination.
