# wire managed os mcp ingress into install provisioning

branch: `task/security/wire-managed-os-mcp-ingress-into-install-provisioning`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1148/wire-managed-os-mcp-ingress-into-install-provisioning
github pr: https://github.com/consuelohq/opensaas/pull/1148
started: 2026-06-19

## acceptance criteria

- [x] Keep the follow-up scoped to Consuelo OS install/provisioning and Cloudflare managed OS MCP ingress policy.
- [x] Wire managed OS MCP provider-source filtering into the real install path, not only direct provisioning helper tests.
- [x] Use the real Cloudflare Lists/Rulesets policy client when managed policy env plus account/token env are present.
- [x] Keep local/dev installs inert when managed policy env is absent.
- [x] Fail closed with a clear error when managed policy env is explicit but incomplete or invalid.
- [x] Preserve the dashboard-proven allow rule payload: `ruleset: 'current'` plus `http_ratelimit`, `http_request_firewall_managed`, and `http_request_sbfm` skip phases.
- [x] Handle existing dashboard-created rules with no `ref` by matching/updating on description instead of creating duplicates.
- [x] Update launch evidence docs and validate with focused install/provisioning tests, Cloudflare contract tests, typecheck, review, verify, push, pr, prs, and cleanup.

## plan

1. Read install, install-state, workspace-edge route seed, Cloudflare provisioning, and existing tests.
2. Add failing contract tests for the real install path calling managed OS MCP policy provisioning, inert env, fail-closed env, exact skip payload, no hardcoded per-workspace WAF hosts, idempotency, and dashboard no-ref migration.
3. Implement a policy-only install provisioning wrapper backed by the existing managed Cloudflare Lists/Rulesets client and wire `install.ts` to await it.
4. Fix Cloudflare rule parsing/matching so no-ref dashboard rules are preserved and updated by description fallback.
5. Update security evidence docs and run the requested validation/publish flow.

## current status

- Implementation and validation complete. The real CLI path is now `packages/os/scripts/install.ts` -> `provisionLocalOs()` -> `provisionManagedOsMcpIngressPolicyFromEnv()` -> edge snapshot publish / success output. The install wrapper provisions only the global managed OS MCP WAF policy through the scoped Lists/Rulesets client; it does not invent tunnel/DNS provisioning.

## test-first contract

- Behavior under test: `install.ts` imports and awaits the managed OS MCP ingress install provisioning step after local OS provisioning and before install success payload/final summary.
- Behavior under test: install policy provisioning returns skipped/no-op when no managed policy env is present.
- Behavior under test: explicit managed policy env missing required Cloudflare zone/account/token/list values throws a clear error before reporting install success.
- Behavior under test: configured install policy provisioning uses the real managed Cloudflare client surface and sends the exact allow skip phases.
- Behavior under test: existing Cloudflare dashboard rules with id/description/expression/action but no `ref` are parsed, matched by description, updated/reordered, and not duplicated.
- Existing local pattern: `packages/os/tests/install-workspace-bootstrap-contract.test.ts` already verifies source-level install sequencing, and `packages/os/tests/cloudflare-provisioning-contract.test.ts` uses fake clients/fetch implementations behind `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-cloudflare-provisioning.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/docs/security-tightening-evidence.md`

## workspace-owned: files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-cloudflare-provisioning.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/docs/security-tightening-evidence.md`
- `.task/security/wire-managed-os-mcp-ingress-into-install-provisioning/workpad.md`
- `.task/security/wire-managed-os-mcp-ingress-into-install-provisioning/verify.json`
- `.task/tasks/security/wire-managed-os-mcp-ingress-into-install-provisioning.json`

## workspace-owned: activity log

- Added focused install Cloudflare contract coverage for real install-source wiring, inert env, explicit incomplete env fail closed, real Cloudflare policy client request shape, exact skip phases, and no hardcoded per-workspace WAF hostnames.
- Added dashboard no-`ref` reconciliation coverage through the real Cloudflare client parser.
- Added `install-cloudflare-provisioning.ts` as a policy-only install wrapper around the existing managed OS MCP policy config/client/ensure functions.
- Wired `install.ts` to await managed OS MCP policy provisioning after `provisionLocalOs()` and before edge publish / success output.
- Updated evidence docs with install wiring and the remaining live-provider launch boundary.

