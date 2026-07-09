# provision managed OS MCP ingress policy

branch: `task/security/provision-managed-os-mcp-ingress-policy`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1145/provision-managed-os-mcp-ingress-policy
github pr: https://github.com/consuelohq/opensaas/pull/1145
started: 2026-06-19

## acceptance criteria

- [x] Add managed OS MCP ingress policy support in `packages/os`, not Twenty.
- [x] Generate the Cloudflare WAF custom-rule expressions for OS workspace hostnames under `*.consuelohq.com`.
- [x] Exclude `*.os-origin.consuelohq.com`, `workspace.consuelohq.com`, and reserved platform hosts.
- [x] Use `$mcp_allowed_ips` as a configured account IP list and fail closed when the list is missing.
- [x] Represent the temporary local/dev deny CIDR override through config/env.
- [x] Provision allow/skip and block rules idempotently without duplicate rules on repeated installs.
- [x] Wire the policy check into workspace Cloudflare provisioning when config is present.
- [x] Update security evidence docs with the repo-local WAF/provider filtering support and the remaining deployment-evidence boundary.

## plan

1. Read relevant OS Cloudflare provisioning, edge router, docs, and tests.
2. Add failing contract tests for expression generation, env config, idempotent ruleset provisioning, and provisioning integration.
3. Implement the smallest provisioning module surface needed by those tests.
4. Update security evidence docs.
5. Run static safety scan, focused contract tests, typecheck, review, and verify.

## current status

- Implementation complete. Focused tests, typecheck, static safety scan, diff hygiene, review, and verify passed. Push/PR propagation pending.

## test-first contract

- Behavior under test: OS MCP `/mcp` Cloudflare ingress policy is generated from config, scoped to OS workspace hostnames, excludes hidden origin and reserved hosts, checks `$mcp_allowed_ips`, applies the temporary deny override when configured, and provisions rules idempotently.
- Existing local pattern: `packages/os/tests/cloudflare-provisioning-contract.test.ts` dynamically imports `scripts/lib/workspace-cloudflare-provisioning.ts` behind `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1` and uses fake clients for provider side effects.
- New or changed tests: extend `cloudflare-provisioning-contract.test.ts` with policy expression, env config, fake Rulesets API idempotency, and `applyWorkspaceCloudflareProvisioning` integration coverage.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-provisioning-contract.test.ts` from `packages/os`.
- Expected red failure: missing exports `buildManagedOsMcpIngressPolicyRules`, `createManagedOsMcpIngressPolicyConfigFromEnv`, and `ensureManagedOsMcpIngressPolicy`.

## files changed

- `.task/security/provision-managed-os-mcp-ingress-policy/workpad.md`
- `.task/tasks/security/provision-managed-os-mcp-ingress-policy.json`
- `packages/os/docs/security-tightening-evidence.md`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Static safety scan of touched source/test/doc files: passed; no destructive command literals or risky execution sinks found.
- Red focused command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-provisioning-contract.test.ts` failed as expected on missing exports for the new policy functions.
- Green focused command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-provisioning-contract.test.ts` passed, 1 file / 9 tests.
- `bun run typecheck` from `packages/os`: passed, workspace script syntax checks passed.
- `git diff --check`: passed.
- `review.run --no-tests`: passed, 0 findings.
- `verify --base origin/stream/security --no-stamp`: passed, publish-valid.
- 2026-06-19 01:54:55 `review.run`: passed — OK
- 2026-06-19 01:56:27 `review.run`: passed — OK
- 2026-06-19 01:56:37 `verify`: passed — OK
- 2026-06-19 01:56:54 `verify`: passed — OK

## key decisions

- Keep provider calls behind the existing Cloudflare provisioning client abstraction. Tests use in-memory rulesets and do not call Cloudflare.
- Treat the WAF rule as account/zone policy for the OS hostname class; D1 remains the workspace routing boundary.
- The module now exposes env-derived config for `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CUSTOM_RULESET_ID`, `CLOUDFLARE_MCP_ALLOWED_IPS_LIST_NAME`, install-bootstrap rule selectors, and `CLOUDFLARE_MCP_TEMPORARY_DENY_CIDRS`.
- Deployment evidence remains a separate read-only provider check; this task adds repo-local provisioning support and contract tests.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-19 01:46:32 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 01:47:15 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 01:48:04 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`

- 2026-06-19 01:48:23 apply-patch: `.task/security/provision-managed-os-mcp-ingress-policy/workpad.md`
- 2026-06-19 01:49:44 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 01:51:07 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 01:52:13 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 01:52:21 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 01:52:56 apply-patch: `packages/os/docs/security-tightening-evidence.md`

- 2026-06-19 01:54:32 apply-patch: `.task/security/provision-managed-os-mcp-ingress-policy/workpad.md`

- 2026-06-19 01:56:01 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`

## workspace-owned: test selection

- changed files: `.task/security/provision-managed-os-mcp-ingress-policy/current.json`, `.task/security/provision-managed-os-mcp-ingress-policy/session.json`, `.task/security/provision-managed-os-mcp-ingress-policy/workpad.md`, `.task/tasks/security/provision-managed-os-mcp-ingress-policy.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
