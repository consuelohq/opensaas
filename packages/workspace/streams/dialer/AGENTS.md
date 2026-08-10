# Consuelo Dialer agent instructions

Use this file as durable context for work in `stream/dialer`. It records the current product model, architecture, deployment topology, safety boundaries, and known operational lessons. Prefer current code and tests when they conflict with this document, then update this file in the same task.

## Product model

The embedded dialer is a GoHighLevel/LeadConnector adapter around the mature Consuelo dialer. It is not a new CRM contact picker and it must not fork core dialing behavior.

Use these mappings:

- GoHighLevel pipeline = group of callable queues.
- Pipeline stage = predictive queue. Examples include New Lead, Hot Lead, New Booking, Visit Attended, Sale, and Left a Review.
- Opportunity = queue membership and linked deal context.
- Contact = callable person and phone identity.
- Direct contact or phone action = Single dial.

The primary queue action is “Call Hot Lead,” not “Call Kokayi Cobb.” The server resolves every eligible opportunity in the selected stage, hydrates its contact, applies attempt and calling-window rules, ranks the candidates, and chooses the next batch.

## Reuse before invention

Do not rewrite or duplicate:

- predictive ranking, Whittle/MDP learning, or lead selection;
- local-presence caller-ID selection;
- caller-ID locks;
- contact attempt ledger or learned outcomes;
- Twilio call lifecycle and AMD handling;
- conference winner selection and loser termination;
- browser-agent Voice SDK bridging;
- retry, cleanup, and terminal-session behavior.

The mature Twenty dialer remains a product and interaction reference, but the LeadConnector iframe must not import the Twenty shell, router, Recoil state, GraphQL object model, or CRM-specific component tree. Port behavior and contracts; do not embed the old application.

The browser sends intent and projects authoritative server state. It does not rank leads, infer a winner, or decide provider lifecycle locally.

## Home and queue experience

The default surface should follow the mature preparation flow:

- Choose list / Single dial.
- Pipeline-stage queue selector grouped by pipeline.
- Call from.
- Prefer local presence, enabled by default unless a stored preference says otherwise.
- Predictive Dialer (recommended) or Single (one call at a time).
- One, Two, or Three lines.

The selected line count is `requestedFanout`. It is not the candidate-pool size. Send the complete eligible pool or a server-side queue reference and let the backend select one to three calls.

Queue phases should remain explicit:

1. Home/preparation.
2. Queue preview or direct confirmation.
3. Microphone and browser-agent preparation.
4. Dialing batch.
5. Ringing.
6. Connected human winner.
7. Wrap-up and disposition.
8. Continue queue, complete queue, or return home.
9. Recoverable error.

During a queue, show queue identity, progress, current batch state, pause/resume/stop, the human winner, and summarized losing legs. Do not add AI coaching, scripts, or transcript analysis to the launch overlay.

## Refresh and reset semantics

The iframe must not require a top-level GoHighLevel reload to see new contacts, opportunities, or stage changes.

Use stale-while-revalidate refreshes:

- after authentication;
- whenever the dialer opens;
- on window focus;
- when the document becomes visible;
- after terminal call/disposition state;
- after relevant route or provider invalidation events;
- on a modest idle interval while the dialer is open;
- through a manual refresh affordance.

Coalesce or cancel overlapping requests. Keep cached content visible while refreshing. Freeze a queue snapshot once dialing starts; do not mutate the active batch because CRM data changed in the background.

Separate two reset concepts:

- Soft return home preserves the signed embed session, installation identity, CRM cache, pipeline data, caller-ID/local-presence preferences, mode, and line count.
- Full reset is reserved for logout, reinstall, invalid installation, or unrecoverable authentication failure.

Direct calls should return home after wrap-up. Queue calls should advance to the next authoritative batch or finish and return home. A recoverable error must not destroy queue selection or force a page reload.

## Architecture and ownership

`packages/lead-connector` owns provider-specific OAuth/application behavior, signed iframe bootstrap, contacts, opportunities, pipelines, stages, dispositions, the browser application, and the installed launcher contract.

`packages/dialer-server` owns the Hono HTTP/WebSocket transport and production runtime composition.

`packages/dialer` owns canonical telephony and dialing business logic.

Use this boundary:

- Hono validates transport input, authentication, provider signatures, WebSocket upgrades, and response translation.
- Effect owns application workflows, persistence, retries, lifecycle state, typed failures, and cleanup.
- Provider and database adapters implement Effect ports/layers.

Do not place SQL, Groq request construction, ranking, retry policy, or lifecycle orchestration directly in Hono handlers.

The iframe receives only opaque signed context and short-lived embed sessions. Provider OAuth tokens, Twilio credentials, signing secrets, encryption keys, and environment secrets must never enter browser assets or logs.

## GoHighLevel surfaces

There are two user-facing LeadConnector surfaces:

- The sidebar Custom Menu iframe, used for the full admin/operator workspace.
- Marketplace Custom JS/CSS injected into Contacts and Opportunities, used for the native launcher and `/overlay` iframe.

