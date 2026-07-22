# align os mcp ingress provisioning boundary

branch: `task/security/align-os-mcp-ingress-provisioning-boundary`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1153/align-os-mcp-ingress-provisioning-boundary
github pr: https://github.com/consuelohq/opensaas/pull/1153
started: 2026-06-19

## acceptance criteria

- [x] Public install does not call Cloudflare WAF/IP-list/Rulesets provisioning.
- [x] Public install does not import or call Wrangler-backed R2/D1 edge publishing.
- [x] Cloudflare account-admin env is limited to platform/admin provisioning code.
- [x] Managed OS MCP WAF ensure logic remains available from an explicit platform/admin script.
- [x] Device approval flow can carry scoped connector bootstrap material, including optional Cloudflare tunnel token.
- [x] Docs state that customers do not need Cloudflare accounts or credentials.

## plan

1. Inspect merged installer, device approval, Cloudflare provisioning, edge publishing, and tests.
2. Move WAF provisioning wrapper out of install namespace and add explicit platform/admin script.
3. Remove public installer calls to Cloudflare WAF and Wrangler-backed edge publishing.
4. Preserve scoped `WorkspaceBootstrap` consumption and optional server-issued tunnel token flow.
5. Update tests and docs for the platform/control-plane boundary.
6. Run safety scans, focused tests, typecheck, review, and verify.

## current status

- Implementation complete. Pending final workspace verify/push/PR promotion.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- `packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- `packages/os/docs/security-tightening-evidence.md`
- `packages/os/package.json`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-19 13:51:27 destructive changed-file scan: passed after narrowing a false-positive `format: 'jwk'` crypto property match
- 2026-06-19 13:51:42 secret-pattern scan: passed
- 2026-06-19 13:51:58 focused contract run: new boundary/WAF/OAuth tests passed; `install-workspace-bootstrap-contract` had three pre-existing `bun:sqlite` import failures, while its new source-only boundary assertion passed
- 2026-06-19 13:52:16 focused passing set: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/platform-cloudflare-provisioning-contract.test.ts tests/cloudflare-provisioning-contract.test.ts tests/oauth-device-http-client.test.ts tests/oauth-device-onboarding-contract.test.ts` passed, 30 tests
- 2026-06-19 13:52:25 `bun run typecheck`: passed
- 2026-06-19 13:52:34 `git diff --check`: passed
- 2026-06-19 13:52:58 `review.run`: passed — OK
- 2026-06-19 13:53:42 `verify`: passed — OK

## key decisions

- Public install consumes Consuelo-issued scoped bootstrap only. It records `platformProvisioning` status but does not mutate Cloudflare account resources.
- WAF/IP-list/Rulesets provisioning lives under `platform-cloudflare-provisioning.ts` and `platform:managed-os-mcp-ingress:provision`.
- Wrangler-backed R2/D1 helpers remain internal Consuelo operator surfaces and are labelled as such.

## notes for ko

- Customers do not need Cloudflare accounts, Wrangler login, API token, account id, zone id, ruleset id, R2 authority, or D1 authority for public OS install.

## improvements noticed

- `install-workspace-bootstrap-contract` still has environment-sensitive `bun:sqlite` import failures under Vitest when contract tests import `install-state.ts`.

## issues and recovery

- Focused test attempt including `install-workspace-bootstrap-contract` failed three pre-existing runtime import cases: `Cannot find package 'bun:sqlite' imported from scripts/lib/sites.ts`. The source-only boundary assertion in that file passed; the passing focused set excludes that environment-sensitive file.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-19 13:45:48 apply-patch: `packages/os/scripts/install.ts`
- 2026-06-19 13:45:57 apply-patch: `packages/os/scripts/install.ts`
- 2026-06-19 13:46:11 apply-patch: `packages/os/scripts/install.ts`
- 2026-06-19 13:46:26 apply-patch: `packages/os/scripts/install.ts`
- 2026-06-19 13:46:34 apply-patch: `packages/os/scripts/lib/workspace-device-authorization.ts`
- 2026-06-19 13:46:43 apply-patch: `packages/os/scripts/lib/workspace-device-login-client.ts`
- 2026-06-19 13:47:19 apply-patch: `packages/os/scripts/lib/install-cloudflare-provisioning.ts`
- 2026-06-19 13:47:19 apply-patch: `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- 2026-06-19 13:47:19 apply-patch: `packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts`
- 2026-06-19 13:47:28 apply-patch: `packages/os/package.json`
- 2026-06-19 13:47:36 apply-patch: `packages/os/scripts/lib/install-edge-site-publisher.ts`
- 2026-06-19 13:47:36 apply-patch: `packages/os/scripts/seed-workspace-edge-route.ts`
- 2026-06-19 13:48:57 apply-patch: `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`
- 2026-06-19 13:48:57 apply-patch: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- 2026-06-19 13:49:10 apply-patch: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- 2026-06-19 13:49:37 apply-patch: `packages/os/tests/oauth-device-http-client.test.ts`
- 2026-06-19 13:49:37 apply-patch: `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- 2026-06-19 13:50:22 apply-patch: `packages/os/docs/security-tightening-evidence.md`

- 2026-06-19 13:53:31 apply-patch: `.task/security/align-os-mcp-ingress-provisioning-boundary/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/align-os-mcp-ingress-provisioning-boundary/current.json`, `.task/security/align-os-mcp-ingress-provisioning-boundary/session.json`, `.task/security/align-os-mcp-ingress-provisioning-boundary/workpad.md`, `.task/tasks/security/align-os-mcp-ingress-provisioning-boundary.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/package.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-cloudflare-provisioning.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`, `packages/os/scripts/lib/workspace-device-authorization.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts`, `packages/os/scripts/seed-workspace-edge-route.ts`, `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/oauth-device-http-client.test.ts`, `packages/os/tests/oauth-device-onboarding-contract.test.ts`, `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
