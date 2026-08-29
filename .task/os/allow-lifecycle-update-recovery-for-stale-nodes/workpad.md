# Allow lifecycle update recovery for stale nodes

branch: `task/os/allow-lifecycle-update-recovery-for-stale-nodes`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2296
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: nodes that are present but compatibility/readiness fail-closed must still be allowed to invoke the narrow lifecycle recovery surface needed to become compatible again. `lifecycle.status` remains readable and `lifecycle.update` may execute; ordinary tools, session.start, code.call, and unrelated lifecycle/domain calls remain blocked until the authoritative heartbeat proves compatibility/readiness.
existing local pattern: central MCP resolves the target node, loads the authoritative node record, and returns `WORKSPACE_NODE_UPDATE_REQUIRED` / `WORKSPACE_NODE_NOT_READY` before proxying typed calls. Live `cloud-1` demonstrates the deadlock: lifecycle.status proves runtime 0.1.93 installed, but lifecycle.update is rejected with `WORKSPACE_NODE_UPDATE_REQUIRED` because its heartbeat record has no protocol/version claims.
new or changed tests: extend workspace-node routing integration with incompatible/unknown node cases proving lifecycle.update bypasses compatibility/readiness gating and reaches upstream while an ordinary status/session tool remains rejected. Verify routing-only nodeId is still stripped and no other tool gains the bypass.
focused red command: `bun --cwd packages/os test tests/workspace-node-registry-routing.test.ts -t "lifecycle update recovery"`.
expected red failure: current proxy returns 409 before upstream for lifecycle.update on an incompatible or unknown node.
no-test waiver: not applicable.

red evidence: after granting the fixture its real `mcp:call` scope, explicit `lifecycle.update` on an unknown-compatibility node returned 409 `WORKSPACE_NODE_UPDATE_REQUIRED`, matching live `cloud-1`.

green evidence:
- explicit stale-node `lifecycle.update` reaches upstream while ordinary `status` remains blocked.
- recovery bypass requires explicit routing and is limited to `lifecycle.status` / `lifecycle.update`; OAuth, node existence, workspace routing, and all other readiness/compatibility checks remain intact.
- workspace-node routing + Device Authority worker: 2 files / 84 tests passed.
- OS syntax gate passed.
- Device Authority Wrangler dry-run passed; no deployment performed.

live context: `cloud-1` is already installed on canary 0.1.93, but its authoritative heartbeat record still lacks version/protocol/readiness claims. Device Authority therefore correctly fails normal calls closed, but previously also blocked the updater required to recover the node.

- 2026-08-29 07:32:51 append: `.task/os/allow-lifecycle-update-recovery-for-stale-nodes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 07:32:51 fs.write: `.task/os/allow-lifecycle-update-recovery-for-stale-nodes/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-08-29 07:33:56 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-08-29 07:34:15 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`

- 2026-08-29 07:34:35 apply-patch: `.task/os/allow-lifecycle-update-recovery-for-stale-nodes/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 07:34:59 `review.run`: passed — OK
- 2026-08-29 07:35:13 `verify`: passed — OK
