# extract lead connector

branch: `task/dialer/extract-lead-connector`
stream: `stream/dialer`
task pr: https://github.com/consuelohq/opensaas/pull/1609
consolidated stream pr: https://github.com/consuelohq/opensaas/pull/1569
started: 2026-07-24

## acceptance criteria

- [x] Create `@consuelo/lead-connector` with deliberate contracts, application, ports, infrastructure, and deterministic testing boundaries.
- [x] Keep the package free of Twenty, NestJS, GraphQL, Twilio, and dialer lifecycle dependencies.
- [x] Extract provider-specific OAuth/PKCE, encrypted token lifecycle, installation ownership, contacts, opportunities, pipelines, notes, tasks, dispositions, and webhook verification/translation.
- [x] Use Effect ports, typed failures, small named programs, and test layers consistent with `packages/dialer`.
- [x] Add a public branding contract that forbids GHL, GoHighLevel, and HighLevel on customer-visible/public new surfaces while allowing exact provider-owned wire names only where required.
- [x] Preserve `/leadconnector` OAuth and webhook route compatibility through thin Hono composition seams.
- [x] Inventory migrated, temporarily retained, and delete-later behavior without making `packages/api` authoritative.
- [x] Preserve `packages/dialer`, `packages/dialer-server`, legacy API, and affected Twenty compatibility contracts.
- [x] Add the new package to the dialer review router.
- [x] Run package tests, typecheck/build, compatibility tests, scoped repository review, and publish verification.
- [x] Reach a publish-valid task state with the exact next branch and handoff contract recorded.

## completed behavior

### `@consuelo/lead-connector`

- Added a new provider-specific package with zero Twenty dependency.
- Added OAuth authorization URL generation with S256 PKCE, single-use state, expiration, and location-only install targeting.
- Added encrypted access/refresh token persistence, refresh skew, token rotation, and workspace/location ownership enforcement.
- Added current v3 provider request headers and Fetch transport.
- Added provider mappings for contacts, opportunities, and pipelines.
- Added note, task, tag, and call-disposition writes.
- Added current Ed25519 webhook verification and the temporary provider RSA-SHA256 fallback.
- Added signature-before-parse behavior, translation-before-idempotency-claim behavior, atomic event claim port, nested event payload mapping, and deterministic event IDs.
- Added stable `Data.TaggedError` failures for OAuth state, installation ownership, provider requests, persistence, encryption, webhook signatures, and webhook payloads.
- Added WebCrypto AES-GCM token cipher, live config/clock/random layers, in-memory deterministic stores, and public package exports.
- Added `MIGRATION.md` documenting migrated, retained, and delete-later behavior.

### `packages/dialer-server`

- Added an optional Effect-backed LeadConnector application seam without moving provider logic into Hono.
- Preserved compatibility routes and response shapes:
  - authenticated `POST /v1/integrations/leadconnector/oauth`
  - public/state-authenticated `GET /v1/integrations/leadconnector/callback`
  - public/signature-authenticated `POST /v1/webhooks/leadconnector`
- Mounted public callback/webhook routes before generic `/v1/*` bearer authentication.
- Added stable redacted HTTP error mappings.
- Kept generic authentication, workspace authorization, Twilio callbacks, dialing decisions, caller-ID locks, and call lifecycle behavior outside the provider package.

### review routing

- Added `packages/lead-connector` to the dialer-critical changed-file classifier.
- Added `bun test packages/lead-connector/src` to `DIALER_TESTS`.
- Extended the durable dialer review-router contract.
- Restored local executable mode for `scripts/code-review.sh`; remote mode must be verified after publication because task publication has previously normalized it.

## hypotheses verified

- Reusable OAuth, token refresh, provider client, webhook, opportunity, and pipeline behavior could be extracted with bounded rewriting: **verified**.
- Twenty-specific SQL, record synchronization, pipeline persistence, Recoil state, and UI components should not move: **verified**.
- `packages/api` should remain migration source/compatibility code rather than become authoritative: **verified**.
- The current provider contract uses `Version: v3` and camelCase token fields: **verified**.
- Current webhook authenticity uses Ed25519 via provider-owned `X-GHL-Signature`, with temporary RSA-SHA256 fallback via `X-WH-Signature`: **verified**.

