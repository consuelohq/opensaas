# Dialer launch QA: scenarios, evidence and GHL acceptance

Owner: DEV-1675 | Managed stream: stream/dialer | Work: PR #2769

This is an operator-run and deterministic regression campaign, NOT a live-call
automation script. The code here does not buy phone numbers, place carrier calls,
enable receiving, execute Stripe checkout, or change production infrastructure.
It deliberately distinguishes passing component tests from proof of browser
microphone, telephone connectivity, actual provider state, and real customer audio.

## Quick start on a local source checkout

List all 24 test cards:

    bun run --cwd packages/dialer-server lab:launch list

Read one card before clicking the GHL UI:

    bun run --cwd packages/dialer-server lab:launch show S01

Run a safe local component-regression subset:

    bun run --cwd packages/dialer-server lab:launch run S01,S04,S07 --seed 20261105

Run the complete allowlisted component matrix (no carrier or payment access):

    bun run --cwd packages/dialer-server lab:launch run all --seed 20261105

Record a human observation AFTER trying the corresponding action in GHL:

    bun run --cwd packages/dialer-server lab:launch record S01 --result failed --observer QA --note "Audio dropped after accepting" --trace-id trc_example

Create a report from the local evidence:

    bun run --cwd packages/dialer-server lab:launch report

Evidence is saved on the user's Mac under ~/.consuelo/dialer-launch-qa/
as owner-only JSON files with phone/SID/token/email masking. The path can be
overridden using CONSUELO_LAUNCH_QA_EVIDENCE_DIR for a disposable test run.
A manual PASS is an observation, not a verified carrier pass until independent
provider/server/capacity evidence is checked. Do not include raw call audio, HAR
cookies, secrets, customer contact data or payment details in notes or exports.
Never paste telephone numbers into Linear or a public PR.

## First human walkthrough: minimal safe pilot

Use the existing isolated Wet Stone test tenant and signed-in GHL workspace.
Do not select any customer CRM contact, buy additional numbers or activate
inbound service without separate authorization.

1. READ-ONLY BEFORE ANY CALL: check signed GHL location, signed rep identity,
   trial/caller-ID ownership, microphone availability and current Ready/Away state.
   Independently confirm zero active provider legs/conferences, zero active session
   ownership, and exact Redis caller-id-lock:* ownership. A green health endpoint
   by itself does not prove these.
2. S21 safe inspection: open admin Team, Numbers, Receive calls and setup options.
   Confirm no raw provider ID required, one existing included test number, and
   honest error/permission/capacity states. Do not provision or change billing.
3. S17 safe inspection: navigate Contacts and Opportunities; search/filter
   known synthetic test contacts; change target rapidly while data refreshes.
   Avoid any bulk dial action. Record stale or wrong-contact selections.
4. S01 one approved call: specify exact verified source + recipient E.164 numbers,
   fanout 1, one initiation, and explicit recording/transcription OFF (unless
   separately authorized). Verify both-way audio, hang-up, wrap-up, disposition
   and one operator-visible history entry. Check cleanup independently.
5. S02/S03 single-call terminal outcomes: one fresh approval per attempt; let a
   consenting test device ignore, decline, be busy or go to voicemail. Inspect
   AMD, retry/attempt ledger, agent disconnect and lock release.
6. S07/S09 approved inbound: with a configured test DID and readiness settings,
   verify browser ring, accept, decline, expire and caller abandonment. A visible
   alert alone does not prove two-way media.
7. S04 then S05 approved predictive batches: 2 then 3 independently consenting
   test endpoints; each batch needs its own exact source, destinations, fanout
   and one-initiation approval. Test simultaneous human answers, a human plus
   voicemail, and stop/resume after finishing the winner. Do not use live leads.
8. S10/S11 approved concurrent callers: two genuinely authenticated test reps
   and two devices, one incoming call while another is busy, then competing
   acceptances. Never use the same signed browser identity to simulate two reps.
9. S13/S14 after primary audio proof: navigate or reload the active GHL view,
   test token expiry and bounded network outage. Do not restart the production
   server or force a production DB/Redis outage.
10. Finish with S19 history/disposition and cleanup readbacks. A scenario stays
    unverified when provider evidence, actual audio or a terminal cleanup check
    could not be captured.