The launcher must remain unique across SPA rerenders, route-aware, lazily create its iframe, preserve active-call state across route changes, and use a supported signed session-context API.

The admin workspace should prioritize:

- active calls;
- chronological call history;
- one card per operator-visible dialer session, not per raw provider leg;
- transcript status and transcript detail;
- disposition, notes, and tags;
- linked opportunity, pipeline/stage, current deal status, and value;
- child attempt legs and collapsed technical diagnostics.

Disposition and deal outcome are separate. Do not infer Won/Lost from transcript language or a call disposition; the linked CRM opportunity is authoritative.

## Deployment topology

Railway, Cloudflare, and Marketplace are separate deployments.

1. Railway runs `dialer-server`, the Hono/Effect backend.
2. Cloudflare serves the LeadConnector iframe application at `/`, `/admin`, and `/overlay`, and proxies approved API/webhook/integration/health routes to Railway.
3. GoHighLevel Marketplace stores the generated Custom JS HTML and Custom CSS that create the Contacts/Opportunities launcher.

A Git push, merged PR, or Railway deployment does not update the visible GoHighLevel UI by itself.

For UI changes:

- build and test the LeadConnector package;
- deploy the embed Worker from the exact validated checkout;
- verify a visible build marker and cache-busted asset bytes;
- update Marketplace Custom JS with the generated inline-script HTML artifact;
- update Marketplace Custom CSS with the generated CSS artifact;
- save/publish and read the Marketplace record back; a Save click alone is not proof;
- verify the Custom Menu points to the Cloudflare iframe origin with microphone permission;
- test Contacts, Opportunities, the admin page, session exchange, and browser network origins.

The Railway dialer service uses manual artifact deployment unless its service configuration is explicitly changed. Do not assume a Git push deploys it.

A healthy `/health` response proves only process availability. It does not prove Redis/Postgres connectivity, signed callbacks, Twilio conferences, browser media, provider credentials, or cleanup.

## Live-call safety and verification

Never place a real carrier call without explicit authorization for the exact source number, destination number, and fanout. One authorization permits one initiation only. Do not automatically redial after failure.

Before a live call:

- verify the authenticated GoHighLevel location and installation;
- verify the visible browser and microphone with real `getUserMedia`;
- verify source, destination, fanout, recording, and transcription scope;
- audit for existing active calls and stale caller-ID locks.

During and after a live call, verify more than UI labels:

- customer and browser-agent Twilio legs;
- conference membership, mute, and hold flags;
- callback timing and server session state;
- caller-ID lock ownership and release;
- cleanup failures and terminal group state;
- zero orphaned browser-agent legs and zero active calls after completion.

Mask phone numbers, Twilio SIDs, tokens, and credentials in output. Never fake microphone permission or user-confirmed audio. Recording and transcription require separate explicit scope and disclosure.

## Known production lessons

These fixes are part of the current architecture and must not regress:

- Browser Twilio Voice agent bridging before winner connection.
- Worker CSP access to Twilio HTTPS and secure WebSocket signaling.
- Terminal browser-agent disconnect after completed or failed sessions.
- Caller-ID lock release after stale, machine-only, and force-terminated sessions.
- Winner-unmute reconciliation when Twilio creates the conference participant after winner selection.
- Exact lock-key audits use `caller-id-lock:*`; a broad guessed pattern can falsely report zero locks.
- Signed embed sessions expire; recovery should refresh authentication without destroying operator state.

## Transcription and call history direction

Transcription uses Groq `whisper-large-v3-turbo` through `GROQ_API_KEY` when explicitly enabled for the workspace and authorized for the test/call.

Keep the Hono/Effect boundary:

- Hono accepts and validates the Twilio Media Stream WebSocket and authenticated history routes.
- Effect owns transcription sessions, bounded buffering, Groq provider calls, idempotent segment persistence, retry/timeout behavior, terminal flush, call history, and tenant authorization.

Do not retain raw call audio. Keep media in bounded memory buffers, persist transcript text/timestamps only, and discard audio after processing or failure. Do not invent confidence values or speaker identity. Inbound/outbound track labels are acceptable until the current topology proves customer/representative attribution.

History is session-centric:

- dialer session;
- provider/customer/agent legs;
- transcript segments;
- dispositions and CRM synchronization;
- future transfer events.

Transfers already exist in the shared conference/Twenty implementation, including cold and warm flows, but are not yet exposed through the current Hono application contract or LeadConnector UI. Do not claim embedded transfer support until those adapters and controls are wired and tested.

## Testing and delivery

Start with red tests. Validate the narrow package plus every affected boundary:

- dialer domain tests when shared call behavior changes;
- dialer-server tests when Hono/application contracts change;
- LeadConnector tests for iframe, launcher, admin, session, and resource behavior;
- typechecks and builds;
- strict review and full verify;
- secret and diff checks;
- no-carrier browser verification before any live authorization.

Use the existing authenticated desktop browser for GoHighLevel work. Do not close the browser, switch profiles, or replace the session while a user is logging in. Stop only for genuine human-only prompts such as password, MFA, CAPTCHA, passkey, consent, or microphone permission.
