# lead-connector-e2e-cutover

branch: `task/dialer/lead-connector-e2e-cutover`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1612/lead-connector-e2e-cutover
github pr: https://github.com/consuelohq/opensaas/pull/1612
started: 2026-07-24

## acceptance criteria

- [ ] Exchange LeadConnector encrypted parent user context for a short-lived Consuelo embed session without exposing shared secrets, OAuth tokens, encryption keys, telephony credentials, or server secrets to the browser.
- [ ] Bind every bootstrap exchange and embed session to workspace, Consuelo user, LeadConnector installation, and LeadConnector location; reject cross-location, disconnected, stale, expired, and reinstalled identities.
- [ ] Supply production runtime composition for encrypted installation persistence, OAuth state, webhook idempotency, provider resources, notes, tags, dispositions, and token refresh.
- [ ] Define deployment contracts for static embed assets, dialer-server, Twilio callbacks, LeadConnector OAuth callbacks, and LeadConnector webhooks.
- [ ] Prove custom-menu iframe mode, microphone permission, real-host origin allowlist, versioned parent handshake, sizing, reload, expiry, reconnection, and authentication failure behavior.
- [ ] Prove click-to-call plus contacts, opportunities, pipelines, and stages against sandbox-safe fixtures and the authenticated sandbox when credentials are available.
- [ ] Prove single and multiline controls through dialer-server with backend-authoritative ringing, connected, completed, winner, and losing-leg state.
- [ ] Prove stop, hang-up, retry, pause, resume, disposition, note, tag writeback, OAuth refresh, disconnect, reinstall, duplicate callbacks, stale tabs, expired sessions, and repeated click-to-call delivery.
- [ ] Preserve packages/dialer as telephony/lifecycle authority; keep Hono and browser code free of provider mapping and dialer lifecycle decisions.
- [ ] Remove or deprecate packages/api and Twenty compatibility code only where equivalent tested standalone behavior exists.
- [ ] Maintain LeadConnector-only public branding in source and built assets; preserve exact provider-owned wire fields only at protocol boundaries.
- [ ] Keep packages/dialer, packages/dialer-server, packages/lead-connector, remaining packages/api compatibility, and temporary Twenty compatibility contracts green.
- [ ] Run strict review, publish-valid verify, remote executable-mode verification for scripts/code-review.sh, task publication, stream promotion, and stream PR #1569 refresh.
- [ ] Do not mutate a customer account, perform a marketplace production install, or place a live call without Ko's explicit authorization in this branch.

## plan

1. Capture pre-edit baselines and inventory branch-six contracts, runtime seams, persistence gaps, compatibility code, build assets, and deployment surfaces.
2. Add red contracts for encrypted user-context bootstrap, installation/location ownership, session scope, persistent runtime composition, sandbox parent protocol, reload/expiry/reconnect, provider resources, writeback, lifecycle projection, duplicate delivery, branding, and compatibility deletion guards.
3. Implement the production bootstrap exchange and scoped session claims, then add persistent infrastructure adapters and deployment composition while keeping Hono handlers thin.
4. Extend the standalone embed and parent protocol for the real platform user-context request/response flow, configurable explicit origins, stale-tab handling, and reconnect behavior.
5. Validate deterministic unit/contracts, Hono app.request integration, local Postgres/Redis runtime, provider test credentials, and authenticated sandbox/browser behavior where the available account permits it.
6. Perform compatibility cutover only for paths with demonstrated parity; preserve documented shims for any unproven path.
7. Self-review, verify, publish PR #1612, merge into stream/dialer, refresh stream PR #1569, and produce the next-branch handoff.

## current status

- Task started from fresh stream/dialer merge `89dc822fb4` as PR #1612.
- Required senior-engineer instructions and branch-six workpad are read.
- Production bootstrap mechanism selected from official LeadConnector custom-page user-context behavior.
- No production source edit or external account mutation has occurred.

## test-first contract

