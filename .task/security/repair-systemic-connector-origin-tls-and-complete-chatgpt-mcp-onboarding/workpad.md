# repair systemic connector origin tls and complete chatgpt mcp onboarding

branch: `task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1422/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding
github pr: https://github.com/consuelohq/opensaas/pull/1422
started: 2026-07-11

## acceptance criteria

- [x] Replace the nested `<connector>.os-origin.<base-domain>` generator with one canonical opaque first-level connector hostname helper.
- [x] Prove deterministic, distinct, lowercase DNS-safe output with valid label/hostname lengths and fail-closed invalid inputs.
- [x] Use the canonical hostname for Tunnel ingress, connector DNS, provisioning results, device-authority bootstrap, and D1 route targets.
- [x] Update managed MCP WAF expressions so public workspace `/mcp` remains protected while the new private connector hostname class is excluded from public-host policy matching.
- [x] Preserve central OAuth account-to-workspace routing and signed central MCP proxy behavior; unsigned connector traffic must remain rejected.
- [x] Add a repository contract preventing production code from generating the old nested hostname class.
- [x] Run focused provisioning, device-authority, route-registry, edge-router, OAuth/proxy, security, strict review, and full verify gates.
- [ ] Release through `stream/security`, reprovision `testing45-78` without renaming or reinstalling it, validate TLS/WAF/D1/OAuth/MCP/ChatGPT end to end, then remove the old nested DNS record only after successful cutover.

## plan

1. Add failing contracts for the canonical connector hostname, provisioning propagation, WAF classification, device-authority persistence, proxy routing, and old-generator prohibition.
2. Implement one framework-neutral cryptographic hostname helper and route all production generation through it.
3. Update fixtures only where the security intent remains equivalent, then run focused and adjacent tests.
4. Run strict review and full verify, push the task, merge it into `stream/security`, refresh and merge the stream PR, and confirm the production release.
5. Reprovision `testing45-78`, validate the new route before deleting the old DNS record, then verify real OAuth, MCP `initialize`/`tools/list`, and ChatGPT app usage.

## test-first contract

- Behavior under test: a stable connector ID maps to an opaque `c-<digest>.<base-domain>` hostname with exactly one label before the base domain; the value propagates through Cloudflare, D1, device-authority, and central proxy contracts without exposing workspace/customer text.
- Existing local pattern: `cloudflare-provisioning-contract.test.ts` owns provisioning/WAF behavior; `os-device-authority-worker.test.ts` owns connector-result/D1 persistence; `cloudflare-edge-router.test.ts` and central MCP worker tests own signed proxy routing.
- New or changed tests: focused hostname unit contract, provisioning/WAF assertions, device-authority route assertion, proxy/edge fixtures, and a production-source repository guard against `.os-origin.` generation.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/connector-origin-hostname.test.ts tests/cloudflare-provisioning-contract.test.ts tests/os-device-authority-worker.test.ts`.
- Expected red failure: the canonical helper does not exist and current assertions observe nested `*.os-origin.consuelohq.com` values and suffix-based WAF logic.

## current status

- Task started from `main` SHA `b6bbad535c377b8be31ee463b262a045f0ef2d48` in isolated PR #1422.
- Read-only mapping confirms one planner value feeds Tunnel ingress, DNS, D1, device bootstrap, and proxy routing; the managed WAF expression explicitly excludes the old `.os-origin.<base-domain>` suffix.
- Red phase reproduced the missing canonical helper plus four old provisioning/WAF expectations.
- Implemented `c-<32-hex>.<base-domain>` from a domain-separated SHA-256 digest of the normalized stable connector ID.
- Managed MCP WAF now excludes only the anchored canonical connector class via a raw regex; it does not broadly exempt `c-*` customer workspaces.
- Device-authority provisioning, D1 route persistence, central OAuth workspace binding, signed proxy routing, Tunnel ingress, and connector DNS contracts are green.
- Device-authority Worker dry-run bundle succeeded with `nodejs_compat`.
- Strict review passed with zero blocking, changed-code, or pre-existing findings.
- Full verify passed and wrote a publish-valid stamp; targeted suites were run explicitly because registry auto-selection reported zero suites.

## files changed

- `packages/os/scripts/lib/connector-origin-hostname.ts`
- `packages/os/tests/connector-origin-hostname.test.ts`
- `packages/os/tests/os-device-authority-connector-provisioning.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/connector-origin-hostname.ts`
- `packages/os/tests/connector-origin-hostname.test.ts`
- `packages/os/tests/os-device-authority-connector-provisioning.test.ts`

## workspace-owned: activity log

- 2026-07-11 20:11:47 fs.write: `packages/os/tests/connector-origin-hostname.test.ts`
- 2026-07-11 20:12:43 fs.write: `packages/os/scripts/lib/connector-origin-hostname.ts`
- 2026-07-11 20:15:33 fs.write: `packages/os/tests/os-device-authority-connector-provisioning.test.ts`

## workspace-owned: validation evidence

- Red contract: missing helper and four old nested-host provisioning/WAF failures reproduced.
- `connector-origin-hostname.test.ts`: 16 passed.
- Focused Cloudflare/D1/edge/device route suite: 97 passed, 5 gated tests skipped in that invocation.
- Hardening/device provisioning suite with hardening gate enabled: 29 passed.
- `bun run typecheck`: workspace script syntax checks passed.
- `wrangler deploy --config cloudflare/os-device-authority/wrangler.toml --dry-run`: bundle succeeded.
- Strict review: 0 issues across static rules, ESLint, typecheck, and spec compliance.
- Full verify: passed; DB guard reported 0 risks and 0 findings; publish-valid stamp written.
- 2026-07-11 20:23:19 `review.run`: passed — OK
- 2026-07-11 20:23:43 `verify`: passed — OK

## key decisions

- Preserve the central OAuth identity-to-workspace path; no evidence indicates that routing is defective.
- Treat the connector hostname as an internal infrastructure class, not as a customer/workspace hostname or a manually supplied origin.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial `fs.read` was ambiguous because other task worktrees were active; created and selected this isolated task session.
- Initial `code.call` used a stale `codeFileSource` shape; retried once with the current `code` field and continued.
- First typecheck invocation placed `--cwd` incorrectly and only printed Bun usage; reran from the package working directory and passed.
- Initial strict review invocation exceeded the tool window without returning findings; reran deterministic strict review without duplicate tests and passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-11 20:17:47 apply-patch: `.task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding/current.json`, `.task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding/evidence-log.json`, `.task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding/read-log.json`, `.task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding/session.json`, `.task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding/workpad.md`, `.task/tasks/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/scripts/lib/connector-origin-hostname.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-d1-route-registry.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/connector-origin-hostname.test.ts`, `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`, `packages/os/tests/os-device-authority-connector-provisioning.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-11 20:23:52 apply-patch: `.task/security/repair-systemic-connector-origin-tls-and-complete-chatgpt-mcp-onboarding/workpad.md`