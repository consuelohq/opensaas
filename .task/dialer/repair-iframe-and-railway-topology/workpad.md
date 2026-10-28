# repair iframe and railway topology

branch: `task/dialer/repair-iframe-and-railway-topology`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1681/repair-iframe-and-railway-topology
github pr: https://github.com/consuelohq/opensaas/pull/1681
started: 2026-07-27

## acceptance criteria

- [ ] Confirm the installed LeadConnector shell parent origin through safe page metadata or user-provided screenshot.
- [ ] Add a focused red-then-green contract requiring the confirmed exact origin in `LEAD_CONNECTOR_PARENT_ORIGINS` and Worker `frame-ancestors`.
- [ ] Preserve exact-origin postMessage validation, absent `X-Frame-Options`, `microphone=(self)`, strict referrer policy, and `nosniff`.
- [ ] Redeploy the Cloudflare Worker and verify structured public response headers.
- [ ] Restore the installed sandbox iframe after a manual reload and screenshot from Ko.
- [ ] Inspect Railway service names, deployments, and variable presence without printing values.
- [ ] Normalize dedicated PostgreSQL/Redis service names and use Railway reference variables where supported.
- [ ] Redeploy `dialer-server`; verify deployment success, `/health` 200, PostgreSQL, Redis, encrypted installation retention, and iframe authentication.
- [ ] Add or confirm a provider contract proving `twilio-test` uses test credentials, requires an explicit caller ID, passes the magic From number exactly, and never claims live callbacks.
- [ ] Configure Twilio test credentials and safe allowlists through protected Railway input without printing values.
- [ ] Execute one Twilio test-credential request; prove no carrier call occurred.
- [ ] Preserve all compatibility routes/adapters and avoid OpenSaaS/twenty-worker/data deletion.
- [ ] Run focused/full tests, typechecks, embed build, Wrangler dry-run, strict review, and publish-valid verify.
- [ ] Merge PR #1681 into `stream/dialer`, refresh stream PR #1569, verify `scripts/code-review.sh` remains mode `100755`, and clean the task.

## plan

1. Confirm the real parent origin using bounded browser metadata only; do not inspect raw auth/network bodies.
2. Write the focused iframe-origin contract first, capture red, implement the exact origin, and validate package/build/Worker behavior.
3. Inspect Cloudflare and Railway authenticated state plus deployment topology without exposing secret values.
4. Deploy the iframe repair and obtain manual installed-sandbox confirmation from Ko.
5. Normalize Railway service names/references if the platform supports it safely; retain old service data.
6. Harden the Twilio test-credential contract first, configure protected variables, and run one no-carrier provider request.
7. Run the deterministic validation matrix, review, verify, publish, merge to stream, refresh #1569, and clean up.

## current status

- Task started from merged `stream/dialer` head `fcef912aa4` as PR #1681.
- Prior sandbox workpad and senior-engineer instructions read.
- Current code confirms protocol validation and Cloudflare CSP already share `LEAD_CONNECTOR_PARENT_ORIGINS`.
- The shared origin list currently contains only `https://app.leadconnectorhq.com` and `https://app.msgsndr.com`.
- No source edit, deployment mutation, Railway mutation, Twilio request, or carrier call has occurred.

## test-first contract

### iframe repair

- Behavior under test: the installed iframe may be embedded only by exact approved LeadConnector-owned origins; the postMessage bridge and Worker CSP must use one canonical constant.
- Existing pattern: `packages/lead-connector/src/embed/protocol.test.ts` and `cloudflare-worker.test.ts` use Bun contract tests and the Worker imports the protocol constant.
- New/changed tests: assert the safely confirmed shell origin is present in `LEAD_CONNECTOR_PARENT_ORIGINS`; assert Worker `frame-ancestors` renders the complete canonical list; retain no wildcard and absent `X-Frame-Options` assertions.
- Focused red command: `bun test packages/lead-connector/src/embed/protocol.test.ts packages/lead-connector/src/embed/cloudflare-worker.test.ts`.
- Expected red failure: confirmed shell origin is absent from the canonical list and CSP header.
- No-test waiver: none.

### Railway topology

- Behavior under test: runtime composes from dedicated PostgreSQL/Redis references and health/runtime checks survive service rename/reference normalization without changing installation data.
- Existing pattern: `packages/dialer-server/src/runtime/railway.test.ts` plus deployed `/health`, database, Redis, and installation evidence.
- New/changed tests: only if source/config behavior changes; service renames and protected reference values use runtime verification rather than source tests.
- No-test waiver: Railway canvas/name/reference mutations are deployment metadata; validation is service state, reference resolution, redeploy success, health, DB/Redis probes, and installation retention.

### Twilio test credentials

- Behavior under test: `twilio-test` selects test credentials, requires explicit caller ID, forwards the exact test From number, does not use live credentials, and does not claim callback/carrier evidence.
- Existing pattern: `packages/dialer-server/src/runtime/railway.test.ts` and `scripts/validate-provider-test.ts`.
- New/changed tests: add a focused runtime/provider test around separate live/test dialer construction and explicit caller ID behavior if current coverage is insufficient.
- Focused red command: package-specific Bun test selected after inspecting the provider seam.
- Expected red failure: current tests do not prove the exact test credential and magic-number request selection.
- No-test waiver: none.

