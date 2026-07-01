# finish managed os mcp ingress provisioning

branch: `task/security/finish-managed-os-mcp-ingress-provisioning`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1147/finish-managed-os-mcp-ingress-provisioning
github pr: https://github.com/consuelohq/opensaas/pull/1147
started: 2026-06-19

## acceptance criteria

- [x] Keep the follow-up scoped to Consuelo OS workspace-edge / Cloudflare provisioning.
- [x] Represent the dashboard-proven OS MCP allow rule with `ruleset: 'current'` and skip phases for rate limiting, managed WAF, and Super Bot Fight Mode.
- [x] Keep the OS MCP block rule unchanged in intent: block untrusted `/mcp` traffic for OS workspace hostnames.
- [x] Wire env-derived managed OS MCP ingress config into a provisioning path that delegates to `applyWorkspaceCloudflareProvisioning()`.
- [x] Add real Cloudflare Rulesets/List API client methods for the managed policy operations, without committing tokens, zone IDs, ruleset IDs, or secrets.
- [x] Preserve local/dev behavior when managed policy env is absent; fail closed when policy env is explicit but incomplete or the configured account list is missing.
- [x] Update the security evidence doc to distinguish repo-local provisioning support from live provider evidence.

## plan

1. Read current provisioning, tests, install/bootstrap paths, and Cloudflare client patterns.
2. Add failing contract coverage for the exact skip action parameters, provisioning-env wiring, real Cloudflare API request shapes, and fail-closed list handling.
3. Implement the smallest production changes in `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`.
4. Update security evidence docs.
5. Run static safety scan before tests, then focused contract tests, typecheck, review, verify, push, pr, prs, and cleanup.

## current status

- Implementation and validation complete. Added exact managed OS MCP skip phases, env-derived provisioning delegation, real scoped Cloudflare Lists/Rulesets client methods, fail-closed coverage, and evidence doc updates.

## test-first contract

- Behavior under test: managed OS MCP ingress allow rule uses the full dashboard-proven skip payload, including `ruleset: 'current'` and phases `http_ratelimit`, `http_request_firewall_managed`, and `http_request_sbfm`.
- Behavior under test: provisioning env wiring constructs `managedOsMcpIngressPolicy` from Cloudflare env when policy env is present and delegates through `applyWorkspaceCloudflareProvisioning()` before tunnel/DNS work.
- Behavior under test: missing policy env stays inert for local/dev provisioning, while explicit incomplete policy env or a missing `$mcp_allowed_ips` account list fails closed.
- Behavior under test: real Cloudflare API client methods issue the expected Lists and Rulesets API requests with bearer auth and no secret values in returned status shapes.
- Existing local pattern: `packages/os/tests/cloudflare-provisioning-contract.test.ts` dynamically imports `scripts/lib/workspace-cloudflare-provisioning.ts` under `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1` and uses fake clients/fetch implementations for provider calls.
- New or changed tests: extend `cloudflare-provisioning-contract.test.ts` with action parameter exactness, update/reorder behavior, env wiring, missing-list fail closed, no hardcoded example hosts, and real client request-shape coverage.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-provisioning-contract.test.ts` from `packages/os`.
- Expected red failure: missing exports / weak action parameters / missing env-wiring helper / missing real Cloudflare API client.

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/docs/security-tightening-evidence.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/docs/security-tightening-evidence.md`
- `.task/security/finish-managed-os-mcp-ingress-provisioning/workpad.md`
- `.task/security/finish-managed-os-mcp-ingress-provisioning/verify.json`
- `.task/tasks/security/finish-managed-os-mcp-ingress-provisioning.json`

## workspace-owned: activity log

- Added red contract coverage for exact dashboard skip phases, create/update/reorder behavior, env wiring, missing-list fail closed, local/dev inert env, no hardcoded example hostnames, and real Cloudflare request shapes.
- Implemented managed OS MCP policy env helper and scoped Cloudflare client methods for account lists plus zone custom rulesets/rules.
- Updated the security evidence note to separate the older Twenty MCP credential gap from the OS Cloudflare ingress work.

## workspace-owned: validation evidence

- Static destructive-test scan over touched files: passed with zero findings.
- Secret-style scan over changed code/docs/tests: passed with zero findings.
- `git diff --check`: passed.
- `bun run typecheck` from `packages/os`: passed.
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-provisioning-contract.test.ts` from `packages/os`: 15 tests passed.
- `review.run --no-tests`: passed with 0 must-fix findings after error-handling fix.
- `bun run verify -- --base origin/stream/security --no-stamp --json`: passed; publish-valid, no stamp written.
- 2026-06-19 03:11:30 `review.run`: initial run surfaced 5 error-handling findings.
- 2026-06-19 03:13:12 `review.run`: passed — OK
- 2026-06-19 03:13:22 `verify`: passed — OK using facade defaults; exact base rerun recorded above.

## key decisions

- Keep this task in `packages/os`; do not wire through the Twenty MCP surface.
- Treat managed OS MCP ingress env as optional for local/dev when no managed policy keys are present, but fail closed when policy env is explicit and incomplete.
- Scope the real Cloudflare client to only the Lists/Rulesets operations needed by this policy instead of broadening the provisioning abstraction.
- Preserve live provider verification as a separate read-only evidence step; this change adds repo-local provisioning support and fake-client contracts only.

## notes for ko

- Provider-side Cloudflare evidence is still outstanding: confirm the deployed zone rules, order, and `$mcp_allowed_ips` contents without exposing secret values.

## improvements noticed

- The verify facade ignored the explicit base/no-stamp args in one run and used its default base; reran the exact verify command through `code.call` with `origin/stream/security --no-stamp`.

## issues and recovery

- `review.run` initially flagged missing async error boundaries in the new Cloudflare client methods; fixed with operation-scoped try/catch wrappers and reran review cleanly.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-19 03:00:55 apply-patch: `.task/security/finish-managed-os-mcp-ingress-provisioning/workpad.md`
- 2026-06-19 03:01:27 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:01:37 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:01:54 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:02:19 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:02:48 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:03:42 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:04:52 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:05:04 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 03:05:32 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 03:05:40 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 03:05:47 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 03:06:35 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 03:06:57 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 03:07:10 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-06-19 03:09:24 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-06-19 03:10:08 apply-patch: `packages/os/docs/security-tightening-evidence.md`

- 2026-06-19 03:12:38 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`

## workspace-owned: test selection

- changed files: `.task/security/finish-managed-os-mcp-ingress-provisioning/current.json`, `.task/security/finish-managed-os-mcp-ingress-provisioning/session.json`, `.task/security/finish-managed-os-mcp-ingress-provisioning/workpad.md`, `.task/tasks/security/finish-managed-os-mcp-ingress-provisioning.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-06-19 03:14:37 apply-patch: `.task/security/finish-managed-os-mcp-ingress-provisioning/workpad.md`

- 2026-06-19 03:14:45 apply-patch: `.task/security/finish-managed-os-mcp-ingress-provisioning/workpad.md`

- 2026-06-19 03:15:01 apply-patch: `.task/security/finish-managed-os-mcp-ingress-provisioning/workpad.md`