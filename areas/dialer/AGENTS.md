Dialer development setup and validation

Dialer work is runtime-sensitive. Do not rely only on static code review. The dialer must be validated through the GraphQL call-start path, Twilio-safe scenario modes, and callback/lock lifecycle evidence.

Required local infrastructure

Use local Brew services for dialer development unless ko explicitly says otherwise.

brew services start postgresql@17
brew services start redis

Required local env shape:

export PG_DATABASE_URL=postgres://postgres@localhost:5432/default
export DATABASE_URL=postgres://postgres@localhost:5432/default
export REDIS_URL=redis://localhost:6379

Postgres must have pgvector enabled:

psql -h localhost -U postgres -d default -c 'CREATE EXTENSION IF NOT EXISTS vector;'

Before changing dialer behavior, prove the database can reset:

PG_DATABASE_URL=postgres://postgres@localhost:5432/default \
DATABASE_URL=postgres://postgres@localhost:5432/default \
REDIS_URL=redis://localhost:6379 \
npx nx database:reset twenty-server

If database reset fails, fix or record the blocker before product refactor work.

Production call-start contract

The production call-start path is GraphQL:

Frontend app → GraphQL startDialerCall → DialerCallStartService → Twilio conference/callback/lock lifecycle

Scenario validation must use the same production contract:

Scenario runner → GraphQL startDialerCall → DialerCallStartService

Do not add a new app-facing REST call-start bridge. REST remains for Twilio/provider callbacks and quarantined legacy endpoints only.

Legacy app-facing call-start paths are not production contracts:

/v1/voice/preflight
/api/v1/calls/parallel
browser Twilio connect() for production queue/list start

Production frontend call-start code should not call those paths once the GraphQL migration is complete. If a legacy path remains temporarily, it must be logged/quarantined and documented.

Scenario modes

The scenario runner lives at:

packages/workspace/scripts/run-dialer-scenario.ts

Supported scenario modes:

CONSUELO_SCENARIO_MODE=single
CONSUELO_SCENARIO_MODE=predictive
CONSUELO_SCENARIO_MODE=both

Supported call modes:

CONSUELO_SCENARIO_CALL_MODE=mock
CONSUELO_SCENARIO_CALL_MODE=twilio-test
CONSUELO_SCENARIO_CALL_MODE=live

Mode meanings:

* mock: no Twilio API call. Use for fast local GraphQL/service validation.
* twilio-test: Twilio test credentials only. Use for request-construction and Twilio validation-error checks. This does not prove real TwiML, conferences, callbacks, or lock release.
* live: live Twilio credentials and explicit allowlisted real numbers. This is required before claiming live dialer behavior works.

Keychain storage for local live validation

Store sensitive values in macOS Keychain. Do not put credentials or full phone numbers in code, workpads, PR text, Linear, logs, or transcripts.

Expected Keychain item names:

consuelo_twilio_live_account_sid
consuelo_twilio_live_auth_token
consuelo_twilio_test_account_sid
consuelo_twilio_test_auth_token
consuelo_scenario_safe_to_numbers
consuelo_scenario_safe_from_numbers

Add or update values with -U:

security add-generic-password \
  -a "$USER" \
  -s "consuelo_twilio_live_account_sid" \
  -w "YOUR_REAL_LIVE_TWILIO_ACCOUNT_SID" \
  -U
security add-generic-password \
  -a "$USER" \
  -s "consuelo_twilio_live_auth_token" \
  -w "YOUR_REAL_LIVE_TWILIO_AUTH_TOKEN" \
  -U
security add-generic-password \
  -a "$USER" \
  -s "consuelo_scenario_safe_to_numbers" \
  -w "+1SAFE_TO_1,+1SAFE_TO_2,+1SAFE_TO_3" \
  -U
security add-generic-password \
  -a "$USER" \
  -s "consuelo_scenario_safe_from_numbers" \
  -w "+1TWILIO_OWNED_OR_VERIFIED_FROM_NUMBER" \
  -U

For live calls, CONSUELO_SCENARIO_SAFE_FROM_NUMBERS must contain a Twilio-owned number or verified outbound caller ID for the live Twilio account. Personal/cofounder numbers usually belong in CONSUELO_SCENARIO_SAFE_TO_NUMBERS, not SAFE_FROM, unless they are verified caller IDs in Twilio.

