# Wire MCP auth through workspace binding and harden gateway

branch: `task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1062/wire-mcp-auth-through-workspace-binding-and-harden-gateway
github pr: https://github.com/consuelohq/opensaas/pull/1062
started: 2026-06-15

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

- 2026-06-15 04:12:06 fs.write: `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/workpad.md`
- 2026-06-15 04:23:17 fs.write: `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/workpad.md`

## workspace-owned: validation evidence

- 2026-06-15 04:23:42 `review.run`: passed — OK
- 2026-06-15 04:27:00 `review.run`: passed — OK
- 2026-06-15 04:27:12 `verify`: passed — OK
- 2026-06-15 04:27:37 `verify`: passed — OK

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

## workspace-owned: files read

- `/Users/kokayi/.consuelo/os/security/generated/Caddyfile`
- `packages/os/README.md`
- `packages/os/TASK-WORKFLOW.md`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/workspace-edge/README.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/decision.md`
- `packages/os/dev-steering.md`
- `packages/os/package.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`

## agent update: test-first contract and investigation

### acceptance criteria

- [ ] Preserve install-time OS device approval and device public key proof-of-possession.
- [ ] Add an edge-visible MCP connection credential model that is persistent, scoped, revocable, and bound to Google identity, workspace, device, and connector.
- [ ] Require valid MCP credentials before `/mcp` traffic is proxied to an OS connector.
- [ ] Keep Bun signed-header verification as the final local authorization layer.
- [ ] Harden generated Caddy config while keeping it proxying only to `127.0.0.1:<port>`.
- [ ] Reuse the existing workspace edge blocked page for denied network/auth/workspace cases.
- [ ] Keep Sites/R2 snapshot routing separate from live OS/MCP connector routing.
- [ ] Document provider egress IP terminology as IP/CIDR ranges, not API keys or credentials.

## Test-first contract

### Behavior under test

- `/health` remains public and protected routes still reject unsigned requests with structured auth errors.
- A persistent MCP connection credential works across repeated MCP requests until rotated or revoked.
- A rotated or revoked MCP credential fails at the edge before connector routing.
- A credential scoped to the wrong workspace, connector, or capability fails at the edge.
- MCP network source allowlisting accepts only IP/CIDR values and blocks non-allowed sources when configured.
- The edge strips spoofable `x-consuelo-*` headers and adds its own signed internal proxy headers.
- Caddy generation remains deterministic, proxies only to localhost, strips untrusted Consuelo headers before proxying, and adds reasonable gateway hardening directives.
- Existing OS device approval OAuth remains separate from MCP connect credentials.
- Sites snapshot cache/R2 behavior remains public-snapshot-only and does not route snapshots through the Mac.

