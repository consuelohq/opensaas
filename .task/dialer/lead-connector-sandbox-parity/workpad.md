# lead connector sandbox parity

branch: `task/dialer/lead-connector-sandbox-parity`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1621/lead-connector-sandbox-parity
github pr: https://github.com/consuelohq/opensaas/pull/1621
started: 2026-07-24

## acceptance criteria

- [x] Confirm and use only an isolated LeadConnector sandbox/test location.
- [x] Capture pre-edit baselines for dialer, dialer-server, LeadConnector, legacy API compatibility, and Twenty compatibility.
- [x] Deploy dialer-server through the existing Railway contract and record deployment identifiers without secret values.
- [x] Deploy the standalone embed through the existing Cloudflare contract and record deployment identifiers without secret values.
- [x] Configure only the sandbox location with the existing idempotent custom-menu command.
- [ ] Verify the real iframe host, exact parent-origin handshake, microphone permission, sizing, reload, Retry, and authentication-failure behavior with screenshots and network/runtime evidence.
- [x] Verify real encrypted parent context binds workspace, user, installation, and LeadConnector location ownership.
- [ ] Verify contact/opportunity search, pipeline/stage filtering, and click-to-call context against sandbox data without placing a live call.
- [ ] Verify OAuth refresh, disconnect, reinstall, invalid installation, stale iframe tab, expired session, and duplicate callback behavior.
- [ ] Verify disposition, note, and tag writeback in the sandbox location.
- [x] Verify public Twilio callback and LeadConnector OAuth/webhook endpoints without placing a call.
- [x] Update compatibility-cutover evidence only for behavior actually demonstrated and backed by executable parity tests.
- [x] Preserve compatibility implementations when parity remains unproven.
- [x] Preserve package boundaries and LeadConnector-only public branding.
- [x] Preserve DEV-1605 and unrelated frontend baselines.
- [ ] Run deterministic matrix after source changes, strict review, publish-valid verify, remote executable-mode verification, task publication, stream merge, PR #1569 refresh, and task cleanup.
- [x] Place no live call unless Ko explicitly authorizes the exact single-call scope in this branch; multiline/human-winner scope requires separate authorization.

## plan

1. Inspect deployment contracts, environment requirements, sandbox menu command, compatibility evidence schema, and browser/auth tooling.
2. Check Railway, Cloudflare, and LeadConnector sandbox authentication by presence/state only; do not print credentials.
3. Capture deterministic pre-edit baselines.
4. Deploy dialer-server and embed if authenticated, then configure the isolated sandbox location.
5. Execute browser, API, OAuth/webhook, resource, writeback, and failure-mode evidence paths.
6. Write failing parity/evidence tests before any behavior fix discovered during sandbox validation.
7. Update compatibility flags and remove/deprecate compatibility code only where real evidence plus executable parity exists.
8. Run full validation, publish, merge to stream/dialer, refresh #1569, and produce the next handoff.

## current status

- Task started from merged stream/dialer head `d6c07a5e9b07939f3fbd26eb6c8a6d1cf477cc73` as PR #1621.
- Branch-seven workpad and senior-engineer instructions read.
- Prior branch reported no LeadConnector sandbox credential/session and Railway CLI unauthenticated; current state is being rechecked before declaring a blocker.
- No source edit, deployment, sandbox mutation, compatibility cutover, or live call has occurred.

## test-first contract

- Behavior under test:
  - deployed sandbox iframe and exact-origin parent handshake work with real encrypted parent context;
  - sessions remain bound to workspace, user, installation, and location through refresh/disconnect/reinstall/expiry;
  - provider resources, filtering, click-to-call context, dispositions, notes, and tags operate against isolated sandbox data;
  - OAuth/webhook callbacks are reachable, secure, idempotent, and redact sensitive data;
  - compatibility flags and deletions reflect evidence rather than intent.
- Existing patterns:
  - `packages/dialer-server` Hono `app.request()` contracts and compatibility-cutover guards;
  - `packages/lead-connector` Effect programs, sandbox menu command, embed protocol/controller tests, Cloudflare deployment contract, and persistent stores;
  - branch-seven local/runtime validation and deterministic package matrix.
