
## Discovery — 2026-07-22

Goal: restore a repeatable local/live dialer validation workflow from DEV-1499 without exposing credentials or full phone numbers.

Acceptance contract:
- document Brew PostgreSQL 17, Redis, pgvector, database reset, Keychain item names, secret-safe checks/exports, Cloudflare Tunnel callbacks, preflight curls, and mock/twilio-test/live modes
- explain the proof boundary between twilio-test and live
- add durable stream/dialer setup notes and dialer coverage to code-review.sh
- validate documentation commands and focused review routing without printing secrets

Test-first contract:
- add a focused static validation script/test for required runbook sections and secret-safety invariants before final implementation
- run the repository review command scoped to changed files after implementation

Known evidence: DEV-1499 is Done; prior local setup used Homebrew PostgreSQL 17, Redis, pgvector, Keychain-backed Twilio credentials/allowlists, and a named Cloudflare Tunnel.

## workspace-owned: files read

- `areas/dialer/AGENTS.md`
- `packages/workspace/scripts/run-dialer-scenario.ts`

## Server startup wait — 2026-07-22 18:17 UTC

Wait reason: twenty-server was started with local DB/Redis, Keychain Twilio values, safe allowlists, and the public dialer base; startup must complete before callback checks.
Duration: bounded polling every 5 seconds for up to 120 seconds.
Resume action: request http://127.0.0.1:3000/healthz and inspect a sanitized server-log tail on failure.
Expected signal: HTTP 200 from local health.
Fallback: stop callback validation, inspect the first startup error without printing environment values, and fix the runtime blocker.

### Server startup wait result — 2026-07-22 18:19 UTC

Observed result: timed out after 24 attempts / 120 seconds. The sanitized startup log showed a single blocking configuration error: APP_SECRET was not set. PostgreSQL/Redis compilation and server build dependencies completed before the failure.
Next decision: locate an existing local APP_SECRET source by metadata only, export it into the server process, and repeat the same bounded health poll.

## Server restart wait — 2026-07-22 18:20 UTC

Wait reason: twenty-server was restarted after linking the ignored local server .env into the task worktree.
Duration: bounded polling every 5 seconds for up to 120 seconds.
Resume action: request http://127.0.0.1:3000/healthz and inspect a sanitized log tail only on failure.
Expected signal: HTTP 200 from local health.
Fallback: record the next required configuration or runtime error and stop before tunnel/callback checks.

### Server restart wait result — 2026-07-22 18:21 UTC

Observed result: local /healthz returned HTTP 200 on polling attempt 2. The ignored local server .env symlink supplied APP_SECRET; explicit DB, Redis, public URL, Twilio, and safe-list exports remained process-local.
Next decision: restart the existing named kiro tunnel connector so it loads the added dialer ingress, then poll the public health route.

## Tunnel propagation wait — 2026-07-22 18:21 UTC

Wait reason: the named Cloudflare connector must restart with the updated ingress and DNS must resolve through it.
Duration: bounded polling every 5 seconds for up to 120 seconds.
Resume action: request https://dialer-dev.consuelohq.com/healthz and inspect a sanitized tunnel-log tail on failure.
Expected signal: HTTP 200 from public health.
Fallback: keep local server validation as proven, record tunnel/DNS evidence, and do not run signed public callbacks.

### Tunnel propagation wait result — 2026-07-22 18:26 UTC

Observed result: public health returned HTTP 404 because the restarted connector was not alive. The sanitized connector log showed cloudflared help output: this installed version requires the global --config flag before the tunnel subcommand.
Next decision: correct the durable command to `cloudflared --config ... tunnel run`, restart the existing configured tunnel, and repeat public-health polling.

## Corrected tunnel propagation wait — 2026-07-22 18:26 UTC