## workspace-owned: validation evidence

- Static destructive-test scan over touched files: passed with zero unallowed findings. Allowed pre-existing `Bun.spawn(['open', url])` in `install.ts` only opens the browser for device login.
- Secret-style scan over changed code/docs/tests: passed with zero findings.
- Trailing-whitespace scan over changed source/test/doc files: passed.
- `git diff --check`: passed.
- `bun run typecheck` from `packages/os`: passed.
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/install-cloudflare-provisioning-contract.test.ts tests/cloudflare-provisioning-contract.test.ts` from `packages/os`: 2 files / 20 tests passed.
- `review.run --no-tests`: passed with 0 must-fix findings.
- `bun run verify -- --base origin/stream/security --no-stamp --json`: passed; publish-valid, no stamp written.
- 2026-06-19 04:04:20 `review.run`: passed — OK
- 2026-06-19 04:06:24 `review.run`: passed — OK after merging `origin/stream/security` into the task worktree.
- 2026-06-19 04:06:38 `verify`: passed — OK using facade defaults; exact base rerun recorded above.

## key decisions

- Keep the install wiring policy-only because no real tunnel/DNS Cloudflare client exists yet and the OS MCP WAF policy is global for the OS hostname class, not per-workspace.
- Require `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` only when managed policy env is explicitly configured.
- Use description fallback for dashboard-created rules without `ref`, while preserving `ref` as the preferred match for managed rules.
- Merge `origin/stream/security` into the task worktree before publish so the task PR is aligned to PR #1138 instead of carrying older stream deltas.

## notes for ko

- Live provider evidence remains outstanding: read-only launch check should confirm deployed Cloudflare rule order/status and provider-only `$mcp_allowed_ips` entries without exposing values.
- The temporary local/dev deny CIDR override remains cleanup debt until `$mcp_allowed_ips` is provider-only.

## improvements noticed

- `verify` facade still ignored explicit base args and used its default base; reran exact `bun run verify -- --base origin/stream/security --no-stamp --json` through `code.call`.

## issues and recovery

- Initial red install contract failed on missing install wrapper/call. Initial red dashboard no-`ref` contract failed because parsed rules without `ref` were dropped and the code attempted duplicate creates. Both are now green.
- A broad existing install bootstrap test file currently imports `bun:sqlite` through install-state and is not part of the focused validation bundle; the new install source-path assertion lives in `install-cloudflare-provisioning-contract.test.ts` instead.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-19 03:55:27 apply-patch: `.task/security/wire-managed-os-mcp-ingress-into-install-provisioning/workpad.md`
- 2026-06-19 03:56:08 apply-patch: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- 2026-06-19 03:57:08 apply-patch: `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:57:38 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:58:37 apply-patch: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- 2026-06-19 03:58:49 apply-patch: `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:59:32 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 04:00:57 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 04:01:03 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 04:01:19 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 04:01:27 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 04:01:48 apply-patch: `packages/os/scripts/lib/install-cloudflare-provisioning.ts`
- 2026-06-19 04:02:03 apply-patch: `packages/os/scripts/install.ts`
- 2026-06-19 04:03:20 apply-patch: `packages/os/docs/security-tightening-evidence.md`

- 2026-06-19 04:05:42 apply-patch: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: test selection

- changed files: `.task/security/wire-managed-os-mcp-ingress-into-install-provisioning/current.json`, `.task/security/wire-managed-os-mcp-ingress-into-install-provisioning/session.json`, `.task/security/wire-managed-os-mcp-ingress-into-install-provisioning/workpad.md`, `.task/tasks/security/wire-managed-os-mcp-ingress-into-install-provisioning.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-cloudflare-provisioning.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-06-19 04:07:37 apply-patch: `.task/security/wire-managed-os-mcp-ingress-into-install-provisioning/workpad.md`