# self-heal session affinity workspace drift

branch: `task/os/self-heal-session-affinity-workspace-drift`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2257
started: 2026-08-29

## acceptance criteria

- [x] A valid task/work-session affinity survives workspace-ID drift when the same account, workspace host, and owner node still resolve to the current workspace route.
- [x] The affinity record is refreshed to the current resolved workspace ID before proxying, so the next call does not require `task.start`/`session.start` recovery.
- [x] Cross-node affinity remains fail-closed with `TASK_NODE_MISMATCH` / `WORK_SESSION_NODE_MISMATCH`.
- [x] A stale affinity must still fail closed when safe reconciliation cannot preserve the current owner on the resolved route.
- [x] Task and work-session behavior share the same safe reconciliation path.
- [x] Existing post-upstream affinity bookkeeping and `task.finish` release behavior remain unchanged.
- [x] Focused Device Authority routing tests, strict review, and canonical verify pass before promotion to `stream/os`.

## plan

1. Add focused RED proxy tests that reproduce the live `TASK_WORKSPACE_MISMATCH`/work-session equivalent after route workspace ID rotation while the same owner node remains valid.
2. Add a negative RED/green contract proving a mismatched owner-node workspace is not silently rebound.
3. Implement the smallest pre-proxy affinity reconciliation: validate the owner node against account/host/current workspace route, refresh affinity workspace ID only when that ownership proof is valid, otherwise preserve the existing 409 failure.
4. Keep node mismatch checks before reconciliation and reuse existing transactional affinity claim semantics.
5. Run focused routing/store tests, strict review, full verify, then promote to `stream/os`.

## Test-first contract

- behavior under test: an affinity keyed by account + workspace host + session can become stale only in its stored workspace ID while its owner node and hostname route remain the same. That condition should self-heal safely rather than deadlocking every task-scoped call behind `TASK_WORKSPACE_MISMATCH`.
- existing local pattern: affinity claims already allow the same owner node to refresh `workspaceId`; the bug is that `mcp-proxy.ts` rejects stale workspace IDs before any successful call can reach that refresh path. `WorkspaceNode` carries account/workspaceId/workspaceHost and can prove whether the owner still belongs to the resolved route.
- new or changed tests: add task and work-session route-drift success cases plus a fail-closed owner-membership mismatch case in `workspace-node-registry-routing.test.ts`.
- focused red command: `cd packages/os && bunx vitest run tests/workspace-node-registry-routing.test.ts -t 'workspace drift|workspace mismatch'`.
- expected red failure: current proxy returns 409 before upstream and leaves the stale affinity unchanged even though the same owner node is still the valid node for the route.
- no-test waiver: not applicable.

## discovery

- Live proof: valid task `tsk_679e8c531f39` twice began returning `TASK_WORKSPACE_MISMATCH`; durable local registry and owner node were intact. Calling the documented `task.start` compatibility alias against existing PR #2253 refreshed the same branch-stable task affinity and immediately restored routing without creating a branch/worktree/PR.
- `claimWorkspaceTaskAffinity`/generic session claim already refreshes `workspaceId` when the same `ownerNodeId` claims an existing affinity. The pre-upstream mismatch guard prevents ordinary session calls from reaching that refresh.
- Central affinity lookup is already scoped by account ID + workspace host + session identity. Safe auto-reconciliation still needs an owner-node membership proof before changing workspace ID.
- `WorkspaceNode` records include `accountId`, optional `workspaceId`, `workspaceHost`, and `nodeId`; store exposes `byWorkspaceNodeId`.
- Separate UX issue observed again: supplying facade-level `timeout` to `session.start` is incorrectly forwarded as a session input key and rejected. This is distinct from affinity drift and remains outside this narrow task unless it blocks acceptance.

## current status

- Task started from current `stream/os` as PR #2257 / `tsk_2ce51bf3d170`.
- Repair is implemented and fully validated. Ready to push/promote to `stream/os`.

## files changed

- `.task/os/self-heal-session-affinity-workspace-drift/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## key decisions

- Do not simply delete the workspace-ID guard. Rebind only after proving the affinity owner node belongs to the resolved account/host/workspace.
- Reuse existing claim methods for the write so ownership conflict and transaction semantics stay centralized.

## validation evidence

- RED `trc_8cd89f61b5b3`: focused routing packet executed the new task + work-session workspace-ID drift cases. Both failed at the existing pre-proxy guard with 409 instead of the expected 200; 41 unrelated cases were skipped. This reproduces the live deadlock before production edits.
- GREEN core `trc_595bf96aac98`: both task/work drift cases self-heal after the pre-proxy reconciliation change.
- Focused safety packet `trc_69b477fb7faa`: task/work drift repair, reconciliation-conflict fail-closed behavior, and explicit node-owner mismatch all passed.
- Full workspace-node routing file `trc_b54777e27961`: 44/44 passed.
- `checkFiles` passed for the Device Authority proxy + routing test in `trc_1f08d2359826`.
- Test-selection RED evidence `trc_6ed1f59a2da3`: `mcp-proxy.ts` still selected the broad `@consuelo/os package test`; extend the existing exclusive hosted-site/node-routing rule rather than create a duplicate routing rule.
- Test-selection registry regenerated in `trc_838dbd2c8cd1`; focused selection test passed in `trc_62517bc0b6fa`; direct selector proof `trc_95c854e1c7e3` shows `mcp-proxy.ts` now selects only the two hosted-site/node-routing suites and not the broad OS package suite.
- Final changed-file checks passed in `trc_159d645d041f`; generated/rules JSON parsed successfully in `trc_67cb4d961766`.
- Canonical full verify `trc_a9170f5fe2ad`: passed, publish-valid.
- Final strict review `trc_9b577557239f`: 0 task-owned, pre-existing, or blocking issues; one nonblocking MCP documentation opportunity.

## issues and recovery

- First canonical `session.start` attempt included top-level facade timeout; current gateway/facade forwarding leaked that into the selected tool input and produced an `Unrecognized key: timeout` validation error. Retry without call timeout succeeded. This confirms a separate session-start wrapper bug for later acceptance work.

- 2026-08-29 00:08:06 write: `.task/os/self-heal-session-affinity-workspace-drift/workpad.md`

## workspace-owned: files changed

- `.task/os/self-heal-session-affinity-workspace-drift/workpad.md`

## workspace-owned: activity log

- 2026-08-29 00:08:06 fs.write: `.task/os/self-heal-session-affinity-workspace-drift/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: validation evidence

- RED `trc_8cd89f61b5b3`: focused routing packet executed the new task + work-session workspace-ID drift cases. Both failed at the existing pre-proxy guard with 409 instead of the expected 200; 41 unrelated cases were skipped. This reproduces the live deadlock before production edits.
- 2026-08-29 00:10:28 `checkFiles`: passed — OK
- 2026-08-29 00:11:10 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-29 00:11:11 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-29 00:11:12 apply-patch: `.task/os/self-heal-session-affinity-workspace-drift/workpad.md`
- 2026-08-29 00:11:29 `checkFiles`: failed — COMMAND_FAILED
- 2026-08-29 00:12:05 `review.run`: passed — OK
- 2026-08-29 00:12:24 `checkFiles`: passed — OK
- 2026-08-29 00:12:58 `verify`: passed — OK
- 2026-08-29 00:13:03 `review.run`: passed — OK

- 2026-08-29 00:13:12 apply-patch: `.task/os/self-heal-session-affinity-workspace-drift/workpad.md`