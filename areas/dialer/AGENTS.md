# Dialer development, validation, and release runbook

The dialer is runtime-sensitive. Static review is necessary, but it is not proof that calls, TwiML, callbacks, parallel winner selection, or caller-ID lock release work.

## Operating rules

- Use an isolated `task/dialer/...` branch and target `stream/dialer`.
- Keep OS and workspace runtime deployments out of Railway. Railway is for the dialer application services and their required data services only.
- The production app-facing call-start contract is GraphQL `startDialerCall`.
- REST is reserved for Twilio/provider callbacks and quarantined legacy routes.
- Never put credentials, complete phone numbers, auth tokens, account SIDs, or caller IDs in source, workpads, PR text, Linear, logs, or scenario transcripts.
- A UI transition to active queue controls proves only that call start did not fail immediately. It does not prove a completed Twilio lifecycle.

## Product, embedded GoHighLevel, and RD contract

The product model, embedded LeadConnector behavior, architecture boundaries, and active RD coordination rules belong with Dialer project guidance. They are repository-local context and are not part of global Consuelo steering or the customer OS runtime.

### RD inbound routing program

For RD0-RD8 work, read [the RD coordination entry point](rd/README.md),
[the agent handoff protocol](rd/COORDINATION.md), and the requested work-ID contract
in [the dependency graph](rd/GRAPH.md) before starting or resuming work.
All RD tasks integrate into `stream/dialer`; start dependent tasks from the current
stream tip. A branched chat inherits context, not proof that sibling work landed.
Read the latest stream files and verify task PRs, checks, commits, and prerequisites
at startup and before the final copyable handoff. RD0 owns graph alignment;
publishing its coordination documents does not itself authorize RD1 or freeze open
product decisions. Keep RD-specific guidance here rather than global steering.

### Product model

The embedded dialer is a GoHighLevel/LeadConnector adapter around the mature Consuelo dialer. It is not a new CRM contact picker and it must not fork core dialing behavior.

Use these mappings:

- GoHighLevel pipeline = group of callable queues.
- Pipeline stage = predictive queue. Examples include New Lead, Hot Lead, New Booking, Visit Attended, Sale, and Left a Review.
- Opportunity = queue membership and linked deal context.
- Contact = callable person and phone identity.
- Direct contact or phone action = Single dial.

The primary queue action is “Call Hot Lead,” not “Call Kokayi Cobb.” The server resolves every eligible opportunity in the selected stage, hydrates its contact, applies attempt and calling-window rules, ranks the candidates, and chooses the next batch.

### Reuse before invention

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

### Home and queue experience

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

### Refresh and reset semantics

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

### Architecture and ownership

`packages/lead-connector` owns provider-specific OAuth/application behavior, signed iframe bootstrap, contacts, opportunities, pipelines, stages, dispositions, the browser application, and the installed launcher contract.

`packages/dialer-server` owns the Hono HTTP/WebSocket transport and production runtime composition.

`packages/dialer` owns canonical telephony and dialing business logic.

Use this boundary:

- Hono validates transport input, authentication, provider signatures, WebSocket upgrades, and response translation.
- Effect owns application workflows, persistence, retries, lifecycle state, typed failures, and cleanup.
- Provider and database adapters implement Effect ports/layers.

Do not place SQL, Groq request construction, ranking, retry policy, or lifecycle orchestration directly in Hono handlers.

The iframe receives only opaque signed context and short-lived embed sessions. Provider OAuth tokens, Twilio credentials, signing secrets, encryption keys, and environment secrets must never enter browser assets or logs.

### GoHighLevel surfaces

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

### Deployment topology

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

### Live-call safety and verification

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

### Known production lessons

These fixes are part of the current architecture and must not regress:

- Browser Twilio Voice agent bridging before winner connection.
- Worker CSP access to Twilio HTTPS and secure WebSocket signaling.
- Terminal browser-agent disconnect after completed or failed sessions.
- Caller-ID lock release after stale, machine-only, and force-terminated sessions.
- Winner-unmute reconciliation when Twilio creates the conference participant after winner selection.
- Exact lock-key audits use `caller-id-lock:*`; a broad guessed pattern can falsely report zero locks.
- Signed embed sessions expire; recovery should refresh authentication without destroying operator state.

