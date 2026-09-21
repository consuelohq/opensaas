# Inbound routing: what exists and how to test it

## What the first release does

A customer calls an advertised Twilio number. Consuelo keeps that caller on the
line, checks the number's tenant and queue policy, and offers the call to eligible
human reps. A uniquely identified CRM contact's assigned rep gets the first
bounded offer when eligible; otherwise the team uses FIFO callers and longest-idle
eligible reps. Busy, unhealthy, away, reserved and wrapping-up reps are excluded.
Browser and forwarded-phone endpoints compete for one committed acceptance.
Acceptance and confirmed media connection are separate states.

An explicit callback request is different: it waits for a staffed service window,
gets a rep connected first, and then calls the customer. A customer who calls the
advertised number is never redialed as part of ordinary inbound routing. No-answer
retries and maximum attempts are bounded by the configured policy.

| Surface | Implemented behavior | Activation boundary |
| --- | --- | --- |
| Dialer SDK | State transitions, queue policy, shared rep capacity, fenced acceptance, immutable decisions | Provider independent |
| Hono/Bun server | Signed Twilio ingress, Postgres journal/queue, commands, reconciliation, callback obligations | Explicit inbound flag, tenant/number/rep/queue configuration |
| GoHighLevel/LeadConnector | Existing OAuth installation and rep identity; embedded operator UI; exact-phone contact-owner lookup | Installation must belong to the configured workspace/location; rep IDs are authenticated provider user IDs |
| Rep UI | Readiness, browser/phone endpoint status, offers, decline, reconnect, wrap-up and queue visibility | Authenticated rep plus configured endpoint and queue membership |
| Customer page | `/call/:publicId`, phone link, consented callbacks, service-window selection, status/reschedule/cancel | Public ID maps to one enabled number; signed edge identity and capability secrets |
| Calendar | Provider-neutral booking/cancellation port and immutable evidence | No external calendar adapter is composed by the deployed runtime; callback windows are not confirmed GHL calendar appointments |
| Voicemail | Explicit selection, configured disclosure, bounded recording and retention deletion | Configure and approve separately; normal conversation recording remains off |

Phone input uses `normalizePhone` from `@consuelo/contacts`. The runtime owner
lookup uses HighLevel's installation-scoped [exact contact lookup](https://marketplace.gohighlevel.com/docs/ghl/contacts/lookup-contact/index.html).
Duplicate matches, wrong-location responses, missing owners and unavailable CRM
service fall back to ordinary team routing. Enrichment has a 500 ms admission
budget. Contact bodies and phone numbers are not copied into decision snapshots.

Configuration is currently an engineering operation through typed queue policies
and runtime number/endpoint configuration. The operator configuration view is
read-only; its PATCH endpoint deliberately returns 501. This is not a completed
self-service tenant setup wizard. Customer browser calling, learned routing,
external calendar integration and inbound-enabled transfer controls are deferred.

## Provider-free verification

Run from the repository root after `yarn install --immutable`:

```sh
yarn nx run @consuelo/contacts:build
bun test packages/dialer/src
bun test packages/lead-connector/src
bun test packages/dialer-server/src
yarn nx run-many --target=build --projects=@consuelo/dialer,@consuelo/lead-connector,@consuelo/dialer-server
yarn nx run-many --target=typecheck --projects=@consuelo/dialer,@consuelo/lead-connector,@consuelo/dialer-server
bun run --cwd packages/dialer-server lab:verify
```

The ordinary server suite skips service-backed cases without explicit lab ports.
To run those cases, start a disposable loopback Postgres cluster with user
`postgres`, then set `CONSUELO_RD3_PG_PORT`, `CONSUELO_RD4_PG_PORT`,
`CONSUELO_RD5_PG_PORT`, `CONSUELO_RD6_PG_PORT` and `CONSUELO_RD7B_PG_PORT`
to that cluster's port before running the server suite. Tests create and remove
independent databases. Never point these variables at a shared or production DB.
The `lab:verify` command starts and tears down its own real Postgres/Redis processes;
it requires PostgreSQL 16+ and Redis binaries on PATH.