## TDD evidence

- Initial package red test: `bun test packages/lead-connector/src` failed because `src/index.ts` and implementation did not exist.
- Initial Hono seam red test: four compatibility route tests returned 404.
- Initial review-router red test: expected LeadConnector package routing was absent.
- All three red contracts were implemented and turned green without weakening assertions.

## validation

- `bun test packages/lead-connector/src`: **17 passed, 0 failed, 133 assertions**.
- `bun x tsc -p packages/lead-connector/tsconfig.json --noEmit`: passed.
- `bun x nx typecheck @consuelo/lead-connector`: passed.
- `bun x nx build @consuelo/lead-connector`: passed.
- `bun test packages/dialer-server/src`: **22 passed, 0 failed, 144 assertions**.
- `bun x tsc -p packages/dialer-server/tsconfig.json --noEmit`: passed.
- `bun x nx build @consuelo/dialer-server`: passed; Bun bundle produced successfully, generated output removed afterward.
- `bun test packages/dialer/src`: **157 passed, 0 failed, 222 assertions**.
- `bun x tsc -p packages/dialer/tsconfig.json --noEmit`: passed.
- Legacy provider route suite under its intended Jest config: **44 passed, 0 failed**.
- Temporary Twenty compatibility suites under their intended Jest config: **37 passed, 0 failed**.
- Dialer validation review-router contract: **5 passed, 0 failed**.
- Workspace test-selection registry: **9 passed, 0 failed**; the generated registry now selects the provider package explicitly.
- `review.run --base stream/dialer --strict --no-tests`: **0 introduced issues, 0 blockers** across 28 source files.
- Formal `verify --base stream/dialer`: **publish-valid**; five selected suites passed (`workspace-test-selection`, `dialer-server-package`, `lead-connector-package`, and both package-script suites), with zero DB risks or findings.
- Direct `scripts/code-review.sh`: every change-owned static rule and `DIALER_TESTS` passed. It remains blocked only by inherited stream/main baselines:
  - DEV-1605: deleted `twenty-eslint-rules` package referenced by the legacy lint configuration.
  - stale `packages/api` and broad Twenty typecheck failures that predate this task.
- No customer account was mutated.
- No marketplace application was installed.
- No live Twilio call was placed.

## preserved contracts

- `packages/dialer` remains the authoritative telephony/application package.
- `packages/dialer-server` remains the thin Hono+Bun public boundary.
- Twenty remains a temporary compatibility adapter.
- Existing public `/leadconnector` routes and response shapes remain available.
- No short-name public aliases were added.
- Provider-owned wire header names are preserved only at the HTTP boundary.
- Existing `packages/api` and Twenty provider code remains until parity and persistent runtime adapters are proven.

## migration inventory

### migrated

- OAuth/PKCE.
- Encrypted token lifecycle and refresh.
- Location/workspace installation ownership.
- Provider HTTP/version/header contracts.
- Contacts, opportunities, pipelines.
- Notes, tasks, tags, dispositions.
- Webhook verification, idempotency port, and provider-event translation.

### retained temporarily

- `packages/api` compatibility routes and persistence wiring.
- Twenty integration settings, sync jobs, and customer-system entity adapters.
- Customer-system pipeline mapping and SQL.

### delete later after parity

- Duplicate provider services/routes in `packages/api`.
- Provider-to-Twenty record synchronization that is not part of the standalone product.
- Twenty integration UI state after the embedded application replaces it.

## known gaps

- Production Postgres/Redis adapters for installation storage, OAuth state, and webhook idempotency are intentionally not implemented in this extraction branch.
- The runtime factory is present, but `main.ts` is not yet configured with production LeadConnector secrets/stores; no customer install should use the new route seam until those adapters are supplied.
- The embedded frontend is intentionally out of scope and belongs to branch six.
- No sandbox marketplace installation, token exchange against a customer account, or live provider webhook was performed.
- Root `bun install` remains blocked by known deleted legacy workspaces (`create-twenty-app`, `twenty-apps`, `twenty-cli`, `twenty-eslint-rules`, `twenty-zapier`). This branch did not restore them or weaken workspace validation. No new third-party dependency was required; Effect already exists in the lock graph.
- `stream.sync` could not push its temporary merge because its scratch worktree lacked dependencies, so this task correctly started from branch four's exact remote stream merge rather than importing an unverified main merge.

