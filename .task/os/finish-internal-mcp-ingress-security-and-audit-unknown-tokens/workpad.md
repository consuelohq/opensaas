
## Discovery - 2026-08-13

- Scope: audit UNKNOWN_TOKEN traces, verify local Caddy worker balancing, reconcile the merged internal MCP ingress policy, and remove only the corrupt old fallback after active-runtime proof.
- Production mutation boundary: inspect live Cloudflare state before applying the repository-owned reconciliation action; preserve existing IP allowlist and unrelated rules.
- Test-first contract: add or run focused policy/route regression coverage before any source implementation. Live-only reconciliation requires a before/after policy diff and external untrusted/trusted behavior probes.
- Safety: runtime cleanup must be recoverable and must not touch current 0.1.33.

- 2026-08-13 18:35:26 apply-patch: `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- 2026-08-13 18:35:26 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-13 18:41:49 apply-patch: `packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts`
- 2026-08-13 18:42:15 apply-patch: `packages/os/scripts/migrations/reconcile-caddy-worker-pool.ts`
- 2026-08-13 18:42:15 apply-patch: `packages/os/scripts/lib/lifecycle/service.ts`
- 2026-08-13 18:42:15 apply-patch: `packages/os/scripts/lifecycle.ts`
- 2026-08-13 18:42:15 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-08-13 18:42:15 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-13 18:42:42 apply-patch: `packages/os/scripts/lib/lifecycle/service.ts`
- 2026-08-13 18:43:52 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-13 18:45:08 apply-patch: `packages/os/scripts/migrations/reconcile-caddy-worker-pool.ts`
- 2026-08-13 18:45:32 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-13 18:47:01 apply-patch: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- 2026-08-13 18:47:18 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-08-13 18:47:18 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-08-13 18:47:56 apply-patch: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- 2026-08-13 18:47:56 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`

## Verified diagnosis

- The recent `authorization.mcp UNKNOWN_TOKEN` records use fixture workspace `workspace_mcp_test` and coincide with `task/os/replica-fixture` calls from `tests/mcp-gateway.test.ts`; they are deliberate negative auth cases written to the shared local trace database, not untrusted ingress.
- Both OS workers on ports 46321 and 46322 are healthy, but the preserved Caddyfile contained only 46321. Canonical reload therefore reported `HA: unavailable` and all ingress requests landed on worker 0.
- Production ingress workflow run 31731208446 failed before mutation because the zone WAF token received 403 on the unnecessary account-list discovery request.

## Implemented

- Reconcile preserved Caddy config against the current worker-pool topology without rotating gateway credentials.
- Run that reconciliation during lifecycle restart/repair and as a signed one-time runtime migration, restarting Caddy only when its topology changes.
- Let Cloudflare Rulesets validate the configured named-list reference on rule mutation; account-list discovery remains required only when provider CIDRs are actually synchronized.

## Verification

- Focused Caddy/lifecycle: 8 pass, 0 fail.
- Cloudflare provisioning contracts: 34 pass, 0 fail.
- Runtime bundle and release workflow contracts: 28 pass, 0 fail.
- MCP security/route focused suite: 12 pass, 9 conditional skips, 0 fail.
- OS syntax/typecheck: passed.
- `git diff --check`: passed.

## workspace-owned: files read

- `/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-os-finish-internal-mcp-ingress-security-and-audit-unknown-tokens/.task/os/finish-internal-mcp-ingress-security-and-audit-unknown-tokens/workpad.md`

- 2026-08-13 18:49:13 apply-patch: `.task/os/finish-internal-mcp-ingress-security-and-audit-unknown-tokens/workpad.md`