These tests exercise real application factories, migrations, transactions and
concurrent workers with simulated carrier responses. They prove routing and
recovery behavior, not PSTN delivery, browser microphone access or two-way audio.

## Deployment and activation preflight

1. Verify the exact merged source SHA, successful dedicated dialer release,
   Railway deployment and Worker version. `GET /health` must return the server's
   JSON health response through both the Railway origin and the public edge.
   An HTML page or Railway `Application not found` is not readiness.
2. Back up the deployed database before applying schema changes. Confirm the
   migration ledger includes the append-only callback booking event migration.
3. Identify one isolated test workspace and its connected LeadConnector location.
   Confirm its installation has contact-read access. Choose two consenting test
   reps and map their actual provider user IDs to browser/phone endpoints.
4. Configure the queue using `createPostgresInboundRouting(pool).configureQueue`
   with an explicit expected version: timezone, staffed weekly hours, closures,
   memberships/skills, max wait, max offers and reoffer delay. The queue must exist
   before its number is enabled. This is not a public unauthenticated API.
5. Supply `DIALER_INBOUND_CONFIG_JSON` version 1 with explicit number ownership,
   DID, queue ID, endpoints and bounded fallback policies. Use
   `DIALER_INBOUND_ENABLED=true` only for the approved test configuration.
   Startup registers configured rep capacity; reps still must mark themselves ready.
6. Configure Twilio credentials and canonical HTTPS `DIALER_SERVER_PUBLIC_URL`.
   Set the number's voice webhook to
   `/webhooks/twilio/inbound/:numberId/incoming` on that origin. Verify a genuine
   provider signature; an arbitrary POST is expected to be rejected.
7. For callbacks, provision `DIALER_CALLBACK_RECIPIENT_SECRET`, explicit disclosure,
   consent activation reference, retry limits and service-window policy. Public
   entry additionally needs `DIALER_CUSTOMER_ENTRY_SECRET` and the same strong
   `DIALER_EDGE_PROXY_SECRET` in Railway and the Worker. Secrets stay server-side.
8. Record authorized test numbers, endpoints, a bounded call/spend budget, cleanup
   owner, and any explicitly approved voicemail recording/retention policy.
   A source merge or a simulated pass does not authorize real calls.

The configured public host is `https://calls.consuelohq.com`; the rep surface is
opened from the existing GoHighLevel integration. Use `/call/<configured-public-id>`
for customer testing only after the server snapshot succeeds. Do not guess a live
public ID or assume that loading the static shell proves the backend is enabled.

## Live acceptance ladder

| Test | Expected observation |
| --- | --- |
| Ready rep; new caller dials advertised number | Original caller leg stays live; one rep is offered; connected only after both media participants are audible |
| Known contact; assigned rep ready | Assigned rep gets first offer; busy/away/no-answer owner falls through to team without unbounded waiting |
| Rep browser and forwarded phone both ring | One committed endpoint wins; losing endpoint cannot create a second bridge |
| Caller hangs up during wait or offer | Abandoned state; no later rep bridge or orphaned leg |
| No staff / outside hours / max wait | Configured explicit callback or voicemail choice; no unsupported ETA promise |
| Requested callback; customer does not answer | Rep is released after carrier termination is confirmed; retries respect policy and service window |
| Reschedule later, restart, cancel | Phone ciphertext remains through the new window; old booking cancellation is projected correctly; no repeated unknown provider effect |
| Browser refresh or network loss during connection | Authoritative recovery; no false connected state or second assignment |
| Finished call | Wrap-up precedes restored capacity; inbound and outbound cannot both own the rep |

Capture request/decision/assignment IDs, generation, provider leg IDs, queue/offer/
connection timing, observed outcomes and cleanup evidence. Redact customer numbers
and credentials. Start with one call and two test reps before any load test.