### Transcription and call history direction

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

### Testing and delivery

Start with red tests. Validate the narrow package plus every affected boundary:

- dialer domain tests when shared call behavior changes;
- dialer-server tests when Hono/application contracts change;
- LeadConnector tests for iframe, launcher, admin, session, and resource behavior;
- typechecks and builds;
- strict review and full verify;
- secret and diff checks;
- no-carrier browser verification before any live authorization.

Use the existing authenticated desktop browser for GoHighLevel work. Do not close the browser, switch profiles, or replace the session while a user is logging in. Stop only for genuine human-only prompts such as password, MFA, CAPTCHA, passkey, consent, or microphone permission.

## Known production handoff

The May 2026 production fixes established these contracts:

1. List queues must use the underlying person ID, not the ListMember ID, when crossing into backend queue records.
2. Frontend and backend queue matching must use the same contact/person ID semantics.
3. Do not guess workspace physical phone columns. Queue call start sends validated `contactIds` and `targetPhones`; backend target resolution may use those phones as a fallback keyed by contact ID.
4. The previous `NO_CALLABLE_TARGETS` and nonexistent person-phone-column failures were removed. Production reached active queue controls after those fixes.
5. That evidence did not prove real call completion, public TwiML fetches, signed callbacks, AMD handling, winner/loser termination, or lock reuse. Those remain live-release gates.

## Local infrastructure

### Install once

```bash
brew install postgresql@17 redis pgvector cloudflared
```

The minimum supported local services are Brew PostgreSQL 17 and Redis. pgvector must be installed and enabled in the `default` database.

### Start and verify

```bash
brew services start postgresql@17
brew services start redis

brew list --versions postgresql@17 redis pgvector
/opt/homebrew/opt/postgresql@17/bin/pg_isready
redis-cli ping
/opt/homebrew/opt/postgresql@17/bin/psql \
  -d default \
  -Atqc "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

Expected signals:

- PostgreSQL reports `accepting connections`.
- Redis prints `PONG`.
- The vector query prints a version.

Enable pgvector when the version query is empty:

```bash
/opt/homebrew/opt/postgresql@17/bin/psql \
  -d default \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

### Local environment shape

```bash
export PG_DATABASE_URL='postgres://postgres@localhost:5432/default'
export DATABASE_URL="$PG_DATABASE_URL"
export REDIS_URL='redis://localhost:6379'
export FRONT_BASE_URL='http://localhost:3001'
```

### Task-worktree server environment

Git task worktrees do not inherit ignored files. `twenty-server` requires the local server `.env`—including `APP_SECRET`—before Nest can bind port 3000. Reuse the ignored file from the canonical checkout instead of copying secrets into a tracked task directory:

```bash
TASK_ROOT="$(git rev-parse --show-toplevel)"
CANONICAL_ROOT="$(git -C "$TASK_ROOT" worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }')"
SERVER_ENV_SOURCE="$CANONICAL_ROOT/packages/twenty-server/.env"
SERVER_ENV_TARGET="$TASK_ROOT/packages/twenty-server/.env"

if [ ! -f "$SERVER_ENV_SOURCE" ]; then
  printf 'missing canonical twenty-server .env; create it locally before continuing\n' >&2
  exit 1
fi

if [ ! -e "$SERVER_ENV_TARGET" ] && [ ! -L "$SERVER_ENV_TARGET" ]; then
  ln -s "$SERVER_ENV_SOURCE" "$SERVER_ENV_TARGET"
fi

test -s "$SERVER_ENV_TARGET"
grep -q '^APP_SECRET=' "$SERVER_ENV_TARGET"
```

These checks print only presence. Never print, copy into source control, or attach the `.env` contents. Twilio credentials and safe-number allowlists remain in Keychain and are exported separately.

### Reset the database

Run the reset from the server package directory. A successful reset is required before product-level runtime validation.