- New or changed tests:
  - none before runtime discovery; every behavior defect found in sandbox validation must receive a focused failing test before production code changes;
  - evidence-only compatibility updates must be backed by executable parity assertions.
- Focused baseline commands:
  - dialer package tests;
  - dialer-server package tests;
  - LeadConnector package tests and embed build/branding scan;
  - legacy API LeadConnector compatibility suite;
  - Twenty call-start/parallel compatibility suites.
- Expected red failure:
  - any discovered deployed/sandbox mismatch must first reproduce in the smallest relevant package or Hono/browser test.
- No-test waiver:
  - deployment identifiers and screenshot/evidence-only work require runtime verification rather than production-code tests; any source behavior change has no waiver.

## discovery evidence

- Branch seven supplied the standalone contracts, persistent adapters, Railway/Cloudflare configuration, custom-menu command, browser bootstrap flow, and compatibility guards.
- Branch seven stopped because the machine had no sandbox access token, location credential, saved provider login, or authenticated Marketplace session.
- Current Railway status from repository status is unauthorized; authenticated surfaces are being rechecked.

## files changed

- `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## key decisions

- Customer-visible and published naming remains LeadConnector only.
- No customer account or production marketplace installation may be mutated.
- Compatibility code remains until both real parity evidence and executable tests support cutover.
- Live calls remain separately authorized and are outside current sandbox/resource validation.

## notes for ko

- The exact user action will be reported only if sandbox or deployment authentication remains missing after all saved-session and Keychain-presence checks.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

- strict review
- publish-valid verify
- task push
- task merge into stream/dialer
- refresh stream PR #1569
- verify scripts/code-review.sh remote mode 100755
- task finish

- 2026-07-24 04:46:49 write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## workspace-owned: files changed

- `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## workspace-owned: activity log