Wait reason: cloudflared was restarted with the corrected global config flag ordering.
Duration: bounded polling every 5 seconds for up to 120 seconds.
Resume action: request https://dialer-dev.consuelohq.com/healthz and inspect connector liveness plus a sanitized log tail on failure.
Expected signal: HTTP 200 from public health.
Fallback: preserve local health evidence, record Cloudflare connection/DNS failure, and stop before signed callbacks.

## Quick-tunnel fallback wait — 2026-07-22 18:35 UTC

Wait reason: the stable `dialer-dev.consuelohq.com` DNS record is currently intercepted by the wildcard OS workspace Worker because its exact no-script route exclusion is absent. A temporary quick tunnel was started to prove the local callback stack without mutating OS domain routing.
Duration: bounded polling every 2 seconds for up to 40 seconds.
Resume action: parse the generated `trycloudflare.com` hostname from the connector log, restart twenty-server with that public base, and verify public health/callbacks.
Expected signal: one HTTPS quick-tunnel URL and an alive connector process.
Fallback: record Cloudflare quick-tunnel availability as the blocker and stop at local HTTP 200.

## Quick-tunnel server restart wait — 2026-07-22 18:35 UTC

Wait reason: twenty-server was restarted with the generated quick-tunnel HTTPS base so URL generation and signature reconstruction use the same public origin.
Duration: bounded polling every 3 seconds for up to 90 seconds.
Resume action: require both local and temporary-public `/healthz` to return HTTP 200.
Expected signal: local HTTP 200 and public HTTP 200.
Fallback: inspect sanitized server and quick-tunnel logs, then stop before callback requests.

### Quick-tunnel callback result — 2026-07-22 18:36 UTC

Observed result:
- local `/healthz`: HTTP 200
- temporary public `/healthz`: HTTP 200
- unsigned status callback: HTTP 401
- unsigned customer TwiML callback: HTTP 401
- correctly signed synthetic status callback: HTTP 200 with `{"received":true}`

Proof boundary: this validates Cloudflare public routing, forwarded host/protocol reconstruction, Twilio signature rejection/acceptance, and controller acknowledgement. It does not place a call or prove group lookup, generated TwiML, AMD, winner selection, loser termination, telemetry/posterior updates, or lock release/reuse.

Stable-host blocker: `dialer-dev.consuelohq.com` is correctly routed in the named tunnel but is intercepted by the wildcard OS workspace Worker. It requires an exact no-script Worker route exclusion (`dialer-dev.consuelohq.com/*`) or a dedicated non-workspace domain before it can be the stable callback base. No OS deployment or route mutation was performed in this dialer task.

## Scenario validation — 2026-07-22 18:39 UTC

Mock `both` result:
- safety preflight passed with three safe destinations and three safe caller IDs loaded from Keychain
- seeded-user authentication passed after explicitly selecting the valid local workspace
- single GraphQL call start returned `mocked`, requested 1, actual 1, one call row, no blocked or reduced-capacity reasons
- predictive GraphQL call start returned `mocked`, requested 2, actual 2, two call rows, no blocked or reduced-capacity reasons
- transcript contained no complete E.164 number

Local auth edge case: the reset database exposes two workspaces for the seeded user. The runner defaults to the first, whose login token is invalid; `CONSUELO_SCENARIO_WORKSPACE_ID` must select the valid workspace when more than one is returned. The durable runbook should require explicit selection rather than storing this machine-specific ID.

Twilio-test single result:
- safety preflight passed
- live/test credentials were present and distinct
- seeded-user authentication passed
- the request reached Twilio test-account validation
- Twilio rejected the selected caller ID because it is not verified/purchased in the test account
- no real call was placed
- transcript contained no complete E.164 number

Proof boundary: twilio-test currently proves test credential loading, separation from live credentials, request construction, callback-base validation, and provider-side caller-ID validation. A success-path test requires a FROM number approved by the Twilio test account or an explicit Twilio test fixture; only live proves the real call/TwiML/callback/lock lifecycle.

## Scenario workspace-selection fix — 2026-07-22 18:42 UTC