```bash
cd packages/twenty-server
PG_DATABASE_URL='postgres://postgres@localhost:5432/default' \
DATABASE_URL='postgres://postgres@localhost:5432/default' \
REDIS_URL='redis://localhost:6379' \
IS_CI=false \
NODE_OPTIONS=--max-old-space-size=8192 \
npx nx database:reset twenty-server
cd ../..
```

If reset fails, record and fix the infrastructure blocker before changing dialer behavior.

## Twilio credentials and safe-number allowlists

### Current macOS Keychain contract

The Keychain account is the local macOS user, normally referenced as `$USER`. These six service names are current:

- `consuelo_twilio_live_account_sid`
- `consuelo_twilio_live_auth_token`
- `consuelo_twilio_test_account_sid`
- `consuelo_twilio_test_auth_token`
- `consuelo_scenario_safe_to_numbers`
- `consuelo_scenario_safe_from_numbers`

The current scenario path uses account SID plus Auth Token. Do not add API-key entries to this runbook unless the runtime is changed to consume them.

The safe-to item is a comma-separated allowlist of approved call destinations. The safe-from item is a comma-separated allowlist of Twilio-owned or Twilio-verified outbound caller IDs. A personal test destination is not automatically a valid FROM number.

### Add or update an item

Use placeholders at the terminal prompt; do not paste values into tracked files or chat transcripts.

```bash
security add-generic-password \
  -a "$USER" \
  -s 'consuelo_twilio_live_account_sid' \
  -w '<LIVE_ACCOUNT_SID>' \
  -U

security add-generic-password \
  -a "$USER" \
  -s 'consuelo_scenario_safe_to_numbers' \
  -w '<E164_SAFE_TO_A>,<E164_SAFE_TO_B>' \
  -U
```

Repeat with the other service names as needed.

### Verify presence without printing values

```bash
for service in \
  consuelo_twilio_live_account_sid \
  consuelo_twilio_live_auth_token \
  consuelo_twilio_test_account_sid \
  consuelo_twilio_test_auth_token \
  consuelo_scenario_safe_to_numbers \
  consuelo_scenario_safe_from_numbers
do
  if security find-generic-password -a "$USER" -s "$service" -w >/dev/null 2>&1; then
    printf '%s: present\n' "$service"
  else
    printf '%s: missing\n' "$service"
  fi
done
```

Safe checks may print only presence, list counts, or a redacted prefix/suffix. They must not print a complete value.

### Export into the shell that starts twenty-server

Keychain storage alone does nothing for the server. Export values into the same shell that starts twenty-server. Restart the server after changing any export.

Base exports for every mode:

```bash
export PG_DATABASE_URL='postgres://postgres@localhost:5432/default'
export DATABASE_URL="$PG_DATABASE_URL"
export REDIS_URL='redis://localhost:6379'
export FRONT_BASE_URL='http://localhost:3001'
export CONSUELO_SCENARIO_SAFE_TO_NUMBERS="$(security find-generic-password -a "$USER" -s 'consuelo_scenario_safe_to_numbers' -w)"
export CONSUELO_SCENARIO_SAFE_FROM_NUMBERS="$(security find-generic-password -a "$USER" -s 'consuelo_scenario_safe_from_numbers' -w)"
```

Live server exports:

```bash
export TWILIO_ACCOUNT_SID="$(security find-generic-password -a "$USER" -s 'consuelo_twilio_live_account_sid' -w)"
export TWILIO_AUTH_TOKEN="$(security find-generic-password -a "$USER" -s 'consuelo_twilio_live_auth_token' -w)"
export CONSUELO_SCENARIO_CALL_MODE='live'
export CONSUELO_SCENARIO_LIVE_CALLS_ENABLED='true'
```

Twilio-test exports:

```bash
export TWILIO_TEST_ACCOUNT_SID="$(security find-generic-password -a "$USER" -s 'consuelo_twilio_test_account_sid' -w)"
export TWILIO_TEST_AUTH_TOKEN="$(security find-generic-password -a "$USER" -s 'consuelo_twilio_test_auth_token' -w)"
export CONSUELO_SCENARIO_CALL_MODE='twilio-test'
export CONSUELO_SCENARIO_LIVE_CALLS_ENABLED='false'
```

Secret-safe export verification:

```bash
printf 'live SID loaded: %s\n' "$([ -n "${TWILIO_ACCOUNT_SID:-}" ] && echo yes || echo no)"
printf 'live token loaded: %s\n' "$([ -n "${TWILIO_AUTH_TOKEN:-}" ] && echo yes || echo no)"
printf 'test SID loaded: %s\n' "$([ -n "${TWILIO_TEST_ACCOUNT_SID:-}" ] && echo yes || echo no)"
printf 'test token loaded: %s\n' "$([ -n "${TWILIO_TEST_AUTH_TOKEN:-}" ] && echo yes || echo no)"
printf 'safe TO count: %s\n' "$(awk -F, '{print NF}' <<<"${CONSUELO_SCENARIO_SAFE_TO_NUMBERS:-}")"
printf 'safe FROM count: %s\n' "$(awk -F, '{print NF}' <<<"${CONSUELO_SCENARIO_SAFE_FROM_NUMBERS:-}")"
```

## Public callback tunnel

Twilio-backed modes reject localhost callback bases. The intended stable local callback hostname is `dialer-dev.consuelohq.com`, routed directly to the existing named Cloudflare Tunnel.

The OS workspace edge Worker currently owns `*.consuelohq.com/*`. A dialer callback hostname must bypass that Worker; it is not a workspace-site route and must not be registered in the workspace D1 route registry. Cloudflare needs an exact **no-script Worker route exclusion** for `dialer-dev.consuelohq.com/*`, which is more specific than the wildcard Worker route.

Verify the routing boundary before using the stable hostname:

```bash
curl -sS -o /tmp/dialer-stable-health.txt -w 'stable public health: HTTP %{http_code}\n' \
  https://dialer-dev.consuelohq.com/healthz

grep -q 'WORKSPACE_HOSTNAME_NOT_FOUND' /tmp/dialer-stable-health.txt && {
  printf 'missing no-script Worker route exclusion for dialer-dev.consuelohq.com/*\n' >&2
  exit 1
}
```

If that error appears, create the exact no-script exclusion through the Cloudflare control plane or the existing OS provisioning primitive before claiming the stable hostname works. Do not deploy or weaken the workspace edge Worker from a dialer task.

### Configure the existing named tunnel

Preserve all existing ingress entries. Add this entry before the final `http_status:404` catch-all in `~/.cloudflared/config.yml`:

```yaml
- hostname: dialer-dev.consuelohq.com
  service: http://localhost:3000
```

The complete ingress list must still end with one catch-all:

```yaml
- service: http_status:404
```

If DNS has not been routed for the hostname, run this once with the existing tunnel name, not a new tunnel:

```bash
cloudflared tunnel route dns <EXISTING_TUNNEL_NAME> dialer-dev.consuelohq.com
```

Run the existing named tunnel:

```bash
cloudflared --config "$HOME/.cloudflared/config.yml" tunnel run
```

Set the public base before starting or restarting the server:

```bash
export DIALER_PUBLIC_BASE_URL='https://dialer-dev.consuelohq.com'
export API_BASE_URL="$DIALER_PUBLIC_BASE_URL"
export SERVER_URL="$DIALER_PUBLIC_BASE_URL"

cd packages/twenty-server
NODE_OPTIONS=--max-old-space-size=8192 npx nx start twenty-server
```

The tunnel, exports, and server must be active at the same time.

### Temporary quick-tunnel fallback

Use this only when the named tunnel is healthy but the stable hostname is still intercepted by the workspace Worker. A quick tunnel proves local/public callback behavior without changing OS domain routing, but its `trycloudflare.com` hostname changes every time and is not a deployment target.