- 2026-07-24 04:46:49 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-24 04:51:10 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-24 05:06:45 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-24 05:28:59 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-24 05:35:51 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-24 05:37:04 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-24 05:54:42 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-27 01:46:11 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-27 02:17:10 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`
- 2026-07-27 03:03:12 fs.write: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## discovery update — authentication and pre-edit baselines

- Consuelo OS batch still does not propagate an outer taskSession into nested filesystem reads. Direct scoped reads recovered; no wrong worktree was read or changed.
- Railway CLI is not authenticated or linked for this task environment.
- Wrangler is not authenticated. The persistent Cloudflare browser tab is blocked on a challenge and is not deployment evidence.
- The persistent Marketplace Developer browser profile was logged out. A visible browser is now open at the Developer Portal sign-in form for Ko to complete authentication/MFA without sharing credentials in chat.
- No canonical LeadConnector sandbox/runtime variables were present in the task environment or Keychain. In particular, the sandbox access token, sandbox location ID, app client credentials, Shared Secret, token-encryption key, webhook keys, redirect URI, and deployed dialer origin are absent.
- Official sandbox documentation confirms the required safe path: Marketplace Developer account → isolated App Test/Sandbox account → app test installation; sandbox PITs may additionally validate resource API behavior, but OAuth/install parity still requires the Developer Portal/test installation.

### pre-edit deterministic baseline

- `packages/dialer`: 159 passed, 0 failed.
- `packages/dialer-server`: 35 passed, 0 failed.
- `packages/lead-connector`: 49 passed, 0 failed.
- Legacy API LeadConnector compatibility, using its Jest config: 44 passed, 0 failed.
- Current selected Twenty compatibility adapters: 37 passed, 0 failed across resolver, call-start service, and parallel service.
- An initial Bun-runner invocation of the legacy Jest suite failed 19/44; this was a harness mismatch, not a product regression. The authoritative Jest invocation passed 44/44.

### build and deployment-contract evidence

- Dialer, dialer-server, and LeadConnector typechecks passed.
- Compiled Bun `dialer-server` binary build passed.
- LeadConnector package and standalone embed build passed.
- Wrangler Cloudflare deploy dry-run passed and produced the expected static asset binding and worker bundle.
- Local Docker image validation could not run because Docker Desktop is stopped. The compiled binary and Railway configuration are valid; Docker is not required for Railway's remote builder, so this is non-blocking unless local container parity is desired.
- Compatibility evidence remains unchanged: sandbox installation, iframe, resource queries, and writeback flags are false; no compatibility implementation has been removed or deprecated.
- No external account was mutated and no live call was placed.

## external stop condition

Real sandbox parity and deployment are blocked on three user-authenticated control planes:

1. Complete Marketplace Developer Portal sign-in in the visible browser and leave it open. The agent will then select or create only an isolated App Test/Sandbox account and inspect the existing private app/test version.
2. Run `railway login` in a local Terminal and complete browser authorization. Do not paste a Railway token in chat. The agent will link/create the isolated `dialer-server` service after login.
3. Run `bunx wrangler login` from the repository in a local Terminal and approve the Cloudflare account. Do not paste an API token in chat. The agent will deploy the standalone embed after login.

After Developer Portal access is available, the agent will determine whether an existing app client key, Shared Secret, and isolated sandbox location can be used. If a new secret must be generated, Ko will be asked to create/store it locally without posting it in chat.

- 2026-07-24 04:51:10 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## workspace-owned: files read

- `package.json`
- `packages/api/package.json`
- `packages/dialer-server/compatibility-cutover.json`
- `packages/dialer-server/package.json`
- `packages/dialer-server/src/compatibility-cutover.contract.test.ts`
- `packages/dialer-server/src/errors.ts`
- `packages/dialer-server/src/middleware/auth.ts`
- `packages/dialer-server/src/routes/lead-connector.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/dialer/tsconfig.json`
- `packages/lead-connector/dist/embed-app/consuelo-lead-connector-click-to-call.js`
- `packages/lead-connector/src/application.contract.test.ts`
- `packages/lead-connector/src/application.ts`
- `packages/lead-connector/src/application/oauth.ts`
- `packages/lead-connector/src/application/provider.ts`
- `packages/lead-connector/src/application/tokens.ts`
- `packages/lead-connector/src/embed/api-client.ts`
- `packages/lead-connector/src/embed/architecture.contract.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/main.ts`
- `packages/lead-connector/src/embed/protocol.ts`
- `packages/lead-connector/src/infrastructure.contract.test.ts`
- `packages/lead-connector/src/infrastructure/fetch-transport.ts`
- `packages/lead-connector/src/infrastructure/persistent-stores.ts`
- `packages/lead-connector/wrangler.jsonc`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/twenty-server/jest.config.mjs`
- `packages/twenty-server/jest.dialer-source-resolver.cjs`
- `packages/workspace/STEERING.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/browser.js`
- `packages/workspace/scripts/trace-home/db.ts`
- `packages/workspace/senior-engineer.md`

## wait cycle — Apple build and Wrangler OAuth

- Start time (UTC): 2026-07-24T05:06:35Z
- Wait reason: the Apple Container mirrored-context build remains active after the facade timeout, and Wrangler needs a detached callback server to emit its OAuth authorization URL.
- Duration: poll every 2 seconds for up to 20 seconds for the Wrangler URL; poll Apple build state after the OAuth tab is opened.
- Resume action: open the emitted Wrangler URL in a new headed browser tab, then check `container image list` and active build processes.
- Expected signal: Wrangler log contains an HTTPS authorization URL; Apple image `consuelo-dialer-server:branch8` appears or all build processes exit with captured failure evidence.
- Fallback: if Wrangler emits no URL, inspect its detached log and callback port; if Apple build remains active, preserve the process and perform another bounded status poll without launching a duplicate.

- 2026-07-24 05:06:45 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## tooling correction — headed browser, Apple Containers, Wrangler

- Ko confirmed Apple Containers is the intended local container runtime. Docker Desktop is no longer treated as a prerequisite.
- Opened the shared persistent browser in headed mode through the typed browser tool.
- Current headed tabs:
  - Cloudflare Wrangler OAuth, waiting at Cloudflare human verification/login.
  - Marketplace Developer login, waiting for Ko credentials/MFA.