Implementation:
- exported a pure `selectWorkspaceLoginToken` helper from the scenario runner
- when no workspace ID is forced, the runner now tries returned workspace login tokens in order until one exchanges successfully
- `CONSUELO_SCENARIO_WORKSPACE_ID` remains a deterministic override and now fails clearly when absent or unexchangeable
- wrapped scenario execution in `import.meta.main` so the helper is unit-testable without running the CLI

Regression proof:
- four workspace-selection tests passed
- runbook/review contracts and workspace-selection tests passed together: 9/9
- mock `both` reran with no explicit workspace ID and passed authentication automatically
- single remained requested 1 / actual 1
- predictive remained requested 2 / actual 2
- no blocked or reduced-capacity reasons
- transcript contained no complete E.164 number

## Railway source audit — 2026-07-22 18:43 UTC

Observed source contract:
- no root `railway.json` or `railway.toml`; dashboard service settings are deployment-critical
- root Dockerfile builds the legacy `packages/api` image on port 8000 and is not the Twenty-backed dialer application
- current app image is `packages/twenty-docker/twenty/Dockerfile`; worker image is `Dockerfile.worker`
- current app Dockerfile copies `packages/os` because `OsInstallController` serves the OS bootstrap script from `/app/packages/os/scripts/bootstrap.sh`
- helper scripts identify Railway services as `opensaas` and `twenty-worker`
- Railway CLI is unauthenticated, so service roots, Dockerfile paths, watch paths, deployed commit, variables, health, and logs cannot yet be verified

Decision: do not reconnect automatic deployment until a separate deployment task removes or isolates the OS installer coupling and Railway explicitly targets the intended app/worker Dockerfiles. Runtime validation must resume with status, errors-only, `twilio OR queue`, build/network as needed, and worker-specific logs after authentication.

## workspace-owned: validation evidence

- 2026-07-22 18:45:55 `verify`: failed — COMMAND_FAILED
- 2026-07-22 18:46:39 `verify`: failed — COMMAND_FAILED
- 2026-07-22 18:47:02 `verify`: failed — COMMAND_FAILED
- 2026-07-22 18:48:47 `verify`: failed — COMMAND_FAILED
- 2026-07-22 18:49:19 `verify`: passed — OK
- 2026-07-22 18:50:28 `verify`: passed — OK

## Final verification — 2026-07-22 18:49 UTC

Final source and runtime evidence:
- workspace dialer contracts: 9/9 passed
- repository `scripts/code-review.sh`: 17/17 passed, including untracked dialer test detection
- full repository verify against `stream/dialer`: passed; zero introduced, related, or pre-existing findings in scope; DB risk check passed
- focused twenty-server, dialer package, and frontend queue bridge suites passed
- `@consuelo/dialer` typecheck passed
- full `twenty-server` typecheck remains an inherited repository baseline with 3,031 errors across 669 non-dialer files and zero dialer/Consuelo API errors
- final mock `both` rerun after error-handling normalization: single requested/actual 1 with one call; predictive requested/actual 2 with two calls; no blocked or reduced-capacity reasons
- final transcript contained no complete E.164 number
- added-lines and untracked-file secret/phone scan passed
- `git diff --check` passed

Proven levels:
- local PostgreSQL 17, Redis, pgvector, and full DB reset
- Keychain credential/allowlist presence and process-local export contract
- local server health
- public quick-tunnel health
- unsigned callback rejection and correctly signed synthetic callback acceptance
- mock single and predictive GraphQL call-start flows
- Twilio-test credential separation, request construction, and provider-side caller-ID validation

Not yet proven:
- a real live single call lifecycle
- real TwiML fetch, AMD, predictive winner/loser behavior, terminal lock release, and caller-ID reuse
- stable `dialer-dev.consuelohq.com` routing until the exact no-script Worker route exclusion exists
- Railway service configuration or deployed runtime until CLI authentication is restored
- a Railway image that satisfies the strict no-OS-artifacts boundary; the current Twenty server image still copies the OS bootstrap asset