- Behavior under test:
  - encrypted parent user context is accepted only after server-side decryption and active installation/location/user/workspace ownership verification;
  - issued sessions contain installationId and locationId in addition to workspaceId/userId and enforce expiry/reinstall invalidation;
  - browser requests platform user data through the versioned parent protocol and never handles shared secrets or provider OAuth credentials;
  - runtime adapters persist OAuth state, encrypted installation tokens, webhook claims, refresh state, and resource/writeback operations;
  - iframe reload, stale tab, session expiry, repeated messages, and duplicate callbacks remain deterministic;
  - all call state is projected from dialer-server and all provider/dialer lifecycle decisions remain outside Hono/browser code;
  - compatibility deletion is guarded by parity tests and public source/build branding scans.
- Existing patterns:
  - `packages/lead-connector` Effect programs, ports, typed failures, WebCrypto cipher, deterministic in-memory layers, and provider mappings;
  - `packages/dialer-server` Hono `app.request()` tests, signed embed-session service, runtime composition seam, and thin resource/call routes;
  - `packages/lead-connector/src/embed` protocol/controller/state-machine/API-client tests and production Bun browser build;
  - packages/dialer lifecycle contract tests and temporary packages/api/Twenty compatibility suites.
- New or changed tests:
  - server bootstrap exchange and scoped session tests;
  - LeadConnector user-context decryption/validation and installation ownership tests;
  - persistent runtime adapter and reinstall/refresh tests;
  - real-host parent protocol, reload/expiry/reconnect/stale-tab/repeated click-to-call tests;
  - Hono resource/writeback/call-session E2E contracts and duplicate callback tests;
  - static/built branding and compatibility deletion guards.
- Focused red commands:
  - `bun test packages/dialer-server/src/runtime packages/dialer-server/src/embed-boundary.test.ts packages/dialer-server/src/lead-connector-boundary.test.ts`;
  - `bun test packages/lead-connector/src/application.contract.test.ts packages/lead-connector/src/infrastructure.contract.test.ts packages/lead-connector/src/embed`.
- Expected red failures:
  - no encrypted platform user-context decoder/exchange exists;
  - embed session claims omit installationId/locationId and cannot detect reinstall;
  - runtime lacks persistent installation/OAuth/webhook stores;
  - parent protocol expects a Consuelo-specific bootstrap token instead of requesting platform user context;
  - compatibility deletion guards and production deployment contract are absent.
- No-test waiver: none.

## key decisions

- Initial opaque credential mechanism: the iframe requests LeadConnector encrypted user context from the parent window, posts that opaque ciphertext to dialer-server, and receives a Consuelo session only after server-side decryption and ownership validation.
- The LeadConnector Shared Secret, OAuth tokens, token encryption key, Twilio credentials, and server session secret remain server-only.
- Final marketplace public/private distribution is outside this branch; sandbox test-link installation provides the required E2E path without a production marketplace install.
- Existing compatibility implementations remain until standalone parity is proven by executable tests or sandbox evidence.

## discovery evidence

- Branch-six signed sessions currently contain only workspaceId/userId and assume a pre-authenticated Consuelo bearer credential.
- Branch-six parent protocol currently expects `bootstrapToken`; it does not implement the platform `REQUEST_USER_DATA` flow.
- Standalone embed, resource routes, call-session routes, browser state machine, and LeadConnector package seams already exist.
- Official custom-page behavior supports iframe mode, microphone permission, signed/encrypted user context, sandbox test links, and server-side decryption using the app Shared Secret.
- Semantic retrieval surfaced stale legacy packages/api provider code; direct task-scoped reads are the source of truth for branch-seven edits.

## files changed

