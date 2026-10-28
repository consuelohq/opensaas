# preserve workspace edge node auth through caddy

branch: `task/os/preserve-workspace-edge-node-auth-through-caddy`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1987/preserve-workspace-edge-node-auth-through-caddy
github pr: https://github.com/consuelohq/opensaas/pull/1987
started: 2026-08-15

## acceptance criteria

- [ ] Caddy preserves every header required by the `consuelo-edge-node-v1` verifier from the Cloudflare tunnel to the private Bun OS server.
- [ ] Caddy still strips unsigned legacy edge cache/route metadata that must not become trusted node input.
- [ ] Focused regression coverage fails before the production fix and passes afterward.
- [ ] The installed local Caddy config is reconciled through the supported OS lifecycle/reconciliation path, not by hand-editing `~/.consuelo`.
- [ ] Live authenticated workspace routes (`/diffs` and `/gateway/traces/*` or equivalent) stop returning `MISSING_EDGE_SIGNATURE` after the repaired runtime/config is active.

## plan

1. Lock the Caddy header contract in `security-gateway.test.ts` and capture the expected RED failure.
2. Remove only the Caddy directives that destroy cryptographically bound node-auth headers; preserve legacy unsigned metadata stripping.
3. Run the focused test GREEN, inspect the diff, then run the relevant end-to-end gateway-node contract and package static checks after destructive-literal preflight.
4. Run strict review and full verify against `origin/stream/os`, publish the task into `stream/os`, then reconcile the installed runtime/config through supported lifecycle tooling.
5. Verify the real authenticated workspace path and record the final runtime evidence.

## current status

- Root cause confirmed before task start: Workspace Edge signs the node request correctly, while generated Caddy removes signature/surface/connector headers before Bun verification.
- TDD RED captured: security gateway contract failed only on the newly inverted signed-header preservation assertion (1 failed / 29 passed).
- Production fix applied: generated Caddy now preserves `Edge-Signature`, `Surface`, and `Connector-Id` while still deleting unsigned `Edge-Cache-Authority` and `Route` metadata.
- Focused GREEN: `tests/security-gateway.test.ts` passes 30/30; `tests/caddy-worker-pool-reconciliation.test.ts` passes 1/1 and proves reconciliation retains edgeProxy node/connector/signing material while generating the repaired Caddy contract.
- Existing `tests/workspace-gateway-node-end-to-end.test.ts` reaches environments/secrets over the signed edge bridge but its trace assertion is blocked by an unrelated Vitest/Node runtime limitation (`Cannot find module 'bun:sqlite'`). A direct Bun invocation is also not a viable replacement because Vitest dependency interop fails earlier at `z.string`. No production failure from this task was observed in that test.
- `node ./scripts/check-syntax.js` from `packages/os` passes.

## files changed

- `packages/os/scripts/lib/security-gateway.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/security-gateway.ts`

## workspace-owned: activity log

- 2026-08-15 02:19:50 fs.write: `.task/os/preserve-workspace-edge-node-auth-through-caddy/workpad.md`
- 2026-08-15 02:22:09 fs.write: `packages/os/scripts/lib/security-gateway.ts`

## workspace-owned: validation evidence

- 2026-08-15 02:24:05 `review.run`: passed — OK
- 2026-08-15 02:25:23 `verify`: failed — COMMAND_FAILED

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

- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/server.js`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/workspace-gateway-node-end-to-end.test.ts`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`

## Test-first contract

- Behavior under test: generated Caddy ingress must preserve the complete `consuelo-edge-node-v1` signed header set from the Cloudflare tunnel to the private Bun OS server, while continuing to remove unsigned legacy routing/cache metadata that must not be trusted from the connector ingress.
- Existing local pattern: `packages/os/tests/security-gateway.test.ts` owns deterministic assertions for `renderCaddyGatewayConfig`; `workspace-edge-node-auth.ts` defines the cryptographically bound node header set and `security-gateway.ts` verifies it at the Bun boundary.
- New or changed tests: tighten the existing deterministic Caddy config test so it rejects stripping `X-Consuelo-Edge-Signature`, `X-Consuelo-Surface`, and `X-Consuelo-Connector-Id`, while still requiring stripping of `X-Consuelo-Route` and `X-Consuelo-Edge-Cache-Authority`.
- Focused red command: `bun --cwd packages/os test tests/security-gateway.test.ts` after destructive-literal preflight.
- Expected red failure: current `renderCaddyGatewayConfig()` emits `header_up -X-Consuelo-Edge-Signature`, `header_up -X-Consuelo-Surface`, and `header_up -X-Consuelo-Connector-Id`, so the new preservation assertions fail before production code changes.
- No-test waiver: none; this is an authentication boundary regression with a deterministic config contract.
- RED evidence: `bun --cwd packages/os test tests/security-gateway.test.ts` ran after full source preflight. Result: 1 failed / 29 passed; the only failure is the new Caddy preservation assertion because generated config still contains `header_up -X-Consuelo-Edge-Signature` (and the same production block also strips Surface/Connector-Id).

- 2026-08-15 02:19:50 append: `.task/os/preserve-workspace-edge-node-auth-through-caddy/workpad.md`

- 2026-08-15 02:19:56 apply-patch: `.task/os/preserve-workspace-edge-node-auth-through-caddy/workpad.md`

- 2026-08-15 02:20:56 apply-patch: `packages/os/tests/security-gateway.test.ts`

- 2026-08-15 02:21:54 apply-patch: `.task/os/preserve-workspace-edge-node-auth-through-caddy/workpad.md`

- 2026-08-15 02:22:09 write: `packages/os/scripts/lib/security-gateway.ts`

- 2026-08-15 02:22:53 apply-patch: `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`

- 2026-08-15 02:23:44 apply-patch: `.task/os/preserve-workspace-edge-node-auth-through-caddy/workpad.md`