## files changed

- `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.ts`

## key decisions

- Exact provider-owned origins only; no wildcard CSP or postMessage origins.
- Cloudflare header and browser protocol remain driven by one exported constant.
- Railway graph appearance is not runtime truth; connection, persistence, and redeploy evidence are authoritative.
- No real carrier call, multiline call, writeback, compatibility removal, or old-service deletion is authorized in this branch.

## notes for ko

- A manual installed-iframe reload and screenshot will be requested after the Worker is redeployed.
- No real phone should ring in this branch.

## improvements noticed

- none yet

## issues and recovery

- Initial unscoped senior-engineer read found many parallel task worktrees and correctly refused ambiguous selection. Starting the exact dialer task from `stream/dialer` resolved scope without touching other worktrees.

---

## publish checklist

- strict review
- publish-valid verify
- task push
- task merge into stream/dialer
- refresh stream PR #1569
- verify scripts/code-review.sh remote mode 100755
- task finish

- 2026-07-27 20:59:13 write: `.task/dialer/repair-iframe-and-railway-topology/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.ts`

## workspace-owned: activity log

- 2026-07-27 20:59:13 fs.write: `.task/dialer/repair-iframe-and-railway-topology/workpad.md`
- 2026-07-27 21:09:02 write: `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- 2026-07-27 21:09:02 fs.write: `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- 2026-07-27 21:09:23 write: `packages/dialer-server/src/runtime/twilio-provider-mode.ts`
- 2026-07-27 21:09:23 fs.write: `packages/dialer-server/src/runtime/twilio-provider-mode.ts`

## workspace-owned: files read

- `packages/workspace/scripts/git-diff.js`

## implementation evidence — Railway topology

- Dedicated services were already safely normalized as `dialer-server`, `dialer-postgres`, and `dialer-redis`; old OpenSaaS services and data were left untouched.
- Baseline runtime evidence before variable changes:
  - `dialer-server` deployment was `SUCCESS`;
  - public `GET /health` returned HTTP 200;
  - `dialer-redis` returned `PONG`;
  - `dialer-postgres` contained exactly one LeadConnector installation with nonempty encrypted access- and refresh-token ciphertext.
- Replaced only the two literal connection variables with Railway references:
  - `DATABASE_URL=${{dialer-postgres.DATABASE_URL}}`
  - `REDIS_URL=${{dialer-redis.REDIS_URL}}`
- Reference-cutover redeploy `8f2566fb-27b4-4587-bf6c-96be9f7fa9e2` reached `SUCCESS`.
- Post-cutover runtime evidence remained unchanged: HTTP 200 health, Redis `PONG`, PostgreSQL reachable, and the same single encrypted installation remained intact.
- Railway's variables JSON resolves reference expressions to runtime values, so deployment/runtime evidence—not a string-prefix assertion—is the authoritative proof that the references resolve.

## implementation evidence — Twilio test credentials

- Added `packages/dialer-server/src/runtime/twilio-provider-mode.ts` as a small testable provider-mode seam.
- Added `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`.
- Updated `railway.ts` to:
  - select live and test credentials through explicit separate code paths;
  - require an explicit caller ID in `twilio-test` mode;
  - require the exact Twilio no-carrier magic From number in `twilio-test` mode;
  - build provider group requests through one tested helper.
- Updated `scripts/validate-provider-test.ts` to use the Twilio no-carrier From number and report that carrier delivery and callbacks are not expected.
- Red evidence: the focused test initially failed because `twilio-provider-mode` did not exist.
- Green evidence: 4/4 focused provider-mode tests pass, proving test credential selection, exact caller-ID enforcement, exact provider request shaping, and no callback/carrier claim.
- All six documented Keychain services exist under account `kokayi`. The test credential pair is nonempty and distinct from live credentials. The safe destination list contains three valid E.164 entries. No values were printed.
- Securely configured through Railway stdin/protected variables:
  - `TWILIO_TEST_ACCOUNT_SID`
  - `TWILIO_TEST_AUTH_TOKEN`
  - `CONSUELO_SCENARIO_SAFE_TO_NUMBERS`
  - `CONSUELO_SCENARIO_SAFE_FROM_NUMBERS` restricted to the Twilio no-carrier magic From number for this test.
- Full-monorepo Railway upload timed out after archive transfer and produced stuck deployment `ae6526ac-64ea-421b-a946-b1ec2b2505fa` with no build. It never became active.
- Reused the prior proven minimal artifact lane: cross-compiled a Linux x64 Bun executable and uploaded only that executable plus a minimal Debian runtime Dockerfile.
- Minimal task-code deployment `06a09b98-69be-40bc-97ef-c1ae23caf0b3` reached `SUCCESS`.
- A short-lived protected bearer identity was deployed only for the one provider-test request. Redeploy `287152a1-0e03-408e-9ce5-594fe6de7767` reached `SUCCESS`.
- Public standalone `POST /v1/call-sessions` in `twilio-test` mode returned:
  - HTTP 201;
  - one simulated provider group;
  - one simulated call;
  - one simulated Call SID;
  - `carrierCallExpected: false`;
  - `callbacksExpected: false`.