- `packages/dialer-server/compatibility-cutover.json`
- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/project.json`
- `packages/dialer-server/railway.json`
- `packages/dialer-server/README.md`
- `packages/dialer-server/scripts/validate-provider-test.ts`
- `packages/dialer-server/src/compatibility-cutover.contract.test.ts`
- `packages/dialer-server/src/embed-bootstrap.contract.test.ts`
- `packages/dialer-server/src/lead-connector-application.ts`
- `packages/dialer-server/src/runtime/embed-session.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`
- `packages/lead-connector/README.md`
- `packages/lead-connector/scripts/configure-sandbox-menu.ts`
- `packages/lead-connector/src/application/embed-bootstrap.ts`
- `packages/lead-connector/src/deployment/custom-menu.test.ts`
- `packages/lead-connector/src/deployment/custom-menu.ts`
- `packages/lead-connector/src/embed-bootstrap.contract.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/infrastructure/persistent-stores.ts`
- `packages/lead-connector/src/infrastructure/user-context-decoder.ts`
- `packages/lead-connector/src/persistent-stores.contract.test.ts`
- `packages/lead-connector/wrangler.jsonc`

## notes for ko

- Live telephony remains unauthorized in this branch. Deterministic, provider-test, sandbox, and browser validation may proceed independently.

## improvements noticed

- `task.start` rejected a mistakenly supplied repository string in its `github` field because that field expects a PR number. The corrected task start succeeded without it.

## issues and recovery

- A task-scoped batch did not propagate the outer taskSession into nested filesystem reads and returned `AMBIGUOUS_TASK_SELECTION`. Direct task-scoped reads recovered the required files. The semantic explore and stream-context steps still completed.

## workspace-owned: files changed

- `packages/dialer-server/compatibility-cutover.json`
- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/project.json`
- `packages/dialer-server/railway.json`
- `packages/dialer-server/README.md`
- `packages/dialer-server/scripts/validate-provider-test.ts`
- `packages/dialer-server/src/compatibility-cutover.contract.test.ts`
- `packages/dialer-server/src/embed-bootstrap.contract.test.ts`
- `packages/dialer-server/src/lead-connector-application.ts`
- `packages/dialer-server/src/runtime/embed-session.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`
- `packages/lead-connector/README.md`
- `packages/lead-connector/scripts/configure-sandbox-menu.ts`
- `packages/lead-connector/src/application/embed-bootstrap.ts`
- `packages/lead-connector/src/deployment/custom-menu.test.ts`
- `packages/lead-connector/src/deployment/custom-menu.ts`
- `packages/lead-connector/src/embed-bootstrap.contract.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/infrastructure/persistent-stores.ts`
- `packages/lead-connector/src/infrastructure/user-context-decoder.ts`
- `packages/lead-connector/src/persistent-stores.contract.test.ts`
- `packages/lead-connector/wrangler.jsonc`

## workspace-owned: activity log

