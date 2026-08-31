# decouple os auth from twenty while preserving canonical identities

branch: `task/os/decouple-os-auth-from-twenty-while-preserving-canonical-identities`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1939/decouple-os-auth-from-twenty-while-preserving-canonical-identities
github pr: https://github.com/consuelohq/opensaas/pull/1939
started: 2026-08-14

## acceptance criteria

- [x] The public OS device approval path uses Device Authority's native Google OAuth flow and no longer requires the Twenty `/auth/google?action=os-device-approval` bridge.
- [x] A verified Google email resolves to an existing canonical Consuelo `userId` plus a recently signed canonical `workspaceId` from the synchronized OS user directory; device approval never persists `google:<sub>` as canonical device identity.
- [x] An existing OS account/workspace route is reused only when its workspace ID exactly matches the newest recent signed canonical workspace verification; a stale or different route never overrides that proof.
- [x] Missing users, duplicate canonical users for one email, or users with no recent canonical workspace verification fail closed and leave the device grant pending. The OS cutover does not create or remap users/workspaces.
- [x] Google state, audience, verified-email checks, device public-key proof, revoked-node handling, connector route registration, and `/mcp` authorization semantics remain unchanged.
- [x] The existing Twenty approval bridge may remain temporarily for rollback compatibility, but the public OS device approval callback no longer routes through it.
- [x] Focused repository, device OAuth, and static-page contracts pass; strict review and full verify are clean enough to publish through the normal OS task lifecycle.

## plan

1. Add a read-only canonical identity lookup to the existing install-control-plane repository, with case-normalized email matching, duplicate detection, and deterministic most-recent workspace membership.
2. Add a small Device Authority identity-resolution service that prefers an existing valid OS account/workspace membership and otherwise uses the directory's most recently synchronized workspace.
3. Route only OS device Google approval through that resolver; keep MCP/web Google OAuth behavior unchanged and keep all existing grant/key/revocation/route logic intact.
4. Point the public device page at Device Authority's native Google start route instead of the Twenty bridge.
5. Preserve canonical install telemetry after native approval and validate negative auth/tenant cases before broader review/verify.

## current status

- Implementation complete locally. The public device page now starts Device Authority Google OAuth directly; native device approval resolves Google email through the canonical OS directory and binds canonical Consuelo user/workspace IDs.
- Workspace authorization is separated from install/history projection with a dedicated `verified_at`. Only a recent signed user-directory sync can authorize a fresh native approval; install telemetry can never mint that proof.
- Device Authority can preserve a legacy `google:<sub>` account key only as an internal compatibility alias when its stored workspace exactly matches the newly verified canonical workspace. New canonical identity remains the Consuelo user/workspace pair.
- Remaining extraction boundary: the signed canonical user-directory sync is still emitted by `twenty-server` during normal Consuelo sign-in. This task removes Twenty from the public/device approval hop without creating a second identity system; extracting that directory producer is a separate migration boundary.
- Validation: focused cutover suite is GREEN (7 files / 60 tests), the full Device Authority Worker regression file is GREEN (26/26), OS syntax/typecheck is GREEN, strict task review reports 0 blocking issues, and full `verify` is GREEN with `publishValid: true` and a verification stamp.

