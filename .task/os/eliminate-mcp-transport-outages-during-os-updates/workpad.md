# Eliminate MCP transport outages during OS updates

branch: `task/os/eliminate-mcp-transport-outages-during-os-updates`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2086
started: 2026-08-16

## acceptance criteria

- [x] Routine update/restart preserves Cloudflared and Caddy.
- [x] Routine activation rotates the two OS workers through a rolling handoff and fails closed if the HA pool cannot converge.
- [x] First upgrade from a legacy supervisor migrates daemon definitions to `runtime/current` without restarting public ingress.
- [x] Linux distinguishes the legacy transition from future rolling reloads.
- [x] Managed-Sites refresh does not hold daemon readiness/descriptors open.
- [x] MCP receipts store only a one-way `connectorKey`, never the raw OpenAI session value.
- [x] CI selection makes lifecycle/ingress/MCP regressions loud.
- [ ] Strict review + verify pass on the final diff.
- [ ] Merge to `stream/os`, release, update the Mac, and prove a same-conversation MCP call immediately after update.

## plan

1. Preserve public ingress during ordinary lifecycle activation.
2. Use strict rolling worker reload for ordinary updates; destructive restart remains repair/rollback only.
3. Handle the first legacy-supervisor upgrade explicitly and use stable `runtime/current` daemon definitions.
4. Add privacy-safe connector-session correlation.
5. Detach managed-Sites refresh from startup readiness.
6. Review, verify, publish, merge, release, update this Mac, then run same-conversation continuity proof.

- 2026-08-16 02:03:15 write: `.task/os/eliminate-mcp-transport-outages-during-os-updates/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 02:03:15 fs.write: `.task/os/eliminate-mcp-transport-outages-during-os-updates/workpad.md`
- 2026-08-16 02:03:21 fs.write: `.task/os/eliminate-mcp-transport-outages-during-os-updates/workpad.md`
- 2026-08-16 02:06:25 fs.write: `.task/os/eliminate-mcp-transport-outages-during-os-updates/workpad.md`

## Test-first contract

behavior under test:
- ordinary updates preserve ingress while workers rotate;
- legacy-to-fixed supervisor transition converges to the activated release;
- Linux and macOS keep the same availability boundary;
- raw OpenAI session identifiers are never persisted.

existing local pattern:
- two-worker supervisor / rolling reload in `worker-pool.ts` and `consuelo-reload.js`;
- lifecycle service/platform adapters own restart semantics;
- MCP request receipts are emitted at the local facade boundary;
- workspace test-selection protects high-risk OS lifecycle files.

new or changed tests:
- `packages/os/tests/lifecycle-ingress-continuity.test.ts`
- `packages/os/tests/linux-ingress-continuity.test.ts`
- `packages/os/tests/mcp-openai-session-receipt.test.ts`
- updates to lifecycle restart, daemon reliability, Linux platform, Bun-path, and selection tests.

focused red command:
- `bun test packages/os/tests/lifecycle-ingress-continuity.test.ts packages/os/tests/linux-ingress-continuity.test.ts packages/os/tests/mcp-openai-session-receipt.test.ts`

expected red failure:
- baseline lifecycle restarts ingress;
- baseline receipt lacks hashed connector correlation;
- legacy daemon definitions pin an immutable release and cannot safely perform the first rolling upgrade.

no-test waiver: not applicable.

- 2026-08-16 02:03:21 append: `.task/os/eliminate-mcp-transport-outages-during-os-updates/workpad.md`

## workspace-owned: files read

- `packages/os/tests/daemon-bun-path.test.ts`

## workspace-owned: validation evidence

- 2026-08-16 02:05:50 `review.run`: passed — OK
- 2026-08-16 02:06:18 `verify`: passed — OK

## validation evidence

- Focused lifecycle/update contracts: 183/183 passed.
- MCP admission contracts: 30/30 passed.
- Dangerous-material ingress contracts: 4/4 passed from the required OS working directory.
- Test-selection registry: 39/39 passed.
- Daemon background-refresh regression passed 5 consecutive Vitest runs after the test-race fix.
- OS syntax checks passed.
- Strict review: 0 blocking issues (`trc_5e41862bafed`).
- Full verify: `publishValid=true` (`trc_203760f527f3`).

## publish state

- Ready to push implementation to PR #2086 and merge it into `stream/os`.

- 2026-08-16 02:06:25 append: `.task/os/eliminate-mcp-transport-outages-during-os-updates/workpad.md`