- 2026-07-24 02:55:39 fs.write: `.task/dialer/lead-connector-e2e-cutover/workpad.md`
- 2026-07-24 02:57:50 fs.write: `packages/lead-connector/src/embed-bootstrap.contract.test.ts`
- 2026-07-24 02:58:01 fs.write: `packages/dialer-server/src/embed-bootstrap.contract.test.ts`
- 2026-07-24 02:59:24 fs.write: `packages/lead-connector/src/application/embed-bootstrap.ts`
- 2026-07-24 02:59:39 fs.write: `packages/lead-connector/src/infrastructure/user-context-decoder.ts`
- 2026-07-24 03:00:54 fs.write: `packages/dialer-server/src/lead-connector-application.ts`
- 2026-07-24 03:01:53 fs.write: `packages/dialer-server/src/runtime/embed-session.ts`
- 2026-07-24 03:05:27 fs.write: `packages/lead-connector/src/persistent-stores.contract.test.ts`
- 2026-07-24 03:05:59 fs.write: `packages/lead-connector/src/infrastructure/persistent-stores.ts`
- 2026-07-24 03:06:47 fs.write: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-07-24 03:07:11 fs.write: `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`
- 2026-07-24 03:09:52 fs.write: `packages/dialer-server/src/runtime/railway.test.ts`
- 2026-07-24 03:11:00 fs.write: `packages/dialer-server/src/runtime/railway.ts`
- 2026-07-24 03:14:30 fs.write: `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- 2026-07-24 03:14:48 fs.write: `packages/lead-connector/src/embed/cloudflare-worker.ts`
- 2026-07-24 03:15:13 fs.write: `packages/lead-connector/src/deployment/custom-menu.test.ts`
- 2026-07-24 03:15:29 fs.write: `packages/lead-connector/src/deployment/custom-menu.ts`
- 2026-07-24 03:16:37 fs.write: `packages/lead-connector/scripts/configure-sandbox-menu.ts`
- 2026-07-24 03:16:46 fs.write: `packages/lead-connector/wrangler.jsonc`
- 2026-07-24 03:17:03 fs.write: `packages/dialer-server/Dockerfile`
- 2026-07-24 03:17:11 fs.write: `packages/dialer-server/railway.json`
- 2026-07-24 03:20:05 fs.write: `.task/dialer/lead-connector-e2e-cutover/artifacts/local-runtime-validation.ts`
- 2026-07-24 03:20:56 fs.write: `packages/dialer-server/compatibility-cutover.json`
- 2026-07-24 03:21:09 fs.write: `packages/dialer-server/src/compatibility-cutover.contract.test.ts`
- 2026-07-24 03:22:45 fs.write: `packages/dialer-server/scripts/validate-provider-test.ts`
- 2026-07-24 03:33:18 fs.write: `packages/dialer-server/README.md`
- 2026-07-24 03:33:34 fs.write: `packages/lead-connector/README.md`
- 2026-07-24 03:42:54 fs.write: `packages/dialer-server/project.json`
- 2026-07-24 03:48:58 fs.write: `.task/dialer/lead-connector-e2e-cutover/workpad.md`
- 2026-07-24 04:00:25 fs.write: `packages/dialer-server/scripts/validate-provider-test.ts`

## workspace-owned: validation evidence

- 2026-07-24 03:54:40 `review.run`: passed — OK
- 2026-07-24 03:54:40 `review.run`: passed — OK
- 2026-07-24 03:54:40 `review.run`: passed — OK
- 2026-07-24 03:57:27 `review.run`: passed — OK
- 2026-07-24 04:01:05 `review.run`: passed — OK
- 2026-07-24 04:02:44 `verify`: passed — OK

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.task/dialer/build-lead-connector-embed/workpad.md`
- `.yarnrc.yml`
- `packages/dialer-server/package.json`
- `packages/dialer-server/project.json`
- `packages/dialer-server/scripts/validate-provider-test.ts`
- `packages/dialer-server/src/errors.ts`
- `packages/dialer-server/src/lead-connector-boundary.test.ts`
- `packages/dialer-server/src/routes/embed.ts`
- `packages/dialer-server/src/runtime/embed-session.ts`
- `packages/dialer-server/src/runtime/environment.test.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer/src/services/caller-id.ts`
- `packages/lead-connector/package.json`
- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/src/embed/api-client.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/main.ts`
- `packages/lead-connector/src/embed/protocol.ts`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/testing/in-memory.ts`
- `packages/workspace/scripts/review.js`
- `packages/workspace/senior-engineer.md`

## wait cycle: strict review

- Start time (UTC): 2026-07-24T03:48:50Z
- Wait reason: strict repository review exceeded the facade timeout but review processes remain active.
- Duration: poll every 20 seconds for up to 3 minutes.
- Resume action: check review process count and recent review output/artifacts immediately after each interval.
- Expected signal: all review processes exit and a structured review result is available.
- Fallback: identify and terminate stale duplicate review processes, then rerun one scoped review invocation.

- 2026-07-24 03:48:58 append: `.task/dialer/lead-connector-e2e-cutover/workpad.md`

- 2026-07-24 04:00:25 write: `packages/dialer-server/scripts/validate-provider-test.ts`

## final authoritative status

### completed behavior

- Implemented the production iframe bootstrap: the LeadConnector parent supplies opaque encrypted user context, `dialer-server` decrypts and verifies it server-side, and only then issues a short-lived Consuelo embed session.
- Bound bootstrap/session identity to workspace, Consuelo user, LeadConnector installation, and LeadConnector location. Every authenticated embed request revalidates the active installation, so disconnect and reinstall invalidate stale sessions.
- Kept OAuth access/refresh tokens, shared secrets, encryption keys, Twilio credentials, and server signing secrets out of browser code and built assets.
- Added durable Postgres installation ownership plus Redis OAuth-state and webhook-idempotency stores.
- Added a Redis-backed parallel dial store and first-party Railway runtime composition without Twenty or `packages/api` dependencies.
- Added dedicated Railway Docker/config contracts for `dialer-server` and a Cloudflare static/proxy contract for the standalone embed.
- Added an idempotent sandbox custom-menu configuration command using iframe mode, a single sandbox location, microphone enabled, and camera disabled.
- Implemented the versioned exact-origin parent handshake, trusted parent user-context request, repeated click-to-call deduplication, session expiry/reconnect, bounded bootstrap failure, and retry re-bootstrap behavior.
- Preserved backend-authoritative single/multiline call state, winner/losing-leg presentation, stop/hang-up, wrap-up, disposition, note, and tag routes.
- Kept pause/resume as browser queue-scheduling controls. There is no standalone pause/resume call-lifecycle API in `packages/dialer`; no lifecycle logic was invented in Hono or browser code.
- Added compatibility-cutover evidence flags and executable guards. Legacy API routes, Twenty call adapters, and the old click-to-call asset remain preserved until their equivalent sandbox/live parity evidence exists.
- Maintained LeadConnector-only public naming in source and built browser assets, preserving only exact provider-owned wire fields/domains where protocol compatibility requires them.