```bash
rm -f /tmp/dialer-quick-tunnel.log /tmp/dialer-public-base-url
nohup cloudflared --config /dev/null tunnel \
  --url http://localhost:3000 \
  --no-autoupdate \
  > /tmp/dialer-quick-tunnel.log 2>&1 < /dev/null &
echo $! > /tmp/dialer-quick-tunnel.pid

for attempt in $(seq 1 20); do
  QUICK_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' \
    /tmp/dialer-quick-tunnel.log | tail -1 || true)"
  if [ -n "$QUICK_URL" ]; then
    printf '%s' "$QUICK_URL" > /tmp/dialer-public-base-url
    break
  fi
  sleep 2
done

test -s /tmp/dialer-public-base-url
export DIALER_PUBLIC_BASE_URL="$(cat /tmp/dialer-public-base-url)"
export API_BASE_URL="$DIALER_PUBLIC_BASE_URL"
export SERVER_URL="$DIALER_PUBLIC_BASE_URL"
```

Restart `twenty-server` after selecting the quick URL. Stop and recreate the quick tunnel—and restart the server—when the URL changes.

## Callback contract and preflight curls

The current parallel callback routes are:

- `POST /api/v1/calls/parallel/status-callback`
- `POST /api/v1/calls/parallel/customer-twiml`

There are no separate AMD or generic event callback routes in the current production path. Twilio sends call status and `AnsweredBy` to the status callback. The customer TwiML route is fetched by Twilio for a real call leg.

Both routes require a valid `x-twilio-signature`. An unsigned request should return HTTP 401; that proves the public route reaches the application and the signature guard is active.

```bash
curl -sS \
  -o /tmp/dialer-unsigned-status-response.txt \
  -w 'unsigned status callback: HTTP %{http_code}\n' \
  -X POST \
  "$DIALER_PUBLIC_BASE_URL/api/v1/calls/parallel/status-callback" \
  --data 'CallSid=CA_PREFLIGHT_ONLY&CallStatus=completed'

curl -sS \
  -o /tmp/dialer-unsigned-twiml-response.txt \
  -w 'unsigned customer TwiML: HTTP %{http_code}\n' \
  -X POST \
  "$DIALER_PUBLIC_BASE_URL/api/v1/calls/parallel/customer-twiml" \
  --data 'CallSid=CA_PREFLIGHT_ONLY'
```

Expected: HTTP 401 for both requests.

A signed synthetic status callback can prove the tunnel hostname, forwarded URL reconstruction, Twilio signature guard, controller, and no-group acknowledgement without placing a call. It uses the already exported live Auth Token but never prints it.

```bash
export CALLBACK_URL="$DIALER_PUBLIC_BASE_URL/api/v1/calls/parallel/status-callback"
export CALLBACK_FORM='CallSid=CA_PREFLIGHT_ONLY&CallStatus=completed&AnsweredBy=human'
export TWILIO_SIGNATURE="$({
  CALLBACK_URL="$CALLBACK_URL" \
  CALLBACK_FORM="$CALLBACK_FORM" \
  TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" \
  node <<'NODE'
const twilio = require('twilio');
const params = Object.fromEntries(new URLSearchParams(process.env.CALLBACK_FORM));
process.stdout.write(
  twilio.getExpectedTwilioSignature(
    process.env.TWILIO_AUTH_TOKEN,
    process.env.CALLBACK_URL,
    params,
  ),
);
NODE
})"

curl -sS \
  -o /tmp/dialer-signed-status-response.txt \
  -w 'signed status callback: HTTP %{http_code}\n' \
  -X POST \
  -H "x-twilio-signature: $TWILIO_SIGNATURE" \
  "$CALLBACK_URL" \
  --data "$CALLBACK_FORM"

unset TWILIO_SIGNATURE CALLBACK_FORM CALLBACK_URL
```

Expected: HTTP 200 and a small acknowledgement body. Do not print request headers or run curl in verbose/trace mode because that can expose the signature.

The signed synthetic callback does not prove group lookup, TwiML generation, AMD winner selection, termination, telemetry, posterior updates, or lock release. Those require a real live group.

## Scenario runner

The runner is `packages/workspace/scripts/run-dialer-scenario.ts` and calls the production GraphQL `startDialerCall` mutation.

Scenario selection:

```bash
export CONSUELO_SCENARIO_MODE='single'      # one direct target
export CONSUELO_SCENARIO_MODE='predictive'  # queue/fan-out path
export CONSUELO_SCENARIO_MODE='both'        # run both
```

Call modes and proof boundaries:

| Mode          | What it proves                                                                                                                                                                                     | What it does not prove                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `mock`        | Authentication, GraphQL contract, direct/queue target resolution, allowlisted input shape, fan-out/capacity calculations, DB call rows, and transcript redaction.                                  | Any Twilio API behavior, TwiML, callbacks, conferences, AMD, or real lock lifecycle.                             |
| `twilio-test` | Test credentials are distinct and load correctly; Twilio client/request construction and provider validation behavior; public callback-base guard; explicit safe-number requirements.              | It does not prove real TwiML, real calls, conferences, callbacks, AMD, call delivery, or caller-ID lock release. |
| `live`        | Real account compatibility, approved FROM/TO numbers, call delivery, TwiML fetch, signed status callbacks, AMD result handling, winner/loser termination, terminal lock release, and number reuse. | Nothing beyond the exact scenarios and account state exercised.                                                  |

In practical terms, only live proves the end-to-end provider and callback lifecycle.

Run from the repository root after the server is healthy and authentication variables are available. When sign-in returns multiple workspaces, the runner tries returned login tokens in order until one exchanges successfully. Set `CONSUELO_SCENARIO_WORKSPACE_ID` to force one known workspace; do not store machine-specific workspace IDs in this file.

```bash
CONSUELO_SCENARIO_MODE=single \
CONSUELO_SCENARIO_CALL_MODE=mock \
bun packages/workspace/scripts/run-dialer-scenario.ts

CONSUELO_SCENARIO_MODE=predictive \
CONSUELO_SCENARIO_CALL_MODE=mock \
CONSUELO_SCENARIO_REQUESTED_FANOUT=2 \
bun packages/workspace/scripts/run-dialer-scenario.ts

CONSUELO_SCENARIO_MODE=both \
CONSUELO_SCENARIO_CALL_MODE=twilio-test \
bun packages/workspace/scripts/run-dialer-scenario.ts
```

For live mode, both the server process and scenario process must receive the live credentials, safe allowlists, and public HTTPS base. Live mode also requires:

```bash
export CONSUELO_SCENARIO_CALL_MODE='live'
export CONSUELO_SCENARIO_LIVE_CALLS_ENABLED='true'
```

Scenario transcripts may contain only counts, boolean credential presence, redacted phone suffixes, redacted bearer tokens, call/group IDs, status, capacity, and step outcomes. Inspect every transcript before attaching it to a workpad or PR.

## Required validation ladder

### 1. Static and focused tests

```bash
bun run --cwd packages/workspace test -- tests/dialer-validation-runbook.test.ts

npx jest \
  packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.spec.ts \
  packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts \
  --config=packages/twenty-server/jest.config.mjs \
  --runInBand

npx jest \
  packages/dialer/src/services/caller-id.spec.ts \
  packages/dialer/src/services/parallel-dialer.spec.ts \
  --config=packages/dialer/jest.config.mjs \
  --runInBand

npx nx typecheck @consuelo/dialer
npx nx typecheck twenty-server
git diff --check
```

Also run `scripts/code-review.sh`; dialer-critical changes are routed through the focused tests above.

### 2. Mock scenarios

Run single, predictive, and both. Confirm requested versus actual fan-out, reduced-capacity reasons, DB records, and redacted transcripts.

### 3. Twilio-test scenario

Confirm test and live credentials differ. Record the provider response or expected validation behavior. A normal live-account caller ID may be rejected unless that FROM number is separately verified, purchased, or represented by an approved Twilio test fixture in the test account. That provider rejection still proves the request reached Twilio test-account validation; it does not prove a successful phone lifecycle.

### 4. Public callback preflight

Confirm:

- local health is HTTP 200;
- public health is HTTP 200;
- unsigned callback requests are HTTP 401;
- signed synthetic status callback is HTTP 200;
- no secret or complete phone number is emitted.

### 5. Controlled live single call

Use one approved destination and one approved Twilio-owned or verified caller ID. Record only redacted evidence.

Required proof:

- GraphQL start returns a real provider call/group ID;
- Twilio fetches customer TwiML;
- signed status callbacks reach the local server;
- terminal status releases the caller-ID lock;
- a second sequential single call can reacquire and reuse the caller ID.

