# Add Hono Bun server

branch: `task/dialer/add-hono-bun-server`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1608/add-hono-bun-server
github pr: https://github.com/consuelohq/opensaas/pull/1608
started: 2026-07-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `package.json`
- `packages/dialer-server/README.md`
- `packages/dialer-server/package.json`
- `packages/dialer-server/project.json`
- `packages/dialer-server/src/app.contract.test.ts`
- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/application.ts`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/contracts.ts`
- `packages/dialer-server/src/effect-runner.ts`
- `packages/dialer-server/src/errors.ts`
- `packages/dialer-server/src/index.ts`
- `packages/dialer-server/src/lifecycle.integration.test.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/middleware/auth.ts`
- `packages/dialer-server/src/middleware/twilio.ts`
- `packages/dialer-server/src/routes/call-sessions.ts`
- `packages/dialer-server/src/routes/health.ts`
- `packages/dialer-server/src/routes/twilio.ts`
- `packages/dialer-server/src/runtime/auth.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/src/runtime/twilio-signature.ts`
- `packages/dialer-server/src/twilio-boundary.test.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `scripts/code-review.sh`
- `yarn.lock`


## workspace-owned: files changed

- `packages/dialer-server/dist` (deleted)

## workspace-owned: activity log

- 2026-07-23 23:32:34 fs.trash: `packages/dialer-server/dist`
- 2026-07-23 23:34:06 fs.trash: `packages/dialer-server/dist`

## workspace-owned: validation evidence

- 2026-07-23 23:36:13 `review.run`: passed — OK
- 2026-07-23 23:36:55 `review.run`: passed — OK
- 2026-07-23 23:37:38 `verify`: passed — OK
- 2026-07-23 23:37:55 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Agent plan

- Create a private Hono package at packages/dialer-server with a socket-free createDialerServer composition function and a Bun-only bootstrap boundary.
- Preserve the shared @consuelo/dialer Effect application contracts; routes and middleware only validate, authorize, translate, invoke one use case, and map errors.
- Preserve Twilio raw-body signature semantics and external URL reconstruction behind proxies.
- Keep Twenty compatibility unchanged and prove it with the PR #1599 adapter suites.
- No live provider calls.

## Acceptance criteria

- [x] Private packages/dialer-server package exists and has zero Twenty/NestJS/GraphQL dependency.
- [x] Resource-oriented /v1 call-session routes and /webhooks/twilio routes are contract tested.
- [x] Health, auth identity propagation, one-use-case-per-route, typed error mapping, raw-body signatures, provider wire translation, redaction, and no-domain-logic-in-routes are tested.
- [x] In-memory lifecycle integration proves winner, loser termination, terminal state, and lock release without real Twilio.
- [x] Complete packages/dialer suite and PR #1599 Twenty adapter suites pass unchanged.
- [x] Server tests, typecheck, build, review, and publish verifier pass.
- [ ] Task merges into stream/dialer and stream PR #1569 refreshes.

## Test-first contract

- Behavior under test: a standalone Hono transport invokes the existing @consuelo/dialer Effect application programs exactly once per route, preserves workspace/user and Twilio callback semantics, and contains no dialer decisions.
- Existing patterns: packages/os Hono/Bun composition; PR #1599 Twenty adapters for transport translation and Twilio signature semantics; @consuelo/dialer application/ports/errors for authoritative behavior.
- New tests: Hono contract tests, source-boundary tests, Twilio signature tests, and an in-memory full callback lifecycle integration test.
- Focused red command: bun test packages/dialer-server/src/\*_/_.test.ts
- Expected red failure: package and createDialerServer do not exist.
- Provider policy: deterministic fakes only; no live Twilio call.

## Discovery

- Exact branch recreated as task/dialer/add-hono-bun-server after task.start initially normalized the title incorrectly; unused PR #1607 was closed and cleaned before edits.
- Batch facade did not propagate taskSession to nested code.call edit; direct task-scoped calls are used instead.

## Midpoint implementation evidence

- Pre-edit baselines: packages/dialer 157/157; PR #1599 Twenty compatibility 49/49.
- Added private packages/dialer-server with Hono app composition, Bun entry, Effect application adapter, bearer auth adapter, Twilio signature adapter, resource-oriented routes, and deployment runtime seam.
- Fixed HTTP paths through contract tests:
  - GET /health
  - POST /v1/call-sessions
  - GET /v1/call-sessions/:sessionId
  - POST /v1/call-sessions/:sessionId/terminate
  - POST /webhooks/twilio/status
  - POST /webhooks/twilio/customer-twiml
- Hono contract tests: 17/17 passed.
- Full in-memory lifecycle test: start through Hono, shared Effect programs, single winner, loser termination, winner unmute, lock release, telemetry, authenticated termination, terminal status; no real provider call.
- Dialer-server suite: 18/18 passed.
- Existing winner-bearing groups remain connected after provider terminal callback by package contract; authenticated termination performs the explicit terminal transition. This behavior was preserved rather than changed in the transport branch.
- Runtime deployment module remains an explicit composition seam; Railway supplies durable application layers in a later deployment task. No Twenty imports or copied lifecycle logic.

## Final validation evidence

- packages/dialer: 157/157 passed unchanged.
- PR #1599 Twenty compatibility baseline: 6 suites, 49/49 passed unchanged.
- packages/dialer-server: 18/18 passed, including Hono contracts, Twilio signature semantics, source-boundary checks, and the full in-memory winner/loser lifecycle.
- packages/dialer-server typecheck: passed.
- packages/dialer-server Bun build: passed; current bundled entry is 7.36 MB and should be optimized during deployment work, not this transport branch.
- Workspace test-selection registry: generated with the critical dialer-server rule; 8/8 registry tests passed; the selected server suites execute successfully.
- Repository classified review: 0 introduced issues, 0 blocking issues, 0 pre-existing issues in the task scope.
- Full publish verifier: passed and publish-valid; stamp written to .task/dialer/add-hono-bun-server/verify.json.
- Direct scripts/code-review.sh still scans prior stream history when run from this task and initially surfaced inherited broad-stream lint/typecheck noise; review.run against origin/stream/dialer is the authoritative task classification. DEV-1605 remains the unrelated repository issue and was not changed.
- No real Twilio call was placed.

## Preserved contracts

- Existing Twenty GraphQL DTOs and Twilio callback URLs remain unchanged.
- The six PR #1599 Twenty adapter suites pass unchanged.
- The shared @consuelo/dialer winner, AMD, lock, callback-idempotency, cleanup, telemetry, and workspace ownership programs are invoked rather than copied.
- Winner-bearing sessions remain connected after the provider terminal callback by existing package contract; the authenticated termination route performs the explicit terminal transition.

## Known gaps and deployment assumptions

- This branch does not deploy Railway or construct production Postgres/Redis adapters. Bun loads deployment-specific Effect layers through DIALER_SERVER_RUNTIME_MODULE; a deployment task supplies durable adapters and secrets.
- Bootstrap bearer identities are an explicit server adapter, not the future LeadConnector embed-session authentication mechanism.
- The Bun bundle currently includes the Twilio SDK and shared package graph and is 7.36 MB.
- No Cloudflare Worker runtime, Durable Object design, LeadConnector extraction, embed UI, or GraphQL deletion is included.

## Next branch

- task/dialer/extract-lead-connector
- Start from the freshly merged stream/dialer after this task PR merges.
- Extract LeadConnector OAuth, client, webhooks, opportunity/pipeline access, and public naming contracts without importing Twenty or duplicating dialer behavior.