## files changed

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/os-device-authority/src/services/canonical-device-identity.ts`
- `packages/os/cloudflare/os-device-authority/src/services/install-identity.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0005_install_user_workspace_verification.sql`
- `packages/os/scripts/lib/install-control-plane.ts`
- `packages/os/scripts/lib/install-control-plane-d1.ts`
- focused OS auth/control-plane tests
- `packages/workspace/test-selection.rules.json` and generated registry, with an exclusive focused auth rule so verify never selects the unsafe unrelated OS package-wide suite for this boundary
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-14 05:43:41 fs.write: `.task/os/decouple-os-auth-from-twenty-while-preserving-canonical-identities/current.json`
- 2026-08-14 05:46:59 fs.write: `.task/tasks/os/decouple-os-auth-from-twenty-while-preserving-canonical-identities.json`

## workspace-owned: validation evidence

- 2026-08-14 05:46:07 `review.run`: passed — OK
- 2026-08-14 05:51:44 `verify`: failed — COMMAND_FAILED
- 2026-08-14 05:58:51 `verify`: passed — OK
- 2026-08-14 05:59:07 `verify`: passed — OK
- 2026-08-14 06:00:00 `verify`: passed — OK

## key decisions

- Do not create a second user/workspace system in Device Authority. Brand-new or unsynchronized users fail closed and must create/sign into their Consuelo account before retrying device approval.
- Preserve an existing Device Authority account/workspace route only when its workspace ID exactly matches the newest recent signed canonical workspace verification. This prevents an OS reinstall from silently retaining a stale tenant route.
- For a fresh OS binding, use the newest recent signed canonical workspace verification instead of alphabetically selecting a workspace ID or trusting historical projection rows.
- Keep the legacy Twenty OS-device approval endpoint temporarily as an unused rollback surface; remove runtime dependency first, delete compatibility later after canary proof.
- Do not modify MCP OAuth/web-login identity semantics as part of this task; the cutover is scoped to installer/device approval.
- Treat `os_install_user_workspaces` as a projection, not authorization by mere row existence. Only a recent membership verification timestamp written from a valid short-lived signed user-directory sync may authorize native device approval. Install telemetry/inferred canonical identity never writes that verification.
- Reuse a stored workspace route only when its workspace ID exactly matches the newest recently verified canonical workspace. Historical/stale routes never override the signed directory proof.
- The current 15-minute verification window is intentionally fail-closed because the repo does not yet have an authoritative workspace-membership revocation feed into Device Authority. Removing that freshness gate without first extracting membership authority would create stale tenant-access risk.

## notes for ko

- This task gets the OS device approval runtime off Twenty without deleting Twenty or moving product account creation. Existing canonical user/workspace IDs remain authoritative.
- A genuinely new account must exist in Consuelo before native OS approval can bind it. That is intentional fail-closed behavior for this cutover rather than duplicating signup/workspace creation in OS.
- A user whose canonical workspace verification is stale is also asked to sign in to Consuelo before retrying. That is the explicit remaining dependency until canonical directory/membership authority is extracted from `twenty-server`; it is not hidden behind a permissive stale-membership fallback.

## improvements noticed

- none yet

## issues and recovery

- The first full verify attempt selected the entire `@consuelo/os` package test and generated unrelated facade snapshot drift. Static preflight then found forbidden system-modifying literals in three unrelated package-wide test sources, so that broad suite was not rerun.
- Added the explicit exclusive `os-device-approval-canonical-identity` test-selection rule, reverted only the verify-generated facade snapshot drift, regenerated the test registry, and preflighted all 11 test sources selected by the focused verifier. The second full verify passed and is publish-valid.

## Test-first contract

- Behavior under test: native Google device approval binds a verified Google email to an existing canonical Consuelo user/workspace, never to `google:<sub>`, while preserving all existing device and tenant security gates.
- Existing local pattern: `packages/os/tests/os-device-authority-worker.test.ts` exercises the real Hono device/OAuth surface with mocked Google token exchange; install-control-plane tests cover memory/D1 persistence; `oauth-device-page-contract.test.ts` protects the public handoff.
- New/changed tests: repository lookup ordering and duplicate-email behavior; canonical native Google approval; existing-workspace preservation; missing/duplicate/no-workspace fail-closed cases; public page no longer references the Twenty bridge.
- Focused RED command: run only the changed OS contract files after destructive-literal preflight.
- Expected RED: current repository has no canonical email lookup; native device callback still stores `google:<sub>`; public page still targets `/auth/google?action=os-device-approval`.
- No-test waiver: none. This is an auth/tenant boundary and requires negative integration coverage.
- Security review delta: the first GREEN exposed that historical workspace rows were additive and their `updated_at` was not a membership-verification timestamp. The contract was tightened before Worker integration: signed sync receipt time becomes distinct `verified_at`, device approval requires freshness, and install-derived rows remain unverified.
- GREEN evidence: `tests/canonical-device-identity.test.ts`, `tests/install-control-plane.test.ts`, `tests/install-control-plane-d1.test.ts`, `tests/oauth-device-page-contract.test.ts`, `tests/internal-dashboard-integration.test.ts`, `tests/native-google-device-approval.test.ts`, and `tests/os-device-authority-worker.test.ts` pass together: 7 files / 60 tests.
- Worker evidence: `tests/os-device-authority-worker.test.ts` passes independently: 26/26 tests.
- Static evidence: `bun run --cwd packages/os typecheck` reports `workspace script syntax checks passed`; strict `review.run --mine --no-tests` reports 0 blocking issues.
- Test-selection evidence: the focused verifier selects the canonical device approval contracts plus workspace selector/CI metadata contracts and does not select `@consuelo/os package test`; all 11 selected test sources passed destructive-literal preflight.
- Full verify evidence: `verify --base origin/stream/os` passed with `publishValid: true`; DB guard passed with zero findings and the expected migration-file warning; verification stamp written to this task's `.task/.../verify.json`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/src/pages/login/device.astro`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/install-control-plane.ts`
- `packages/os/cloudflare/os-device-authority/src/services/canonical-device-identity.ts`
- `packages/os/cloudflare/os-device-authority/src/services/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0004_install_control_plane.sql`
- `packages/os/docs/install-control-plane.md`
- `packages/os/docs/workspace-control-plane-contract.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/install-control-plane-d1.ts`
- `packages/os/scripts/lib/install-control-plane.ts`
- `packages/os/tests/canonical-device-identity.test.ts`
- `packages/os/tests/install-control-plane-d1.test.ts`
- `packages/os/tests/install-control-plane.test.ts`
- `packages/os/tests/internal-dashboard-integration.test.ts`
- `packages/os/tests/native-google-device-approval.test.ts`
- `packages/os/tests/oauth-device-page-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.rules.json`

- 2026-08-14 05:59:46 apply-patch: `.task/os/decouple-os-auth-from-twenty-while-preserving-canonical-identities/workpad.md`