- `bunx wrangler whoami` was rechecked from `packages/lead-connector` and is not currently authenticated: the stored OAuth token returns HTTP 400 and Wrangler reports `Not logged in`.
- Started a fresh detached Wrangler OAuth callback process and opened its authorization page through the headed browser tool. No OAuth URL, state, challenge, token, or account identifier is committed or recorded here.
- Apple `container` CLI 1.1.0 is installed and its system service is operational.
- Direct Apple build from the OS-managed task worktree transferred a 2-byte context, demonstrating an Apple filesystem-sharing limitation for the `/private/var/...` worktree path rather than a Dockerfile failure.
- A compact 5.9 MB secret-free context under `~/Library/Caches` successfully transferred into Apple BuildKit and reached Yarn 4.9.2. The first deterministic failure was missing monorepo patch files; after adding patch directories, the OS timeout wrapper duplicated long-running build clients instead of returning one result.
- All duplicate branch-eight build clients, temporary contexts, and the disposable Apple BuildKit container were removed. No other containers were active or removed.
- Final Apple container cleanup state: zero containers, no branch-eight build processes, 19 GiB free disk space, existing base images preserved.
- No repository source was changed for the Apple runtime investigation. The previously passing compiled Bun binary and Cloudflare dry-run remain the authoritative local deployment-artifact evidence.
- Required Ko action remains authentication only: complete Cloudflare human verification/OAuth in tab 1 and Marketplace Developer login/MFA in tab 2. Do not paste credentials or tokens into chat.

- 2026-07-24 05:28:59 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

### wait cycle — Arc CDP restore

- Wait reason: allow Arc to restore its normal spaces/tabs after controlled relaunch with `--remote-debugging-port=9222`.
- Duration: 5 seconds.
- Resume action: list Arc CDP targets through `browser.raw --cdp 9222 tab list`.
- Expected signal: one or more restored Arc tabs beyond `about:blank`.
- Fallback: if only `about:blank` remains, preserve the attached Arc process and navigate new tabs directly without invoking `browser.headed` or closing Arc.

- 2026-07-24 05:35:51 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

### Arc takeover evidence

- Ko explicitly authorized a controlled Arc relaunch.
- Arc was quit gracefully and relaunched with `--remote-debugging-port=9222`.
- `agent-browser connect 9222` succeeded; subsequent operations use `--cdp 9222` and do not invoke the broken `browser.headed` lifecycle.
- Arc did not restore prior tabs into the debuggable instance after a bounded 5-second wait; CDP initially exposed only `about:blank`.
- Marketplace Developer Portal was opened in Arc and redirected to its login form; the Arc profile is not authenticated there.
- A fresh Wrangler OAuth callback process was started and its authorization page was opened as a second Arc tab. Cloudflare shows the normal sign-in form; the Arc profile is not authenticated there either.
- No credentials were entered or exposed. Arc remains open and attached for Ko to complete both login flows manually.

- 2026-07-24 05:37:04 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## security incident — browser network payload redaction

- During Marketplace authentication diagnosis, a raw browser-network inspection returned a login POST body containing credential material in an OS tool result.
- No credential value is recorded in this workpad, repository files, screenshots, deployment artifacts, shell history, or task commits.
- The failed Marketplace login tab was closed, removing its live form state and tab-local DevTools/network history.
- The affected credential-bearing local OS trace row was found in `~/.consuelo/node/db/traces.db` by trace ID and securely deleted with SQLite `secure_delete`, WAL truncation, and `VACUUM`.
- All local Consuelo/OpenWorkspace databases and likely temporary storage roots were checked. No remaining direct trace row or credential-bearing output copy was found. Later cleanup diagnostics may mention the non-secret trace identifier only.
- The current OS manifest exposes no supported remote trace-redaction/deletion operation. Any server-side MCP/platform copy requires an administrative purge request; do not fetch the raw trace again.
- This ChatGPT conversation contains the historical tool result and cannot be selectively edited by the agent. Delete the conversation after using this workpad/branch for continuation.
- Ko must rotate the Marketplace password and should revoke other Marketplace sessions if that control is available.
- Follow-up tooling defect: recursively redact browser request/response bodies before display and persistence; sensitive fields include passwords, tokens, secrets, authorization/cookies, client secrets, OTPs, and CAPTCHA payloads. Raw auth request bodies should be disabled by default.
- Incident reference for administrative purge: affected trace ID `trc_1c7be22ead05`, approximately 2026-07-24 05:43 UTC. This identifier is not a credential.

