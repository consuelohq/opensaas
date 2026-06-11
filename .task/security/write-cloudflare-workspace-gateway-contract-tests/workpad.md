# write cloudflare workspace gateway contract tests

## Goal
Write a test-only contract suite for Cloudflare-managed Consuelo workspace gateway provisioning and routing across Twenty server and Consuelo OS.

## Test-first contract

Behavior under test:
- Twenty should own Cloudflare workspace subdomain provisioning for `https://<workspace>.consuelohq.com`.
- Gateway routing should allow only approved workspace paths: `/office`, `/diffs`, `/wiki`, `/traces`, `/tools`, `/api`, `/mcp`, `/apps/chatgpt`.
- Unknown tenants, unknown routes, disconnected local OS connectors, and unmanaged Cloudflare webhook zones fail closed.
- OS generated gateway config should carry Cloudflare-managed host metadata and outbound connector requirements.

Existing patterns inspected:
- `packages/twenty-server/src/engine/core-modules/cloudflare/**`
- `packages/twenty-server/src/engine/core-modules/dns-manager/**`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/security-gateway.test.ts`
- stream PR #896 review metadata

New tests:
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`

Focused red commands:
- `env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 yarn jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts --config packages/twenty-server/jest.config.mjs --runInBand`
- `env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-gateway-contract.test.ts`

Expected red failures:
- Twenty gateway service module does not exist yet.
- OS gateway config is missing Cloudflare-specific public gateway metadata.

Normal CI behavior:
- Suites are discoverable and skipped unless `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1` is set, so this test-only contract can merge before implementation without failing CI.

## Evidence

Exploration/read evidence:
- Read active stream/security and PR #896 metadata.
- Read Twenty Cloudflare controller/service and DNS manager service/spec.
- Read OS gateway security implementation and tests.

Validation:
- Normal OS focused test passed with 5 skipped tests.
- Normal Twenty focused Jest test passed with 6 skipped tests.
- Opt-in OS contract failed red with 3 failing tests and 2 passing tests.
- Opt-in Twenty contract failed red with 6 failing tests because the future service module is missing.

## Notes

`checkFiles` was attempted and rejected the Twenty TypeScript spec through `node --check`; package-level Jest parsing is the relevant validation for that file type.

- 2026-06-10 04:24:13 write: `.task/security/write-cloudflare-workspace-gateway-contract-tests/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-10 04:24:13 fs.write: `.task/security/write-cloudflare-workspace-gateway-contract-tests/workpad.md`

## workspace-owned: validation evidence

- 2026-06-10 04:26:28 `review.run`: passed — OK
- 2026-06-10 04:26:29 `review.run`: passed — OK
- 2026-06-10 04:27:20 `review.run`: passed — OK
- 2026-06-10 04:29:13 `verify`: failed — COMMAND_FAILED
- 2026-06-10 04:29:14 `verify`: failed — COMMAND_FAILED

## workspace-owned: TDD green evidence

- 2026-06-10 04:27:37 `bun --cwd packages/os test tests/workspace-gateway-contract.test.ts`: passed exit 0 trace: `trc_73506e90ab25`
  - output: → tmux: opensaas-security-write-cloudflare-workspace-gateway-contract-test-ea14772d $ vitest run tests/workspace-gateway-contract.test.ts
- 2026-06-10 04:27:51 `yarn jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts --config packages/twenty-server/jest.config.mjs --runInBand`: passed exit 0 trace: `trc_842db6ccc067`
  - output: → tmux: opensaas-security-write-cloudflare-workspace-gateway-contract-test-ea14772d Test Suites: 1 skipped, 0 of 1 total Tests: 6 skipped, 6 total Snapshots: 0 total Time: 0.179 s, estimated 1 s