### Existing pattern to follow

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts` owns edge fail-closed routing, safe blocked HTML, and internal signing.
- `packages/os/scripts/lib/security-gateway.ts` owns local Bun gateway auth, request signing, nonce replay checks, token rotation/revocation, and generated Caddy config.
- `packages/os/cloudflare/os-device-authority/src/index.ts` owns install-time device approval and Google OAuth for device approval.
- `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/security-gateway.test.ts`, and `packages/os/tests/os-device-authority-worker.test.ts` are the focused contract tests.

### Intended tests

- Add edge-router tests for missing, invalid, valid, repeated, rotated, revoked, wrong-workspace, wrong-connector, and missing-scope MCP credentials.
- Add edge-router tests for configured provider egress IP/CIDR allowlist block/allow behavior and HTML blocked-page rendering.
- Add security-gateway tests for persistent MCP credential terminology and Caddy hardening directives.
- Add device-authority regression test proving MCP connect callback paths do not approve OS devices by accident if touched.
- Run existing focused OS contracts after green: security gateway, edge router, device authority, route registry, and workspace gateway.

### Focused red command

- `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/os-device-authority-worker.test.ts`

### Expected red failure

- New tests should initially fail because `/mcp` route proxying currently requires only route resolution and internal edge signing; no persistent MCP credential store or provider source policy exists, and generated Caddy lacks header stripping/timeouts/body limits/logging.

### Terms resolved

- Provider egress allowlist means IP addresses/CIDR ranges. It must not store API keys, OAuth secrets, bearer tokens, or app credentials.
- Persistent MCP connection credential means connected-app/API-key-style grant scoped to Google identity, workspace, device, connector, and capabilities; it remains valid until rotation/revocation/workspace or binding disablement.
- Per-request proof means timestamp, nonce, scope, workspace identity, caller identity, and signature checks on each request.
- Edge credential validation authorizes the MCP connection; local Bun signed-header verification remains final enforcement.
- Sites snapshots remain Cloudflare cache/R2 artifacts and do not require the Mac to be online.

### Provider egress evidence

- OpenAI docs say ChatGPT integrations use published JSON IP ranges, and those JSON files include `creationTime` and `prefixes`; ranges can change and should be fetched regularly. OpenAI also says IP allowlisting identifies OpenAI-operated network traffic and does not replace auth. For ChatGPT apps, docs recommend mTLS for MCP client authentication and OAuth 2.1 for user auth.
- Anthropic docs publish stable outbound IP ranges for Anthropic outbound requests, including MCP tool calls.
- Cloudflare WAF docs describe IP lists/custom rules as the Cloudflare primitive for network allowlists.

### Running-system facts

- Current installed Caddyfile at `/Users/kokayi/.consuelo/os/security/generated/Caddyfile` contains only `encode zstd gzip` and `reverse_proxy 127.0.0.1:8960`.
- `/Users/kokayi/.consuelo/os/security/generated/auth.json` exists; contents were not read to avoid exposing secrets.

### Key decisions

- Implement edge MCP credential validation as a product auth layer before connector proxying.
- Treat provider IP allowlisting as an optional edge/network guardrail configured from IP/CIDR values, with credential validation required for identity.
- Reuse the existing workspace edge blocked page machinery for denied edge cases.
- Keep OS device approval OAuth and MCP connect credentials separate.

### Issues and recovery

- Initial task was accidentally started under `backend`; no code was changed there. Correct task is this `os` branch/PR.
- Workpad overwrite failed because the facade did not pass `force`; recovered by appending this contract.

- 2026-06-15 04:12:06 append: `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/workpad.md`

- 2026-06-15 04:16:16 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-15 04:16:33 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-15 04:17:42 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-15 04:17:53 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-06-15 04:18:03 apply-patch: `packages/os/tests/workspace-gateway-contract.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-15 04:18:09 `bash -lc cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts tests/os-device-authority-worker.test.ts`: failed exit 1 trace: `trc_f750b08c44a7`
  - output: (fail) os device authority worker > should reject Google OAuth callback when state is unknown [0.43ms] (fail) os device authority worker > should keep the device grant pending when Google token exchange fails [0.75ms] (fail) os device authority worker > should render the Google approval link with the configured origin when viewing the device page [0.08ms] (fail) os device authority worker > serves hardened GitHub-shaped device auth endpoints on os.consuelohq.com [1.41ms] 31 pass 13 fail 224 expect() calls Ran 44 tests across 4 files. [820.00ms] error: script "task:exec" exited with code 1

- 2026-06-15 04:18:52 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-15 04:19:03 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-15 04:19:59 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-06-15 04:20:10 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-06-15 04:20:35 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-15 04:20:47 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-15 04:21:01 apply-patch: `packages/os/cloudflare/workspace-edge/src/index.ts`

## workspace-owned: TDD green evidence

- 2026-06-15 04:21:12 `bash -lc cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts`: passed exit 0 trace: `trc_546324af26b6`
  - output: Consuelo OS public gateway security contract > reports missing generated gateway artifacts in doctor checks [183.19ms] (pass) Consuelo OS public gateway security contract > timestamps and prunes replay nonces outside the verification window [2.43ms] (pass) Consuelo OS public gateway security contract > rotates tokens from persisted claims and rejects unknown source tokens [2.08ms] (pass) Consuelo OS public gateway security contract > fails closed on malformed unauthenticated /call bodies before JSON parsing [30.20ms] 38 pass 0 fail 207 expect() calls Ran 38 tests across 3 files. [710.00ms]

## workspace-owned: TDD post evidence

- 2026-06-15 04:21:57 `bash -lc cd packages/os && bun run test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts`: passed exit 0 trace: `trc_f3001f3c3f30`
  - output: → tmux: opensaas-os-wire-mcp-auth-through-workspace-binding-and-hard-a291d279 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts"
- 2026-06-15 04:22:03 `bash -lc cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts`: passed exit 0 trace: `trc_773110fc76cd`
  - output: → tmux: opensaas-os-wire-mcp-auth-through-workspace-binding-and-hard-a291d279 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts"
- 2026-06-15 04:22:11 `bash -lc printf 'health\n'; curl -s -i http://127.0.0.1:8960/health | sed -n '1,12p'; printf '\nget_steering\n'; curl -s -i http://127.0.0.1:8960/get_steering | sed -n '1,20p'`: passed exit 0 trace: `trc_fca7399bf564`
  - output: → tmux: opensaas-os-wire-mcp-auth-through-workspace-binding-and-hard-a291d279