- No carrier call was placed. No destination rang. No Twilio callback or TwiML fetch was claimed.
- The simulated provider-test group and Twilio magic-number lock were explicitly removed from Redis. Verification returned zero remaining provider-test groups and zero magic-number locks.
- Restored `DIALER_SERVER_AUTH_IDENTITIES_JSON` to `[]`; final redeploy `163ce208-e717-4abc-b55d-fa89b433423f` reached `SUCCESS`.
- The temporary bearer token now receives HTTP 401 and its local temporary file was removed.
- Final backend evidence after cleanup:
  - HTTP 200 health;
  - active deployment `163ce208-e717-4abc-b55d-fa89b433423f` `SUCCESS`;
  - PostgreSQL installation count 1 and encrypted fields intact;
  - Redis reachable;
  - provider-test groups 0;
  - magic-number lock 0.

## deterministic validation evidence

- `packages/dialer-server/src`: 40 passed, 0 failed, 202 expectations.
- Focused provider-mode suite: 4 passed, 0 failed.
- Dialer-server TypeScript passed.
- Compiled Bun dialer-server executable build passed.
- `packages/lead-connector/src`: 52 passed, 0 failed, 312 expectations.
- LeadConnector TypeScript passed.
- `build:embed` passed.
- Wrangler dry-run passed with the expected static asset binding and Worker bundle.
- Wrangler is authenticated with Worker write permission; no token or account identifier is recorded here.
- Shared canonical install lacked `bun-types`; validation materialized the lockfile-compatible type package under `/tmp` and linked it only into ignored task-worktree package-local `node_modules`. The shared install was not modified.

## iframe origin status

- `LEAD_CONNECTOR_PARENT_ORIGINS` remains the single source for both postMessage validation and Worker `frame-ancestors`.
- Current exact origins remain `https://app.leadconnectorhq.com` and `https://app.msgsndr.com`.
- A safe browser visit proved `https://app.gohighlevel.com` exists but the available profile is logged out; that does not prove it is the installed sandbox's actual parent origin.
- No candidate origin has been added and CSP has not been weakened.
- Required Ko action: reload the installed sandbox page and provide a screenshot showing the browser address bar and refused iframe. No credentials, cookies, storage, or developer-tools output should be shared.
- After that exact origin is confirmed, add the focused red contract, add only that exact provider-owned origin, deploy the Worker, verify headers, and obtain the manual render confirmation.

## branch topology evidence

- Working-tree diff is scoped to five source files plus task evidence: 10 files, 432 insertions, 34 deletions at this checkpoint.
- Remote GitHub comparison is healthy: task branch is one bootstrap commit ahead of `stream/dialer`, zero behind, and currently has zero source files because task edits are not published yet.
- The earlier 120-file local revision number was not the working-tree change set and will not be used as publication evidence.

## issues and recovery additions

- Local `railway run` could not reliably reach Railway private networking; recovered with public health plus `railway connect` service probes.
- Initial Railway SSH command quoting dropped shell arguments; recovered with explicit command separation and simpler probes.
- Full-monorepo `railway up` timed out and left a non-active initializing deployment without a build; recovered through the prior minimal standalone-executable deployment lane.
- First Redis cleanup command used shell escaping incompatible with the interactive Redis client. Verification caught the remaining group/lock; a Redis-native quoted Lua command then removed only the temporary provider-test workspace state and verified zero residue.

- 2026-07-27 21:37:30 apply-patch: `packages/lead-connector/src/embed/protocol.test.ts`
- 2026-07-27 21:37:30 apply-patch: `packages/lead-connector/src/embed/cloudflare-worker.test.ts`
- 2026-07-27 21:37:41 apply-patch: `packages/lead-connector/src/embed/protocol.ts`
- 2026-07-27 21:38:11 apply-patch: `packages/lead-connector/src/architecture.contract.test.ts`
## installed shell origin repair — 2026-07-27

- Ko's installed sandbox screenshot confirmed the iframe refusal remained before the repair.
- The active authenticated shell tab reported the exact parent origin as `https://app.gohighlevel.com`.
- Added focused red contracts for the exact origin in both the postMessage allowlist and Worker CSP; both failed before implementation.
- Added only the exact origin to `LEAD_CONNECTOR_PARENT_ORIGINS`; no wildcard origin was introduced.
- Updated branding architecture scans to exempt only the exact provider-owned wire origin while continuing to reject customer-visible legacy branding.
- Final LeadConnector validation: 53/53 tests, 314 expectations, TypeScript clean, embed build passed, Wrangler dry-run passed.
- Deployed Cloudflare Worker version `d8b37d27-a7f4-48d0-ba40-9a211614f4df`.
- Public response verification: HTTP 200; CSP contains the exact GoHighLevel origin; wildcard absent; microphone policy present; strict referrer policy present; nosniff present; X-Frame-Options absent.
- Automated browser reload redirected the agent profile to the provider sign-in page, so final installed authenticated iframe rendering remains a manual Ko confirmation.
