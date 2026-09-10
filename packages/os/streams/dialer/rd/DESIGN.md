# RD product and scientific design

Status: alignment_open. This is a durable synthesis, not an implemented feature.
Locked items come from the planning conversation; recommendations remain explicit.

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

## Open RD0 decisions

1. Owner affinity: brief owner-first offer then wider eligible pool, or next available.
2. Max-wait fallback: callback option, voicemail, external forwarding, or configured chain.
3. Customer-side browser calling: first release or a later adapter/UI extension.
4. Launch jurisdiction and callback disclosure/permission rules.
5. Queue hours, staffing/traffic assumptions, service targets and default thresholds.
6. Reservation execution: Consuelo transactional authority or a TaskRouter-backed
   implementation of the same ports. Choose one authority; never run two schedulers.
7. Calendar provider/booking semantics and the precise callback promise.
8. Per-node and final release activation scope.

Recommended starting architecture: Consuelo-owned transactional Postgres capacity
and request authority with Redis presence/index/notification acceleration, reusing
existing provider adapters. TaskRouter already offers queue/reservation machinery;
compare operational burden, recovery proof, SDK ownership and provider coupling
before freezing this choice. Do not duplicate TaskRouter if chosen.

Recommended callback sequence: reserve/confirm rep when due, then call customer.
This spends some rep time waiting for pickup but avoids calling customers into an
unstaffed queue. Bound no-answer attempts and release/reconcile capacity correctly.
These recommendations are not recorded as Ko-approved policy choices.

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