### validation evidence

- Pre-edit baselines: dialer 157, dialer-server 27, LeadConnector 35, legacy API 44, Twenty compatibility 45.
- Final deterministic matrix after review remediation:
  - `packages/dialer`: 159 passed, 0 failed.
  - `packages/dialer-server`: 35 passed, 0 failed.
  - `packages/lead-connector`: 49 passed, 0 failed.
  - legacy `packages/api` LeadConnector compatibility: 44 passed, 0 failed.
  - temporary Twenty compatibility: 45 passed, 0 failed.
  - all three package typechecks passed.
  - compiled `dialer-server` binary build passed.
  - LeadConnector library and browser embed build passed.
- Real local Postgres 17/Redis runtime passed installation scope, single-use OAuth state, duplicate webhook claim, and standalone mock-call checks; isolated records and keys were removed.
- Provider-test credentials reached Twilio's test-account validation boundary. Twilio rejected the selected live caller ID because it is not verified in the test account; no real call was placed, the phone number was redacted, and no caller-ID lock remained.
- Rendered browser validation on a fresh local origin proved no horizontal overflow, explicit authentication failure outside a trusted parent, disabled call controls without a session, and Retry re-requesting parent context instead of entering a false ready state.
- Strict changed-file repository review: 0 introduced issues, 0 related pre-existing issues, 0 background issues.

### preserved contracts

- `packages/dialer` remains the telephony and lifecycle authority.
- `packages/dialer-server` remains a thin Hono/Bun authentication, callback-verification, routing, and runtime-composition boundary.
- `packages/lead-connector` remains provider-specific and browser-safe; its embed has no Twenty, Recoil, NestJS, GraphQL, direct Twilio, server Effect-layer, provider-token, encryption, or persistence dependency.
- Existing `/leadconnector` OAuth/webhook behavior, legacy API tests, Twenty compatibility tests, and the legacy click-to-call asset are preserved.
- DEV-1605 remains unrelated and untouched.
- No customer account was mutated, no marketplace production installation was performed, and no live call was placed.

### known gaps and blockers

- This machine has no LeadConnector sandbox access token, location credential, saved provider login, or authenticated Marketplace session. Therefore a real sandbox installation, real-host parent handshake, sandbox contacts/opportunities/pipelines/stages, and sandbox note/tag/disposition writeback could not be executed.
- Human-winner and losing-leg live behavior was not rerun because Ko did not authorize live-call scope in this branch.
- Compatibility deletion remains intentionally blocked by `packages/dialer-server/compatibility-cutover.json` until sandbox and live evidence flags are backed by executable parity tests.

### workflow recovery

- OS reload temporarily invalidated the direct tool resource and later recovered.
- A recovery call accidentally created empty duplicate PR #1614 on `task/dialer/leadconnector-e2e-cutover`. PR #1614 was closed with an explanatory comment, and its branch, worktree, and tmux session were removed. The active task remained PR #1612 on the exact required branch.
- Full-repository `review --all` processes stalled while scanning the monorepo. Orphaned duplicate review processes were terminated; the correct strict changed-file review completed with zero findings. The complete package matrix was run separately and remained green.

### exact next branch

`task/dialer/lead-connector-sandbox-parity`

Purpose: deploy the already-defined Railway/Cloudflare topology to an isolated test environment, authenticate an actual LeadConnector sandbox/test location, execute the installed iframe/resource/writeback flows, and update compatibility evidence. Live single/multiline calls remain separately gated by Ko's explicit authorization.