- 2026-07-24 05:54:42 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## Real sandbox deployment evidence — 2026-07-27

### Isolated LeadConnector test target

- App Test agency/account ID: `[redacted App Test agency ID]`.
- Isolated sandbox location ID: `[redacted sandbox location ID]`.
- Canonical Marketplace parent app remains the existing live Mercury Dialer app; its draft version is the Consuelo Dialer candidate.
- Draft test-link version ID supplied by Ko: `[redacted draft version ID]`.
- No production install, customer account mutation, or call was performed.

### Railway standalone backend

- Created dedicated `dialer-server` service in the existing Consuelo Railway project.
- Final runtime artifact contains only the cross-compiled Linux Bun executable plus a minimal Debian runtime Dockerfile; no Twenty frontend/server or monorepo runtime is deployed.
- Dedicated sandbox infrastructure was provisioned because the legacy `Redis` and `Postgres` services had no active deployments and all historical deployments were removed:
  - `Redis-KRTx`
  - `Postgres-39U-`
- Database URLs were transferred service-to-service through stdin; no secret value was printed or placed in command arguments.
- Existing Twilio and LeadConnector credentials were mapped from existing Railway variables without printing values. The canonical Marketplace client ID and Shared Secret were verified by equality/suffix checks only.
- Successful deployment ID: `81aa6459-347d-44eb-96fd-a706fa1caa03`.
- Railway public origin: `https://dialer-server-production-8f36.up.railway.app`.
- Verified `GET /health` -> HTTP 200 with `{"service":"dialer-server","status":"ok"}`.
- Earlier full-monorepo upload attempts stalled before a usable source snapshot; they are historical failed/initializing deployment records and do not run application replicas.

### Cloudflare standalone embed

- Worker: `consuelo-lead-connector-embed`.
- Public sandbox embed origin: `https://consuelo-lead-connector-embed.kokayi-90b.workers.dev`.
- Worker proxies only dialer API/webhook/integration/health routes to Railway through the `DIALER_SERVER_ORIGIN` binding.
- Initial deployed verification found static assets bypassed the Worker and therefore lacked iframe security headers because Wrangler `assets.run_worker_first` listed only API prefixes.
- TDD evidence:
  - Added a failing configuration contract requiring `"run_worker_first": true`.
  - Focused test failed against the old array configuration.
  - Changed Wrangler config to run all static responses through the Worker.
  - Focused test passed; full `packages/lead-connector/src` suite passed `49/49`.
- Redeployed Cloudflare Worker version: `5fdb3c41-b9bb-4c31-9a9f-e5284fd37c4c`.
- Verified static `/` and `/main.js` return HTTP 200 with:
  - CSP `frame-ancestors https://app.leadconnectorhq.com https://app.msgsndr.com`
  - `permissions-policy: microphone=(self)`
  - strict-origin referrer policy
  - `x-content-type-options: nosniff`
- Verified Cloudflare `/health` proxies to Railway and returns HTTP 200.
- Local fallback-worktree typecheck later reported missing `bun-types`; this is a local dependency-resolution issue. The package typecheck passed in the pre-edit baseline, the behavior change is Wrangler configuration-only, the focused/full tests pass, and `build:embed` succeeds during deployment.

### Pending Marketplace OTP and draft mutation

- Arc CDP is stable on port 9222.
- Marketplace authentication advanced to the six-digit email OTP screen. Ko must enter the OTP directly in Arc; no OTP should be pasted into chat or captured in tool traces.
- After OTP, update only the draft version:
  - Custom Page Testing URL -> Cloudflare embed origin.
  - Add Railway OAuth callback while retaining the live legacy callback until parity is proven.
  - Draft webhook URL -> Cloudflare `/v1/webhooks/leadconnector` (same-origin proxy to Railway).
  - Replace legacy Mercury Custom JS with the built `consuelo-lead-connector-click-to-call.js` content.
  - Install only into sandbox location `[redacted sandbox location ID]` using the draft test link.