Presence check without printing secrets:

security find-generic-password -a "$USER" -s "consuelo_twilio_live_account_sid" -w >/dev/null && echo "live sid: present"
security find-generic-password -a "$USER" -s "consuelo_twilio_live_auth_token" -w >/dev/null && echo "live token: present"
security find-generic-password -a "$USER" -s "consuelo_scenario_safe_to_numbers" -w >/dev/null && echo "safe to numbers: present"
security find-generic-password -a "$USER" -s "consuelo_scenario_safe_from_numbers" -w >/dev/null && echo "safe from numbers: present"

Exporting Keychain values into the runtime shell

Keychain storage is not enough. The values must be exported into the shell that starts twenty-server and into the shell that runs the scenario.

Live mode exports:

export TWILIO_ACCOUNT_SID="$(security find-generic-password -a "$USER" -s "consuelo_twilio_live_account_sid" -w)"
export TWILIO_AUTH_TOKEN="$(security find-generic-password -a "$USER" -s "consuelo_twilio_live_auth_token" -w)"
export CONSUELO_SCENARIO_CALL_MODE=live
export CONSUELO_SCENARIO_LIVE_CALLS_ENABLED=true
export CONSUELO_SCENARIO_SAFE_TO_NUMBERS="$(security find-generic-password -a "$USER" -s "consuelo_scenario_safe_to_numbers" -w)"
export CONSUELO_SCENARIO_SAFE_FROM_NUMBERS="$(security find-generic-password -a "$USER" -s "consuelo_scenario_safe_from_numbers" -w)"

Twilio-test mode exports:

export TWILIO_TEST_ACCOUNT_SID="$(security find-generic-password -a "$USER" -s "consuelo_twilio_test_account_sid" -w)"
export TWILIO_TEST_AUTH_TOKEN="$(security find-generic-password -a "$USER" -s "consuelo_twilio_test_auth_token" -w)"
export CONSUELO_SCENARIO_CALL_MODE=twilio-test
export CONSUELO_SCENARIO_SAFE_TO_NUMBERS="$(security find-generic-password -a "$USER" -s "consuelo_scenario_safe_to_numbers" -w)"
export CONSUELO_SCENARIO_SAFE_FROM_NUMBERS="$(security find-generic-password -a "$USER" -s "consuelo_scenario_safe_from_numbers" -w)"

Do not print full values. Only print presence, counts, and redacted suffixes.

Safe verification:

echo "TWILIO_ACCOUNT_SID loaded: ${TWILIO_ACCOUNT_SID:0:2}***"
echo "TWILIO_AUTH_TOKEN loaded: $([ -n "$TWILIO_AUTH_TOKEN" ] && echo yes || echo no)"
echo "safe TO count: $(echo "$CONSUELO_SCENARIO_SAFE_TO_NUMBERS" | awk -F',' '{print NF}')"
echo "safe FROM count: $(echo "$CONSUELO_SCENARIO_SAFE_FROM_NUMBERS" | awk -F',' '{print NF}')"

Public callback URL requirement

Live Twilio validation cannot complete if API_BASE_URL or SERVER_URL is http://127.0.0.1:3000 or http://localhost:3000. Twilio must be able to reach the callback URLs from the public internet.

Use Cloudflare Tunnel or another approved public HTTPS tunnel for local live validation.

Example Cloudflare Tunnel:

cloudflared tunnel --url http://localhost:3000

Then set the public HTTPS URL before starting/restarting twenty-server:

export API_BASE_URL="https://YOUR-CLOUDFLARE-TUNNEL.trycloudflare.com"
export SERVER_URL="https://YOUR-CLOUDFLARE-TUNNEL.trycloudflare.com"
export FRONT_BASE_URL="http://localhost:3001"

Start/restart twenty-server from the same shell after exports:

npx nx start twenty-server

Live validation is only meaningful if:

* TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are present in the server process
* CONSUELO_SCENARIO_SAFE_TO_NUMBERS is present in the server process
* CONSUELO_SCENARIO_SAFE_FROM_NUMBERS is present in the server process
* API_BASE_URL / SERVER_URL point to public HTTPS URLs Twilio can reach
* the FROM number is Twilio-owned or verified for the live account
* no full phone numbers or secrets are written to logs, workpads, PR text, or transcripts

Required validation before claiming dialer work is done

At minimum, run and record evidence for:

# focused unit tests
npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.spec.ts \
  packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts \
  --config=packages/twenty-server/jest.config.mjs --runInBand
npx jest packages/dialer/src/services/caller-id.spec.ts \
  packages/dialer/src/services/parallel-dialer.spec.ts \
  --config=packages/dialer/jest.config.mjs --runInBand
# package typechecks where touched
npx nx typecheck @consuelo/dialer
npx nx typecheck twenty-server
# formatting / diff hygiene
npx prettier --check <changed-files>
git diff --check

Scenario evidence required before saying development works:

CONSUELO_SCENARIO_MODE=single CONSUELO_SCENARIO_CALL_MODE=mock bun packages/workspace/scripts/run-dialer-scenario.ts
CONSUELO_SCENARIO_MODE=predictive CONSUELO_SCENARIO_CALL_MODE=mock bun packages/workspace/scripts/run-dialer-scenario.ts
CONSUELO_SCENARIO_MODE=both CONSUELO_SCENARIO_CALL_MODE=mock bun packages/workspace/scripts/run-dialer-scenario.ts

Live evidence required before saying live dialer behavior works:

* live single call succeeds against allowlisted numbers
* live predictive call succeeds against allowlisted numbers
* Twilio status callbacks hit the public callback URL
* callbacks attach to the correct group/session
* terminal callback releases caller-ID locks
* two sequential single calls can reuse/reacquire the caller ID
* transcripts redact all full phone numbers

If live validation is blocked by credentials, unverified FROM number, callback reachability, or Twilio account state, stop and record the exact blocker. Do not claim the dialer works.

Frontend migration check

Before claiming production call-start is fixed, search frontend production code for legacy paths:

git grep -n "/v1/voice/preflight\|/api/v1/calls/parallel\|connect({" -- \
  packages/twenty-front/src/modules/dialer \
  packages/twenty-front/src/pages

Production frontend call-start should use GraphQL startDialerCall.

Acceptable remaining legacy references:

* tests that explicitly cover quarantine behavior
* provider callback URLs on the backend
* documented temporary legacy route code that is not used by frontend product call-start

Unacceptable remaining production frontend references:

* typed-number or clicked-person call-start hitting /v1/voice/preflight
* queue/list predictive call-start hitting /api/v1/calls/parallel
* browser Twilio connect() used as the production queue/list start mechanism

Production validation after deploy

Development validation is necessary but not sufficient. After deployment, use Railway logs as runtime truth.

Minimum Railway filter:

twilio OR queue OR startDialerCall OR CALLER_ID_LOCKED OR preflight OR parallel

Production is not fixed until runtime evidence shows:

* production typed-number call uses GraphQL startDialerCall
* production clicked-person call uses GraphQL startDialerCall
* production queue/list predictive start uses GraphQL startDialerCall
* Twilio callbacks hit production callback endpoints
* terminal callbacks release caller-ID locks
* Railway logs show no production frontend /v1/voice/preflight call-start usage
* Railway logs show no production frontend /api/v1/calls/parallel call-start usage
* Railway logs show no repeated CALLER_ID_LOCKED loop
* Sentry shows no new dialer call-start errors
* no full phone numbers or secrets appear in logs/transcripts

CI expectations for dialer work

Do not merge dialer work with failing CI unless ko explicitly approves a documented, unrelated, pre-existing failure.

For any dialer PR, at minimum ensure these checks are green or documented:

* changed-files / danger checks
* shared typecheck if shared utilities changed
* frontend typecheck if frontend dialer files changed
* twenty-server focused tests when backend dialer files changed
* @consuelo/dialer focused tests when packages/dialer changed
* git diff --check
* prettier check on changed TypeScript files

Future improvement: add a dedicated GitHub CI job for dialer-critical checks so regressions are caught automatically. Candidate job scope:

npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.spec.ts \
  packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts \
  --config=packages/twenty-server/jest.config.mjs --runInBand
npx jest packages/dialer/src/services/caller-id.spec.ts \
  packages/dialer/src/services/parallel-dialer.spec.ts \
  --config=packages/dialer/jest.config.mjs --runInBand
npx nx typecheck @consuelo/dialer

Do not add live Twilio tests to CI. Live Twilio validation requires secrets, allowlisted real numbers, callback reachability, and human/account coordination. Keep live validation as an explicit manual/release gate.
