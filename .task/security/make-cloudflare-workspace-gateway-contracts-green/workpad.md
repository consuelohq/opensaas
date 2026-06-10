# make cloudflare workspace gateway contracts green

## Goal
Implement the code required by the Cloudflare workspace gateway contract tests already merged onto `stream/security`.

## Acceptance criteria
- Run the opt-in OS and Twenty gateway contract suites red before implementation.
- Implement the simplest correct production code needed for the contract.
- Keep the existing generated gateway auth/security behavior intact.
- Validate the focused contract suites green.
- Run relevant existing gateway/security suites where practical.
- Inspect the diff before push and promote to `stream/security`.

## Test-first contract
Behavior under test:
- Twenty owns workspace hostname and route registry behavior for Cloudflare-managed Consuelo workspace URLs.
- OS provisioning emits Cloudflare workspace gateway metadata and outbound connector requirements.
- Unknown workspaces/routes and disconnected local connectors fail closed.

Existing pattern to follow:
- Read `packages/os/scripts/lib/security-gateway.ts` and `packages/os/tests/security-gateway.test.ts`.
- Read `packages/os/tests/workspace-gateway-contract.test.ts`.
- Read Twenty Cloudflare/DNS manager service patterns and the new contract spec.

New/changed tests:
- Existing opt-in contract tests on `stream/security` should go from red to green.

Focused red commands:
- `env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-gateway-contract.test.ts`
- `env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 yarn jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts --config packages/twenty-server/jest.config.mjs --runInBand`

Expected red failure:
- Missing OS Cloudflare workspace gateway metadata/connector behavior.
- Missing Twenty workspace Cloudflare gateway service module.

## Running notes
- Started from `stream/security` because the contract tests are on the security stream.
- Task session: `tsk_2587c8b118a2`.

- 2026-06-10 05:44:51 write: `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`

## files changed

- `packages/os/scripts/lib/security-gateway.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/security-gateway.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`

## workspace-owned: activity log

- 2026-06-10 05:44:51 fs.write: `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`
- 2026-06-10 05:51:32 fs.write: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-10 05:52:53 fs.write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`
- 2026-06-10 05:54:13 fs.write: `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`
- 2026-06-10 05:57:09 fs.write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`
- 2026-06-10 06:01:15 fs.write: `.task/security/make-cloudflare-workspace-gateway-contracts-green/gateway-normalized-domain-patch.txt`
- 2026-06-10 06:01:25 fs.patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`
- 2026-06-10 06:04:37 fs.write: `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`

## Red/green evidence

Red:
- OS contract red: 3 failed / 2 passed before implementation. Missing Cloudflare public gateway metadata, registry edge/connector metadata, and connector Cloudflare descriptor.
- Twenty contract red: 6 failed because `workspace-cloudflare-gateway.service` did not exist.

Green:
- OS contract green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-gateway-contract.test.ts` passed 5/5.
- Twenty contract green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 yarn jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts --config packages/twenty-server/jest.config.mjs --runInBand` passed 6/6.
- Existing OS gateway suite green: `bun --cwd packages/os test tests/security-gateway.test.ts` passed 19/19.

## Implementation notes

- Added Cloudflare workspace gateway metadata to generated OS auth config and public config.
- Added edge provider / connector mode metadata to the OS route registry and outbound connector descriptor.
- Added a pure Twenty-side workspace Cloudflare gateway service that plans workspace hostnames, resolves approved workspace routes, fails closed for unknown/offline routes, and handles Cloudflare hostname-health webhooks for managed zones only.

- 2026-06-10 05:54:13 append: `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`

## workspace-owned: validation evidence

- 2026-06-10 05:54:39 `checkFiles`: passed — OK
- 2026-06-10 05:55:42 `review.run`: passed — OK
- 2026-06-10 05:56:32 `review.run`: passed — OK
- 2026-06-10 05:57:09 write: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`
- 2026-06-10 05:58:28 `review.run`: passed — OK
- 2026-06-10 06:00:14 `review.run`: passed — OK
- 2026-06-10 06:01:15 write: `.task/security/make-cloudflare-workspace-gateway-contracts-green/gateway-normalized-domain-patch.txt`
- 2026-06-10 06:01:25 patch lines 129-132: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`
- 2026-06-10 06:02:19 `review.run`: passed — OK
- 2026-06-10 06:02:28 `checkFiles`: passed — OK
- 2026-06-10 06:03:41 `verify`: failed — COMMAND_FAILED
- 2026-06-10 06:04:22 `verify`: failed — COMMAND_FAILED

## workspace-owned: test selection

- changed files: `.task/security/make-cloudflare-workspace-gateway-contracts-green/current.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/evidence-log.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/read-log.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/session.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`, `.task/tasks/security/make-cloudflare-workspace-gateway-contracts-green.json`, `packages/os/scripts/lib/security-gateway.ts`, `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`
- matched rules: `twenty-server-project`, `auto:twenty-server:test`
- selected suites: `twenty-server affected test target`
- run results: `twenty-server affected test target` failed
- failed suites: `twenty-server affected test target`


## Review / verify

- `checkFiles` passed for changed OS and Twenty service files.
- `review.run --noTests` against `origin/stream/security` passed with 0 issues from this change and 1 pre-existing project typecheck issue.
- Full `verify` attempted and failed because the registry selected the broad `npx nx test twenty-server` target; that target fails broadly on pre-existing monorepo/Jest module issues unrelated to this two-file gateway implementation. Focused contract suites and existing OS gateway suite are green.

- 2026-06-10 06:04:37 append: `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`

## Publish summary

Implemented the Cloudflare workspace gateway contract on top of the existing generated auth foundation.

What changed:
- `packages/os/scripts/lib/security-gateway.ts` now persists `publicGateway` metadata in generated auth, exposes Cloudflare edge/connector metadata in the public route registry, and includes Cloudflare-managed hostname metadata in outbound connector descriptors.
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts` now exports the contract functions for provisioning plans, route resolution, and Cloudflare hostname-health webhook handling.

Why it changed:
- The security stream already had opt-in contract tests defining the public gateway behavior; this task makes those tests green without implementing the full production connector yet.

Validation:
- Red OS contract before implementation: 3 failed / 2 passed.
- Red Twenty contract before implementation: 6 failed because the service module was missing.
- Green OS workspace gateway contract: 5/5.
- Green Twenty workspace gateway contract: 6/6.
- Green existing OS security gateway suite: 19/19.
- `checkFiles` passed for changed files.
- `review.run --noTests` passed with zero issues from this change.
- Full verify was attempted and failed only on the broad pre-existing `npx nx test twenty-server` target, which currently fails across many unrelated suites/module-resolution paths.

Follow-ups:
- Build the production outbound connector path and onboarding integration separately.
- Decide whether the stale empty PR #927 should be closed after this task lands.
