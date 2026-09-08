# Fix ChatGPT OAuth permission scope mismatch

branch: `task/os/fix-chatgpt-oauth-permission-scope-mismatch`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2379/fix-chatgpt-oauth-permission-scope-mismatch
github pr: https://github.com/consuelohq/opensaas/pull/2379
started: 2026-09-04

## acceptance criteria

- [x] Public OAuth discovery excludes scopes ordinary ChatGPT clients cannot receive.
- [x] ChatGPT authorization no longer silently downgrades a request based on advertised scopes.
- [x] Operator CLI node-management grants remain available and restricted.
- [x] Connected nodes with stale heartbeat state remain probeable for automatic recovery.
- [x] Focused gateway, OAuth, security, syntax, and Cloudflare packaging checks pass.

## plan

1. Reproduce the metadata/grant mismatch with failing tests.
2. Separate grantable public scopes from the complete internal scope registry.
3. Preserve operator-only authorization and connected-node recovery behavior.
4. Verify, review, publish, deploy both affected workers, and probe live metadata.

## current status

- Implementation and focused validation complete. Ready for publish and deployment.

## files changed

- packages/os/cloudflare/os-device-authority/src/constants.ts
- packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts
- packages/os/scripts/lib/workspace-cloudflare-edge-router.ts
- packages/os/tests/cloudflare-edge-router.test.ts
- packages/os/tests/os-device-authority-worker.test.ts
- packages/os/tests/workspace-gateway-node-proxy.test.ts

## workspace-owned: files changed

- Public discovery has a grantable-scope list; the complete scope registry still validates explicit operator requests.
- Stale-but-connected gateway routes are probed so a recovered node can refresh its heartbeat.

## workspace-owned: activity log

- 2026-09-04 20:03:10 fs.write: `.task/os/fix-chatgpt-oauth-permission-scope-mismatch/workpad.md`

## workspace-owned: validation evidence

- 2026-09-04 20:07:27 `review.run`: passed — OK
- 2026-09-04 20:08:41 `verify`: failed — COMMAND_FAILED
- 2026-09-04 20:09:20 `verify`: failed — COMMAND_FAILED
- 2026-09-04 20:11:21 `verify`: failed — COMMAND_FAILED
- 2026-09-04 20:16:04 `review.run`: passed — OK

## key decisions

- The orange ChatGPT warning was caused by public metadata requesting workspace:nodes:manage while the authorization flow correctly withheld it from ChatGPT.
- A reconnect performed before this deployment necessarily reused the broken discovery contract; reconnect once more after live validation.

## notes for ko

- The full package verifier has unrelated Grok detached-runner failures. The task-specific suite passes 137/137, syntax passes, both worker dry-runs pass, and strict review reports zero findings.

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

## Test-first contract

behavior under test: ChatGPT-facing OAuth metadata must advertise only scopes the ChatGPT client is allowed to receive, and an authorization request for every advertised scope must be granted unchanged; operator-only node-management scope remains available only to the operator CLI flow.
existing local pattern: `tests/cloudflare-edge-router.test.ts`, `tests/os-device-authority-worker.test.ts`, and `tests/operator-oauth-client.test.ts` cover OAuth discovery metadata and per-client scope filtering.
new or changed tests: assert workspace protected-resource metadata excludes `workspace:nodes:manage`; assert ChatGPT authorization of all advertised scopes does not silently downgrade the grant; preserve operator-client node-management coverage.
focused red command: `bun vitest run tests/cloudflare-edge-router.test.ts tests/os-device-authority-worker.test.ts tests/operator-oauth-client.test.ts`
expected red failure: current ChatGPT-facing metadata includes `workspace:nodes:manage`, while `scopesForClient` removes it from the authorization grant.
no-test waiver: not applicable.

- 2026-09-04 20:03:10 append: `.task/os/fix-chatgpt-oauth-permission-scope-mismatch/workpad.md`

- 2026-09-04 20:05:51 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-09-04 20:05:51 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-09-04 20:06:24 apply-patch: `packages/os/cloudflare/os-device-authority/src/constants.ts`
- 2026-09-04 20:06:24 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- 2026-09-04 20:06:24 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

- 2026-09-04 20:15:16 apply-patch: `packages/os/tests/workspace-gateway-node-proxy.test.ts`

- 2026-09-04 20:15:52 apply-patch: `.task/os/fix-chatgpt-oauth-permission-scope-mismatch/workpad.md`