- 2026-06-15 04:22:33 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-15 04:22:40 `bash -lc cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts`: passed exit 0 trace: `trc_858721e9b5a6`
  - output: → tmux: opensaas-os-wire-mcp-auth-through-workspace-binding-and-hard-a291d279 $ vitest run tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts
- 2026-06-15 04:22:56 `bash -lc cd packages/os && bun run typecheck`: passed exit 0 trace: `trc_3c096d5755f1`
  - output: → tmux: opensaas-os-wire-mcp-auth-through-workspace-binding-and-hard-a291d279 $ node ./scripts/check-syntax.js


## agent update: implementation and validation evidence

### Files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`
- `packages/os/cloudflare/workspace-edge/README.md`

### Implementation summary

- Added an MCP connection credential validator interface at the workspace edge.
- Added KV-backed credential lookup by SHA-256 hash of the bearer credential value.
- Added status, workspace, connector, and scope checks before `/mcp` proxying.
- Added provider source IP/CIDR policy for `/mcp` and fail-closed handling for non-IP policy values.
- Stripped all inbound `x-consuelo-*` headers at edge before adding edge-owned internal headers.
- Stripped the MCP bearer credential before proxying to the OS connector.
- Wired optional worker env inputs: `MCP_CONNECTION_CREDENTIALS` and `MCP_ALLOWED_PROVIDER_CIDRS`.
- Hardened generated Caddy config with `request_body` limit, logging, reverse proxy transport timeouts, and stripping edge-only Consuelo metadata while preserving Bun signed gateway headers.
- Documented persistent MCP connection credentials and provider egress IP terminology in the workspace-edge README.

### Validation evidence

- Red contract run failed as expected:
  - `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts tests/os-device-authority-worker.test.ts`
  - Expected failures: `/mcp` proxied without credential validation; Caddy lacked hardening directives.
  - Existing unrelated issue in this command: `bun test` does not provide `vi.stubGlobal` / `vi.unstubAllGlobals` for `os-device-authority-worker.test.ts`; the package Vitest runner handles that file.
- Green focused gateway contracts:
  - `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts`
  - Result: 38 pass, 0 fail.
- Green package Vitest focused gateway contracts:
  - `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts`
  - Result: 38 passed.
- Green OS device authority regression:
  - `cd packages/os && bun run test tests/os-device-authority-worker.test.ts`
  - Result: 6 passed.
- Green worker/route contracts:
  - `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts`
  - Result: 16 passed.
- Green syntax check:
  - `cd packages/os && bun run typecheck`
  - Result: workspace script syntax checks passed.
- Live local smoke:
  - `curl -i http://127.0.0.1:8960/health` returned `200 OK`.
  - `curl -i http://127.0.0.1:8960/get_steering` returned `401 MISSING_SIGNATURE`.
- Secret-shaped scan over changed files found no matches for common token/private-key patterns.

### Remaining live boundary

- No production Cloudflare rules were mutated in this task. Production should bind `MCP_CONNECTION_CREDENTIALS` and set `MCP_ALLOWED_PROVIDER_CIDRS` only to current provider IP/CIDR ranges. WAF/IP-list changes should be inspected/applied with Cloudflare tooling before deployment to avoid blocking real users.

- 2026-06-15 04:23:17 append: `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/workpad.md`

- 2026-06-15 04:26:20 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

## workspace-owned: test selection

- changed files: `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/current.json`, `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/evidence-log.json`, `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/read-log.json`, `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/session.json`, `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/verify.json`, `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/workpad.md`, `.task/tasks/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway.json`, `packages/os/cloudflare/workspace-edge/README.md`, `packages/os/cloudflare/workspace-edge/src/index.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/os/tests/workspace-gateway-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Final verification after review fix

- Patched MCP credential validation to fail closed when KV access or credential-store validation throws.
- Re-ran `cd packages/os && bun run typecheck`: passed.
- Re-ran `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-edge-router.test.ts tests/security-gateway.test.ts tests/workspace-gateway-contract.test.ts`: 38 passed.
- Re-ran `review.run`: 0 issues in my changes; one pre-existing `packages/os/scripts/server.ts` error-handling finding remains outside this task.
- Ran `verify`: publish-valid stamp written to `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/verify.json`.

- 2026-06-15 04:27:30 apply-patch: `.task/os/wire-mcp-auth-through-workspace-binding-and-harden-gateway/workpad.md`
