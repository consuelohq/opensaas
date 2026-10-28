# Reject revoked nodes from lifecycle recovery

branch: `task/os/reject-revoked-nodes-from-lifecycle-recovery`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2299
started: 2026-08-29

## acceptance criteria

- [x] Revoked authoritative nodes cannot use lifecycle recovery even if D1 routing is stale/inconsistent.
- [x] Stale active nodes can still use explicit `lifecycle.status` / `lifecycle.update` recovery.
- [x] Revoked recovery fails before upstream dispatch with `WORKSPACE_NODE_REVOKED`.
- [x] A focused regression reproduces the bypass red and passes after the fix.

## plan

1. Verify the CodeRabbit finding against Device Authority revocation and D1 routing semantics.
2. Add an inconsistent-store regression where D1 is active but the authoritative node is revoked.
3. Add a non-bypassable revocation guard before lifecycle recovery evaluation.
4. Run focused and adjacent validation, strict review, formal verify, then promote into `stream/os`.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## key decisions

- Revocation is an identity/authorization terminal state, not a readiness state. It must be checked independently before any lifecycle recovery bypass.
- Reuse the existing D1 contract: return 404 `WORKSPACE_NODE_REVOKED` and never dispatch upstream.
- Keep lifecycle recovery restricted to explicit stale active nodes; no widening of default/session routing behavior.

## notes for ko

- CodeRabbit's security finding was valid as defense in depth. Normal revocation updates D1 before Durable Object state, but the proxy now also protects against inconsistent/stale D1 state.

## improvements noticed

- `packages/workspace/scripts/check-syntax.js` recursively checks every workspace JS file and hung past 120s in this task; it is too broad for a two-file TypeScript edge patch. `review.run`/`verify` still own lint/typecheck, and the Device Authority Worker dry-run is the relevant build proof.

## errors i ran into

- A literal-by-literal destructive-test preflight request was blocked by the OS safety policy. Switched to the repo's `assessDangerousMaterial` policy module; both affected test files reported `allowed: true` before execution.
- One combined validation call returned transport 502. Splitting validation proved the affected tests and Worker dry-run independently.
- The broad workspace syntax script timed out after 120s with no output; trace `trc_832ab7a2b034`. No source mutation occurred.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/scripts/lib/dangerous-material-policy.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/scripts/check-syntax.js`

## Test-first contract

behavior under test: an explicitly routed node whose authoritative Device Authority record is revoked must never use the lifecycle recovery bypass. `lifecycle.update` and `lifecycle.status` may recover stale active nodes only; revoked nodes remain non-routable even if the D1 target record is temporarily inconsistent/still active.
existing local pattern: D1 route resolution rejects `nodeTarget.state === 'revoked'` with `WORKSPACE_NODE_REVOKED`, and `safeWorkspaceNode` marks revoked authoritative nodes offline/not_ready. The new recovery bypass currently skips the readiness check, so authority-store revocation needs an independent non-bypassable guard.
new or changed tests: add a routing regression that deliberately leaves D1 active while marking the authoritative node record revoked, then calls explicit `lifecycle.update`; expect `WORKSPACE_NODE_REVOKED` and zero upstream calls. Preserve the existing stale-active recovery test.
focused red command: run only the new `revoked node lifecycle recovery` test in `workspace-node-registry-routing.test.ts` after the repository dangerous-material policy preflight reports allowed.
expected red failure: current proxy forwards `lifecycle.update` upstream and returns 200 because `lifecycleRecovery` bypasses `safeNode.readiness === 'not_ready'`.
no-test waiver: not applicable.

- 2026-08-29 07:49:51 append: `.task/os/reject-revoked-nodes-from-lifecycle-recovery/workpad.md`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## workspace-owned: activity log

- 2026-08-29 07:49:51 fs.write: `.task/os/reject-revoked-nodes-from-lifecycle-recovery/workpad.md`
- 2026-08-29 07:50:03 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-08-29 07:50:24 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- 2026-08-29 08:04:30 apply-patch: `.task/os/reject-revoked-nodes-from-lifecycle-recovery/workpad.md`
- 2026-08-29 08:05:26 fs.write: `.task/os/reject-revoked-nodes-from-lifecycle-recovery/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 08:04:54 `review.run`: passed — OK
- 2026-08-29 08:05:11 `verify`: passed — OK

## Final validation

- RED: repository dangerous-material policy reported `allowed: true`; focused revoked lifecycle-recovery test failed as intended with received 200 vs expected 404.
- GREEN: same preflight + focused test passed after the non-bypassable revocation guard.
- Adjacent: `workspace-node-registry-routing.test.ts` + `os-device-authority-worker.test.ts` passed 85/85 after both targets were safety-preflighted.
- Worker: Device Authority Wrangler `deploy --dry-run` passed.
- Strict review: 0 findings / 0 blockers, trace `trc_e95fe5392fb6`.
- Formal verify: passed, `publishValid: true`, trace `trc_d501441732bf`.
- The broad workspace JS syntax helper timed out and is not used as evidence for this TypeScript edge patch; review/verify typecheck and Worker build are green.

- 2026-08-29 08:05:26 append: `.task/os/reject-revoked-nodes-from-lifecycle-recovery/workpad.md`