Additional non-live cases S06, S12, S15–S18, S20 and S22–S24 run with fixtures,
simulation clocks and intercepted providers. Never use production DB/Redis for
fault injection. The package's separate lab:verify command starts disposable
Postgres and Redis for deeper crash/restart evidence; it is distinct from the
lightweight component matrix and should be run only in an isolated test session.

## Read-only diagnostics while the human clicks

Start browser trace BEFORE scenario action and stop it immediately afterward.
Consuelo OS provides browser.trace start/stop, browser.network and browser.snap,
but they operate on the browser session connected to that OS tool. When that
browser is at the GHL sign-in screen, it is NOT proof of visibility into an
authenticated Arc session. Use an already authenticated, authorized test browser
or connect a fresh supervised test session first; do not use old login secrets.

For each attempt collect:

- Run identity: scenario Sxx, UTC start/stop, environment, selected test tenant,
  rep and device aliases (no raw user IDs in shared issues).
- Browser: route, availability, media/permission state, UI phase transitions,
  action sequence, fetch status, relevant 401/403/429/5xx and transport error
  counts, sanitized trace ID and console errors.
- Backend: matched request/correlation/assignment IDs and generation, source
  commit/deployment identity, call-start effect claim, pending/unknown/succeeded
  state, webhook event order, terminal session result.
- Telephony: authenticated Twilio call and conference readbacks for the
  exact known test attempt; participant connection/mute flags; winner vs loser
  legs, actual audio observation, end time and outstanding active legs.
- Persistence: READ-ONLY DB session, attempt ledger, rep capacity, queue state,
  and exact caller-id-lock:* Redis keys with owner/TTL, both before and after.
  Mask SIDs, telephone numbers, credentials, and customer content.
- Result: UI vs authoritative server/provider expected/actual, elapsed time,
  severity, scenario ID, trace link/receipt and proposed regression test.

Saved local JSON can also include sanitized structured diagnostics from a file:

    bun run --cwd packages/dialer-server lab:launch record S07 --result blocked --observer QA --note "No ringtone with tab backgrounded" --diagnostics-json /path/to/redacted-observation.json

Never attach raw HAR, Stripe webhook bodies, full auth headers, Twilio recordings,
transcripts, screenshots of private customers, or full production logs.

The OS-native trace, GHL UI and provider/DB readbacks are independent sources;
a UI phase that says connected is not authoritative evidence that media worked.

## Fix-and-retest protocol

For any failure: stop new carrier initiations, capture original request/state
before resets, record a sanitized failed run, and link DEV-1675 in an isolated
bug issue. Add a deterministic failing regression with its seed and event
ordering. Fix the smallest owning boundary (Dialer domain, Dialer server,
LeadConnector adapter/UI), pass focused and cross-package tests, review.run
strict and formal verify, then promote only through stream/dialer. Re-run the
original human case only after a distinct one-shot carrier authorization and
production environment verification. No automatic redial or background calls.

Do not mark a scenario validated because a browser button was clicked, a
diagnostic health endpoint responded or a provider request returned a SID.
For outbound and inbound scenarios, terminal acceptance includes zero orphan
agent legs, no stuck conferences, no unreconciled pending/unknown effects, and
correct rep capacity and caller ID lock ownership.

## Launch exit gates

- All critical provider-free invariants and regression suites pass in CI.
- One complete single outbound call and one inbound call demonstrate actual
  two-way audio, truthful caller ID, disposition/history and terminal cleanup.
- Predictive two/three-line simultaneous-answer tests leave one winner and no
  orphaned loser; two-rep inbound contention protects capacity ownership.
- Token renewal, GHL navigation, background alerts and network disruptions do
  not create duplicate calls or false connection states.
- An end-to-end test-mode commercial claim proves paid-only entitlements and
  cancellation/recovery; customer onboarding works without raw provider IDs.
- Security tests prove tenant isolation, strict iframe origin/signatures,
  revocation and least privilege. Telemarketing restrictions and applicable
  consent/recording rules receive separate compliance approval.
- Release provenance, rollback, alert ownership, incident support and actual
  approved production behavior are documented before public customer access.

Current limitations: automation maps to existing contract/component tests and
does not exercise complete human flows on a live carrier. The server lab has
deeper recovery simulations but they are a separate execution lane. Inbound
notifications, self-service team/number setup, enterprise security and paid
activation still have dedicated open/staging Linear issues. Do not advertise
their completion merely because this checklist exists.