### 6. Controlled live predictive call

Use only the approved allowlists and the smallest fan-out that proves parallel behavior.

Required proof:

- all requested legs are created or capacity reduction is explicit;
- AMD/status events attach to the correct group;
- the first eligible human/unknown answer wins under the active profile;
- losing legs terminate;
- loser locks release when connected;
- all remaining locks release when the group becomes terminal;
- a subsequent group can reuse the same caller IDs;
- telemetry/posterior updates occur once where applicable.

### 7. Edge-case matrix

At minimum cover:

- duplicate target numbers are deduplicated;
- DNC/blocked targets are excluded;
- attempt-limit targets are excluded;
- malformed or missing phones are excluded;
- fewer callable targets than requested fan-out;
- fewer caller IDs than requested fan-out;
- caller ID already locked;
- machine answer;
- unknown answer under each AMD policy;
- two near-simultaneous human-like answers;
- callback replay/idempotency;
- stale dialing group timeout;
- provider create failure after one or more legs exist;
- explicit group termination;
- two sequential groups reuse released numbers.

## Frontend production-contract check

Production frontend call start must use GraphQL `startDialerCall`. Search for accidental legacy use:

```bash
git grep -n "/v1/voice/preflight\|/api/v1/calls/parallel\|connect({" -- \
  packages/twenty-front/src/modules/dialer \
  packages/twenty-front/src/pages
```

Acceptable references are backend callback URLs, explicit quarantine tests, or documented legacy code not used by production call start. Frontend direct or queue start must not call the old REST bridges or browser Twilio `connect()` path.

## Railway deployment boundary and runtime truth

### Current repository audit

As of July 22, 2026:

- The repository has no root `railway.json` or `railway.toml`; Railway dashboard service settings are therefore part of the deployment contract and must be inspected directly.
- The root `Dockerfile` is a legacy `packages/api` image that exposes port 8000. It is not the current Twenty-backed dialer application image.
- The current server image is `packages/twenty-docker/twenty/Dockerfile`; the queue worker image is `packages/twenty-docker/twenty/Dockerfile.worker`.
- The server Dockerfile currently copies `packages/os` into the final image because `OsInstallController` reads `/app/packages/os/scripts/bootstrap.sh`. That means the current image does **not** yet satisfy the strict “no OS runtime/artifacts on Railway” boundary.
- Railway helper scripts expect the application service `opensaas` and worker service `twenty-worker`.

Do not reconnect automatic deploys until a dedicated deployment change resolves the OS installer coupling—such as publishing the bootstrap asset separately or adding a dialer-specific Docker target—and Railway explicitly points each service at the intended Dockerfile. Do not silently use the root Dockerfile.

Before enabling Railway again:

1. Inspect Railway project/service root directories, Dockerfiles, build commands, start commands, and watch paths.
2. Keep `packages/os`, `packages/workspace`, website, and unrelated monorepo services out of Railway builds and deploys.
3. Deploy only the dialer application runtime and required server/worker/data services.
4. Confirm the deployed commit matches the intended dialer stream/main commit.
5. Confirm public callback bases use the production HTTPS hostname, never the local tunnel.

Railway CLI must be authenticated before deployment inspection or changes. Do not infer deployment health from source or CI alone.

Minimum runtime filters:

```text
startDialerCall OR DialerCallStart OR parallel OR twilio OR queue OR CALLER_ID_LOCKED OR status-callback
```

Production is not validated until logs and provider evidence show the current GraphQL path, successful callbacks, terminal lock release, no repeated lock loop, no new Sentry errors, and no secrets or complete phone numbers in logs/transcripts.

## Completion standard

Do not say “the dialer works” unless the evidence level is named precisely:

- “static tests pass”
- “mock single/predictive pass”
- “Twilio-test request validation passes”
- “public signed callback preflight passes”
- “live single lifecycle passes”
- “live predictive lifecycle and lock reuse pass”
- “deployed production lifecycle passes”

If credentials, FROM verification, tunnel reachability, Railway authentication, account balance/state, or provider behavior blocks a level, record the exact blocker and stop at the last proven level.
