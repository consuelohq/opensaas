# reconcile stale mcp security and workspace waf tasks onto main

branch: `task/os/reconcile-stale-mcp-security-and-workspace-waf-tasks-onto-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1898/reconcile-stale-mcp-security-and-workspace-waf-tasks-onto-main
github pr: https://github.com/consuelohq/opensaas/pull/1898
started: 2026-08-12

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-12 23:30:32 `review.run`: passed — OK
- 2026-08-12 23:30:43 `verify`: failed — COMMAND_FAILED
- 2026-08-12 23:31:57 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```


## reconciliation discovery

- Source of truth: current remote main at task start (source SHA a8fe13c2…), not the stale local main checkout and not stream/os.
- Superseded open PRs to reconcile: #1819 MCP authenticated-principal context, #1824 MCP security state hardening stacked on #1819, and #1872 workspace MCP/WAF tenant defaults.
- Real payload commits: 70f1778e80791a85966066173376e3671de28ce5, 6f7dbf086c4f91ad246af1c08ae5910b8717c149, 42da57acc1376e872539b974d3ea9193d9d490ba, c9c0d046eee5b1a7db84d6f1586a893714cecfb7. Bootstrap/merge-only task commits are intentionally excluded.
- Known current-main conflicts from merge-tree inspection are concentrated in MCP proxy/auth/trace/security-gateway files and workspace edge-route seeding; resolve semantically against current main rather than choosing either side wholesale.

## Test-first contract

- Behavior under test: authenticated MCP requests preserve principal identity and origin/scope boundaries; gateway security state/audit data remains durable; workspace edge route seeding and production WAF defaults remain tenant-safe and deterministic.
- Existing regression suites from the source tasks are the acceptance tests: mcp-authenticated-principal, mcp-central-proxy-scope, mcp-gateway-action-scopes, mcp-gateway, mcp-origin, os-device-authority-worker, trace-persistence, runtime-state, security-gateway, cloudflare-provisioning-contract, production-release-mcp-security, workspace-edge-route-seed-contract, workspace-edge-route-seed-identity, and workspace-edge-sites-gateway-integration.
- Reconciliation waiver for a synthetic red test: this task is porting already-tested commits across architectural drift, not introducing a new behavior spec. The safety signal is that the targeted source-task tests must pass after the semantic port, plus strict review/full verify. We will not manufacture a failing test on current main merely to satisfy a red-state ritual.


## reconciliation result

- PR #1819 behavior is already present on current main: the authenticated-principal, central proxy scope, action-scope, origin, and trace-persistence regression suites pass unchanged (35 focused tests plus broader MCP coverage).
- PR #1824 behavior is already present on current main: runtime-state, security-gateway, and MCP gateway regressions pass unchanged. Its gateway audit-path fix is also present verbatim in current security-gateway.ts.
- PR #1872 was only partially present. Two source-task tests missing from main were restored as the focused red tests: production release MCP policy reconciliation failed 2/2 and strict workspace seed identity failed 1/2 before implementation.
- Ported only the still-missing #1872 semantics onto current main: explicit full MCP ingress reconciliation in the production workflow, WAF workspace-host coverage that does not exempt the internal workspace hostname, explicit workspace seed identity, and the associated security evidence/tests. Kept current main's newer node/connector route merge semantics rather than overwriting them with the older task implementation.
- Post-port focused results: 4/4 restored red tests pass; 50/50 workspace Cloudflare/edge contract tests pass with gateway contracts enabled; 95/95 MCP/runtime/security regressions pass; package syntax/typecheck passes.
