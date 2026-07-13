# move workspace gateway ownership to OS

## Goal
Move Cloudflare workspace gateway provisioning/routing ownership out of `twenty-server` and into `packages/os`, while preserving the green gateway contracts from the security stream.

## Acceptance criteria
- Remove the Twenty-owned workspace gateway service and contract test.
- Move equivalent Cloudflare workspace gateway contract coverage into `packages/os/tests`.
- Add an OS-owned hostname registry seam that can represent both OS workspace routes and Dialer/app routes without making Twenty the authority.
- Keep existing generated gateway auth/security behavior intact.
- Validate focused OS gateway contract suites green.
- Run the existing OS security gateway suite.
- Inspect review/diff before push.

## Test-first contract

Behavior under test:
- OS owns `https://<workspace>.consuelohq.com` gateway provisioning semantics.
- A central hostname registry can reserve one workspace slug and attach multiple surfaces/routes, including OS and Dialer/app routes.
- Unknown hosts, unknown routes, disconnected OS connectors, and unmanaged Cloudflare webhook zones fail closed.
- Twenty has no direct workspace gateway provisioning service or contract test.

Existing pattern to follow:
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`
- current `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts` as behavior to relocate, not owner model to keep.

Focused red command:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-gateway-contract.test.ts tests/workspace-cloudflare-gateway-contract.test.ts`

Expected red failure before implementation:
- OS package does not yet contain the moved Cloudflare workspace gateway contract/service/registry seam.

No-test waiver:
- none.

- 2026-06-10 06:37:50 write: `.task/security/move-workspace-gateway-ownership-to-os/workpad.md`

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`
- `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts` (deleted)
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts` (deleted)

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`
- `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts` (deleted)
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts` (deleted)

## workspace-owned: activity log

- 2026-06-10 06:37:50 fs.write: `.task/security/move-workspace-gateway-ownership-to-os/workpad.md`
- 2026-06-10 06:42:03 fs.write: `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`
- 2026-06-10 06:43:04 fs.write: `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`
- 2026-06-10 06:43:13 fs.trash: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`
- 2026-06-10 06:43:13 fs.trash: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts`
- 2026-06-10 06:57:10 fs.write: `.task/security/move-workspace-gateway-ownership-to-os/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.contract.spec.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/workspace-cloudflare-gateway.service.ts`

## workspace-owned: TDD red evidence

- 2026-06-10 06:40:18 `sh -c CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-gateway-contract.test.ts tests/workspace-cloudflare-gateway-contract.test.ts`: passed exit 0 trace: `trc_62808d2da6f5`
  - output: → tmux: opensaas-security-move-workspace-gateway-ownership-to-os-4675db8f $ vitest run tests/workspace-gateway-contract.test.ts tests/workspace-cloudflare-gateway-contract.test.ts

- 2026-06-10 06:42:03 write: `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`

- 2026-06-10 06:43:04 write: `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`

## workspace-owned: validation evidence

- 2026-06-10 06:44:50 `checkFiles`: passed — OK
- 2026-06-10 06:45:50 `review.run`: passed — OK
- 2026-06-10 06:47:03 `checkFiles`: passed — OK


## Implementation notes

- Moved Cloudflare workspace gateway ownership into `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`.
- Added `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts` with the moved contract coverage.
- Added an OS-owned hostname registry seam for OS connector routes and Dialer service-upstream routes on the same workspace hostname.
- Removed the misplaced Twenty service and Twenty contract test.

## Validation evidence

- Focused OS contracts passed: 13/13.
- Existing OS gateway suite passed: 19/19.
- `checkFiles` passed for the changed OS files.
- `review.run --noTests` against `origin/stream/security` passed with 0 issues from this change and 1 known pre-existing Twenty project typecheck issue before final Prettier formatting.
- Later broad review/verify attempts exceeded the workspace transport timeout; focused tests and syntax checks stayed green after formatting.

## Follow-ups

- Implement the production outbound connector and onboarding path separately.
- Wire Dialer signup to call the OS-owned hostname registry instead of Railway or Twenty owning subdomain provisioning.

- 2026-06-10 06:57:10 append: `.task/security/move-workspace-gateway-ownership-to-os/workpad.md`