## files and boundaries changed

- Root workspace declaration.
- `packages/lead-connector/**` new package.
- Thin LeadConnector Hono composition files in `packages/dialer-server`.
- `scripts/code-review.sh` dialer routing only.
- `packages/workspace/tests/dialer-validation-runbook.test.ts` routing contract only.
- Task evidence under `.task/dialer/extract-lead-connector`.

## exact next branch

`task/dialer/build-lead-connector-embed`

Goal: build the customer-facing LeadConnector iframe application, port the trusted click-to-call/postMessage protocol without Twenty/Recoil dependencies, consume only `dialer-server` and `@consuelo/lead-connector` public contracts, and add the authenticated resource endpoints required by the embed without moving provider or dialer logic into Hono.

First tests:

1. Public branding scanner across built assets, copy, routes, errors, logs, telemetry, and package exports.
2. Trusted parent-origin handshake and rejection of untrusted origins.
3. Opportunity/contact loading through authenticated `dialer-server` contracts.
4. Click-to-call target selection and deduplication.
5. Single/multiline call-control state machine.
6. Wrap-up/disposition writeback contract.
7. No Twenty, Recoil, NestJS, GraphQL, or provider secret dependency in the browser bundle.

Non-goals: live marketplace installation, customer mutation, deleting old compatibility code, or moving dialer lifecycle behavior into the embed.

## tool issues and recovery

- Task-scoped `batch` propagated context to semantic exploration but not nested filesystem calls; recovered with direct task-scoped filesystem operations.
- `bun install` was blocked by known deleted workspaces; no dependency restoration was attempted.
- Direct review initially failed because `scripts/code-review.sh` was non-executable in the worktree; restored local `755`, then ran the exact direct gate. Remote mode remains a required post-push check.

## publish state

- Implementation complete.
- Scoped review clean.
- Formal verifier publish-valid.
- Awaiting publication, remote executable-mode verification, CI/review, merge into `stream/dialer`, and stream PR #1569 refresh.

- 2026-07-24 01:15:57 write: `.task/dialer/extract-lead-connector/workpad.md`

## files changed

- `package.json`
- `packages/dialer-server/package.json`
- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/contracts.ts`
- `packages/dialer-server/src/errors.ts`
- `packages/dialer-server/src/index.ts`
- `packages/dialer-server/src/lead-connector-application.ts`
- `packages/dialer-server/src/lead-connector-boundary.test.ts`
- `packages/dialer-server/src/routes/lead-connector.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/lead-connector/MIGRATION.md`
- `packages/lead-connector/package.json`
- `packages/lead-connector/project.json`
- `packages/lead-connector/src/application.contract.test.ts`
- `packages/lead-connector/src/application/oauth.ts`
- `packages/lead-connector/src/application/provider.ts`
- `packages/lead-connector/src/application/resources.ts`
- `packages/lead-connector/src/application/tokens.ts`
- `packages/lead-connector/src/application/webhooks.ts`
- `packages/lead-connector/src/architecture.contract.test.ts`
- `packages/lead-connector/src/constants.ts`
- `packages/lead-connector/src/contracts/index.ts`
- `packages/lead-connector/src/errors.ts`
- `packages/lead-connector/src/index.ts`
- `packages/lead-connector/src/infrastructure.contract.test.ts`
- `packages/lead-connector/src/infrastructure/fetch-transport.ts`
- `packages/lead-connector/src/infrastructure/runtime.ts`
- `packages/lead-connector/src/infrastructure/token-cipher.ts`
- `packages/lead-connector/src/infrastructure/webhook-verifier.ts`
- `packages/lead-connector/src/ports/index.ts`
- `packages/lead-connector/src/testing/in-memory.ts`
- `packages/lead-connector/src/webhook.contract.test.ts`
- `packages/lead-connector/tsconfig.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/dialer-validation-runbook.test.ts`
- `packages/workspace/tests/test-selection.test.js`
- `scripts/code-review.sh`

## workspace-owned: files changed

- `package.json`
- `packages/dialer-server/package.json`
- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/contracts.ts`
- `packages/dialer-server/src/errors.ts`
- `packages/dialer-server/src/index.ts`
- `packages/dialer-server/src/lead-connector-application.ts`
- `packages/dialer-server/src/lead-connector-boundary.test.ts`
- `packages/dialer-server/src/routes/lead-connector.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/lead-connector/MIGRATION.md`
- `packages/lead-connector/package.json`
- `packages/lead-connector/project.json`
- `packages/lead-connector/src/application.contract.test.ts`
- `packages/lead-connector/src/application/oauth.ts`
- `packages/lead-connector/src/application/provider.ts`
- `packages/lead-connector/src/application/resources.ts`
- `packages/lead-connector/src/application/tokens.ts`
- `packages/lead-connector/src/application/webhooks.ts`
- `packages/lead-connector/src/architecture.contract.test.ts`
- `packages/lead-connector/src/constants.ts`
- `packages/lead-connector/src/contracts/index.ts`
- `packages/lead-connector/src/errors.ts`
- `packages/lead-connector/src/index.ts`
- `packages/lead-connector/src/infrastructure.contract.test.ts`
- `packages/lead-connector/src/infrastructure/fetch-transport.ts`
- `packages/lead-connector/src/infrastructure/runtime.ts`
- `packages/lead-connector/src/infrastructure/token-cipher.ts`
- `packages/lead-connector/src/infrastructure/webhook-verifier.ts`
- `packages/lead-connector/src/ports/index.ts`
- `packages/lead-connector/src/testing/in-memory.ts`
- `packages/lead-connector/src/webhook.contract.test.ts`
- `packages/lead-connector/tsconfig.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/dialer-validation-runbook.test.ts`
- `packages/workspace/tests/test-selection.test.js`
- `scripts/code-review.sh`