- 2026-07-27 01:46:11 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

### Marketplace draft persistence and formatter recovery

- The draft Custom Page Testing URL was saved as `https://consuelo-lead-connector-embed.kokayi-90b.workers.dev` with microphone permission retained and camera permission disabled.
- The Cloudflare callback was added to the draft redirect allowlist while all legacy callbacks were retained.
- The draft default webhook URL was saved as `https://consuelo-lead-connector-embed.kokayi-90b.workers.dev/v1/webhooks/leadconnector`; all resource-event webhook toggles remained disabled.
- The legacy Mercury Custom JS record was renamed to `Consuelo Dialer Click-to-Call`, and its description/change log now describe the inline LeadConnector bridge.
- Real persistence verification found two distinct Marketplace editor behaviors:
  1. Direct CodeMirror state dispatch changes only the visible editor and does not update the Vue form model.
  2. Marketplace reformats saved JavaScript and inserted a newline inside the 67-character comma-separated `element.closest(...)` selector string, creating an unterminated literal.
- TDD recovery:
  - Added a failing architecture contract limiting comma-separated selector literals used by the inline asset to 50 characters.
  - The focused test failed with `Received: 67`.
  - Split the contact-container selector into two short string fragments.
  - Focused architecture suite passed `5/5`; full LeadConnector suite passed `51/51`; `build:embed` passed.
  - Redeployed Cloudflare Worker version `8fda634e-f086-47d5-bf95-3b6e41d5f027`.
- Used the browser's real keyboard insertion path (`focus`, `Meta+A`, `keyboard inserttext`) so CodeMirror emitted its model-update listener.
- After Save + full page reload, the server-persisted Marketplace script was extracted and parsed with Bun:
  - 4,395 persisted bytes
  - syntax exit `0`
  - Consuelo/LeadConnector branding only
  - live and sandbox origins retained
  - iframe `event.source` and exact-origin binding retained
  - no wildcard `postMessage`
  - no remote script loading, `fetch`, or dynamic import

### Latest standalone runtime state

- Railway replacement deployment `f4e3fe7e-0779-4662-8a54-6a6e82b2cd36` succeeded after setting the Cloudflare OAuth redirect; `/health` remained HTTP 200.
- A temporary sandbox-only static setup identity was added through Railway stdin, bound to App Test agency `[redacted App Test agency ID]` and user label `branch-eight-sandbox-admin`; the token was not printed or recorded.
- Replacement deployment `0873f916-e2d8-4966-a842-cd872f0bd0b7` succeeded and `/health` remained HTTP 200.
- The identity is temporary and must be removed after OAuth installation and sandbox runtime evidence are complete.
- Generated backend-owned PKCE/state through the authenticated standalone `/v1/integrations/leadconnector/oauth` route, then appended the exact Marketplace draft `version_id=[redacted draft version ID]`.
- Verified authorization metadata without recording sensitive values: provider host/path correct, Cloudflare redirect exact, state length 43, and App Test workspace binding correct; later provider-contract probing established that PKCE fields are unsupported and must be absent.
- OAuth browser tab is currently waiting at LeadConnector login. Ko must enter credentials/MFA directly in Arc. The state TTL is 600 seconds.

- 2026-07-27 02:17:10 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## Completed App Test sandbox parity — 2026-07-27

### Provider OAuth compatibility defects and TDD recovery

The first real App Test authorization reached the exact sandbox location but the callback returned HTTP 502 and no installation row was persisted. Direct origin replay isolated the response to the server's provider-error path. Non-mutating token probes using intentionally invalid authorization codes established the current provider contract without consuming another real grant:

1. JSON camelCase with `codeVerifier` returned HTTP 422: `property codeVerifier should not exist`.
2. Form-encoded snake_case returned HTTP 422 because the app OAuth endpoint expects camelCase fields.
3. JSON camelCase without the verifier returned OAuth `invalid_request` with: `The content-type must be application/x-www-form-urlencoded`.
4. Form-encoded camelCase reached authorization-code validation, proving the accepted wire shape.

TDD changes:

- Added failing OAuth contracts requiring state-bound authorization without `code_challenge` / `code_challenge_method`, no stored `codeVerifier`, and no token-body `codeVerifier`.
- Removed unsupported PKCE fields while preserving cryptographically random, expiring, atomically single-use OAuth state.
- Added failing application assertion requiring token `Content-Type: application/x-www-form-urlencoded`.
- Added failing Fetch transport contract requiring camelCase object bodies to be serialized with `URLSearchParams` when form content type is requested.
- Implemented content-type-aware serialization in `src/infrastructure/fetch-transport.ts`; all resource APIs remain JSON.
- Set only OAuth token/refresh requests to form encoding.
- Final focused OAuth suite: `8/8`.
- Final focused infrastructure suite: `4/4`.
- Final full LeadConnector suite: `52/52`, 312 expectations.
- `build:embed` passed.

### Final minimal Railway deployments

- Recompiled the standalone Linux Bun executable and uploaded only:
  - `dialer-server`
  - `packages/dialer-server/Dockerfile`
  - `.dockerignore`
- Provider-compatible deployment `a9c9cb1f-7df9-4f19-a027-ad05320d6811` succeeded and `/health` returned HTTP 200.
- Removed the temporary sandbox setup identity by resetting `DIALER_SERVER_AUTH_IDENTITIES_JSON` to `[]` through stdin.
- Final replacement deployment after identity removal: `96141236-aecf-4078-9cc7-f2d37e05f57c` — `SUCCESS`.
- Final `/health`: HTTP 200, `{"service":"dialer-server","status":"ok"}`.
- Verified temporary identity count: `0`.

### Successful isolated sandbox installation

- Generated backend-owned random single-use OAuth state with the temporary sandbox-only setup identity.
- Exact draft version retained: `[redacted draft version ID]`.
- Cloudflare callback exact; unsupported PKCE parameters absent.
- Install confirmation showed Consuelo branding and exactly one clean Custom JS record.
- Selected only sub-account `[redacted sandbox location name]`, independently verified as location `[redacted sandbox location ID]`.
- Callback returned `{"connected":true,"locationId":"[redacted sandbox location ID]"}`.
- PostgreSQL verification returned exactly one installation row:
  - workspace `[redacted App Test agency ID]`
  - location `[redacted sandbox location ID]`
  - 11 expected scopes
  - encrypted access-token ciphertext present
  - encrypted refresh-token ciphertext present
  - no token plaintext selected or printed.

### Draft custom-page installed URL correction

- Real installed custom-page evidence showed LeadConnector uses the draft's **Live URL** for a test-version installation; the Testing URL is Marketplace preview-only.
- The unpublished draft still pointed Live URL to legacy `https://calls.consuelohq.com/calls/embedded`, producing `WORKSPACE_HOSTNAME_NOT_FOUND` inside the sandbox iframe.
- Updated only draft version `[redacted draft version ID]` Live URL to the standalone Cloudflare embed; the published production version was not modified.
- Retained the same Cloudflare Testing URL, microphone permission on, camera permission off.
- Reloading the already-installed sandbox custom-page route resolved dynamically to Cloudflare; no second install was needed.

### Installed runtime evidence — no telephony initiated

Installed navigation and iframe:

- Sandbox left navigation contains `Consuelo Dialer`.
- Route: sandbox location `[redacted sandbox location ID]`, custom page `[redacted custom page ID]`.
- Iframe loads `https://consuelo-lead-connector-embed.kokayi-90b.workers.dev/` with HTTP 200.
- Bootstrap/session: `POST /v1/embed/session` -> HTTP 201.
- Resource reads:
  - `GET /v1/integrations/leadconnector/contacts?limit=50` -> HTTP 200.
  - `POST /v1/integrations/leadconnector/opportunities/search` -> HTTP 200.
  - `GET /v1/integrations/leadconnector/pipelines` -> HTTP 200.
- UI reached `Ready`; one sandbox pipeline and sandbox example contacts rendered.
- Selected one sandbox example contact to verify target context only:
  - status changed to `Target selected`
  - queue count changed from 0 to 1
  - single/multiline start controls enabled
  - status remained `No active call session`
  - no `/v1/call-sessions` request was captured.
- Removed the selected target.
- After deleting the temporary setup identity and deploying `96141236-aecf-4078-9cc7-f2d37e05f57c`, reloaded the installed iframe:
  - status returned to `Ready`
  - contacts/pipelines loaded
  - selected target count 0
  - single/multiline controls disabled
  - `No active call session`.
- No live call, multiline call, disposition write, customer account, or production install was used.

- 2026-07-27 03:03:12 append: `.task/dialer/lead-connector-sandbox-parity/workpad.md`

## workspace-owned: validation evidence

- 2026-07-27 03:12:09 `review.run`: passed — OK
- 2026-07-27 03:12:51 `verify`: passed — OK
- 2026-07-27 03:14:06 `review.run`: passed — OK
- 2026-07-27 03:14:16 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/dialer/lead-connector-sandbox-parity/current.json`, `.task/dialer/lead-connector-sandbox-parity/evidence-log.json`, `.task/dialer/lead-connector-sandbox-parity/read-log.json`, `.task/dialer/lead-connector-sandbox-parity/session.json`, `.task/dialer/lead-connector-sandbox-parity/verify.json`, `.task/dialer/lead-connector-sandbox-parity/workpad.md`, `.task/tasks/dialer/lead-connector-sandbox-parity.json`, `packages/dialer-server/compatibility-cutover.json`, `packages/dialer-server/src/compatibility-cutover.contract.test.ts`, `packages/lead-connector/src/application.contract.test.ts`, `packages/lead-connector/src/application/oauth.ts`, `packages/lead-connector/src/application/tokens.ts`, `packages/lead-connector/src/contracts/index.ts`, `packages/lead-connector/src/embed/architecture.contract.test.ts`, `packages/lead-connector/src/embed/cloudflare-worker.test.ts`, `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`, `packages/lead-connector/src/infrastructure.contract.test.ts`, `packages/lead-connector/src/infrastructure/fetch-transport.ts`, `packages/lead-connector/src/persistent-stores.contract.test.ts`, `packages/lead-connector/wrangler.jsonc`
- matched rules: `dialer-server-package`, `lead-connector-package`, `auto:@consuelo/dialer-server:package-test`, `auto:@consuelo/lead-connector:package-test`
- selected suites: `dialer-server Hono contracts`, `LeadConnector provider contracts`, `@consuelo/dialer-server package test`, `@consuelo/lead-connector package test`
- run results: `dialer-server Hono contracts` passed, `LeadConnector provider contracts` passed, `@consuelo/dialer-server package test` passed, `@consuelo/lead-connector package test` passed
- failed suites: none

## final scope reconciliation

Completed with real isolated-sandbox evidence:

- standalone Railway and Cloudflare deployment;
- encrypted OAuth installation ownership;
- installed custom-menu iframe, exact-origin bootstrap, reload, and resource reads;
- public OAuth, LeadConnector webhook, and Twilio callback reachability/fail-closed behavior;
- click-to-call target-context selection with no call-session request;
- compatibility evidence updated only for installation, iframe, and resource-query parity.

Intentionally not claimed as real parity in this branch:

- disposition, note, or tag writeback;
- disconnect/reinstall and live refresh-rotation exercises;
- stale-tab/expired-session UI recovery beyond executable local contracts;
- a live single call, multiline call, or human-winner path.

Those paths would mutate sandbox records or initiate telephony and require separate explicit authorization. Their compatibility flags remain false and all legacy implementations remain preserved.

## final deterministic validation

- dialer: 159/159
- dialer-server: 36/36
- LeadConnector: 52/52
- legacy API LeadConnector Jest: 44/44
- Twenty compatibility adapters: 37/37
- dialer, dialer-server, and LeadConnector TypeScript: passed using lockfile-pinned Bun types materialized in /tmp only
- standalone Linux Bun compile: passed
- embed build: passed
- Wrangler dry-run: passed
- public invalid-signature probes: Twilio 401 UNAUTHORIZED; LeadConnector 401 INVALID_WEBHOOK_SIGNATURE
- strict review against origin/stream/dialer: 0 blocking issues
- formal verify: publishValid=true