## workspace-owned: activity log

- 2026-07-24 01:15:57 fs.write: `.task/dialer/extract-lead-connector/workpad.md`
- 2026-07-24 01:16:46 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-07-24 01:16:46 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-07-24 01:20:25 fs.write: `.task/dialer/extract-lead-connector/workpad.md`
- 2026-07-24 01:21:11 fs.write: `.task/dialer/extract-lead-connector/workpad.md`
- 2026-07-24 01:23:58 fs.write: `.task/dialer/extract-lead-connector/workpad.md`

## workspace-owned: validation evidence

- 2026-07-24 01:17:16 `review.run`: passed — OK
- 2026-07-24 01:17:39 apply-patch: `.task/dialer/extract-lead-connector/workpad.md`
- 2026-07-24 01:24:09 `review.run`: passed — OK

## CI wait cycle

Wait reason: PR #1609 checks restarted after the mode-only commit and currently have 11 pending, 0 failed.
Duration: bounded polling every 20 seconds for up to 10 minutes.
Resume action: inspect PR #1609 checks and normalized reviews immediately after each wake.
Expected signal: zero failed checks, zero pending required checks, and no actionable review finding.
Fallback: stop merge, record the failing or timed-out checks, and inspect their exact logs/review comments.

- 2026-07-24 01:20:25 append: `.task/dialer/extract-lead-connector/workpad.md`

Wait cycle 1 observed at 2026-07-24T01:21:00Z: 26 total checks, 15 pending, 0 failed. Normalized review feedback contained no actionable code finding; automated reviewers were unavailable or skipped the non-default base. Decision: continue bounded polling; do not merge.

- 2026-07-24 01:21:11 append: `.task/dialer/extract-lead-connector/workpad.md`

Wait cycle 2 observed at 2026-07-24T01:22:10Z: dialer CI passed; `danger-js` failed because Yarn immutable install detected the new workspace dependency was absent from `yarn.lock`. Added the lockfile entry with `yarn install --mode=update-lockfile`. A subsequent immutable install completed successfully; its link step changed two unrelated launcher modes, which were restored to the stream's `100644` values with no remaining diff. Provider tests remained 17/17, dialer-server tests 22/22, and workspace selection tests 9/9. Decision: rerun scoped review and formal verifier, then publish the lockfile follow-up before resuming CI polling.

- 2026-07-24 01:23:58 append: `.task/dialer/extract-lead-connector/workpad.md`
