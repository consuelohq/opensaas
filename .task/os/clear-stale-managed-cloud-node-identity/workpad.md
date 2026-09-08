# clear stale managed cloud node identity

branch: `task/os/clear-stale-managed-cloud-node-identity`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2407
started: 2026-09-08

## acceptance criteria

- [x] Deleting a managed-cloud workspace node clears only the live nodeId -> provisioning-job binding and preserves historical job-by-id state.
- [x] Successful explicit device-key replacement clears the stale managed-cloud binding before approval returns.
- [x] Same-key re-registration preserves managed-cloud eligibility.
- [x] Failed route setup or managed-cloud binding cleanup can roll the previous node identity back without losing the existing binding.
- [x] Existing lifecycle routing/revocation behavior remains green.
- [x] Scoped strict review and formal verify pass before publish.

## plan

1. Prove stale managed-cloud binding survives deletion/rotation (RED).
2. Clear the live binding transactionally on node deletion and at the end of successful rotation commit.
3. Keep commit inside the existing route rollback envelope so cleanup failures restore the previous identity.
4. Run focused identity/deletion tests, lifecycle recovery tests, affected auth/Device Authority suite, Worker dry-run, strict review, and formal verify.

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/tests/managed-cloud-one-click-provisioning.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`


## key decisions

- Keep the immutable provisioning job as historical/audit state; invalidate only the live `mcpjn:<nodeId>` eligibility index.
- Delete the live binding inside the same durable node-deletion transaction used by `delWorkspaceNode` / `delWorkspaceNodeIfMatch`.
- For identity replacement, invalidate only after every other grant-commit write succeeds. If invalidation itself fails, the route-level catch restores the retained previous identity.
- Ordinary same-key reconnects do not set `nodeIdentityRotatedAt`, so they keep the live managed-cloud binding.
- A reprovisioned cloud VM starts from the current provisioning/install path; clearing the old identity's legacy-recovery eligibility is correct. A new managed-cloud provisioning job can establish a fresh node binding.
- Preserve Google OAuth's original one-time-state-before-commit ordering while moving both operations inside the rollback envelope.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- Initial large production patch failed closed because a `stores.ts` hunk no longer matched. Retried as small targeted patches after exact range reads; no partial production edit was applied by the failed patch.
- First cleanup-failure rollback assertion expected the durable-store wrapper message, but the injected memory-store override surfaced its direct injected message. Tightened the test assertion; product behavior was already correct.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: managed-cloud eligibility is bound to the current workspace-node identity lifecycle. Deleting a managed-cloud workspace node or explicitly replacing its identity clears the nodeId -> managed-cloud provisioning index, so a later non-GCE installation reusing the nodeId cannot enter the legacy GCP recovery bridge. Ordinary re-registration of the same identity must preserve managed-cloud eligibility.
existing local pattern: Device Authority stores managed-cloud job records separately from a durable `mcpjn:<nodeId>` index. The proxy now authorizes legacy recovery from that index plus tenant/workspace fields. Current node deletion/replacement paths do not clear the index, while grant registration supports explicit nodeId reuse/identity replacement.
new or changed tests: add store/registration tests proving (1) deleting a managed-cloud node clears lookup by nodeId but preserves historical job-by-id, (2) explicit identity replacement clears nodeId managed-cloud lookup, and (3) same-identity re-registration preserves it. Keep lifecycle routing coverage proving only a live managed-cloud identity rewrites.
focused red command: run the narrow managed-cloud/node registry tests after canonical destructive-literal source-safety preflight.
expected red failure: after node deletion or identity replacement, `byManagedCloudProvisioningNode(nodeId)` still resolves the historical job because `mcpjn:<nodeId>` is not cleared.
no-test waiver: not applicable.

## TDD / validation evidence

- Canonical destructive-literal source safety: 1/1 pass; latest trace `trc_1083dda80bd8`.
- RED: identity-replacement test failed exactly because `byManagedCloudProvisioningNode(nodeId)` still resolved the historical managed-cloud job after successful rotation; trace `trc_3fc59519f50d`.
- Focused GREEN: 6/6 identity/deletion/rollback cases, including durable unconditional/conditional deletion and injected cleanup-failure rollback; trace `trc_1d3641e03500`.
- Managed-cloud one-click provisioning: 4/4; node deletion clears the live binding while job-by-id remains; trace `trc_2e23a5ed2149`.
- Lifecycle recovery contract remains 8/8; trace `trc_40a4a8bbb91c`.
- Universal login/device auth/cloud enrollment: 22/22; trace `trc_9ed39500c22d`.
- Device Authority architecture/auth contracts: 26/26 active tests, 10 environment-gated contract cases skipped as designed; trace `trc_a96e34d29a0c`.
- Final affected boundary: 131/131 across routing, MCP scope, session.start, Device Authority architecture, managed-cloud provisioning, universal login, device status, and managed-cloud enrollment; trace `trc_7f95a7be45ae`.
- Final Device Authority Wrangler dry-run: 622.69 KiB / 126.31 KiB gzip, production bindings resolved; trace `trc_b3a8ab1b3e41`.
- Scoped strict review: 7 files, 0 blocking/pre-existing/documentation issues; trace `trc_2d55cdee2d9b`.
- Formal verify against `origin/stream/os`: `publishValid: true`, 7 files, review green, DB gate green; trace `trc_7e44f300bef6`.

- 2026-09-08 03:28:38 append: `.task/os/clear-stale-managed-cloud-node-identity/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 03:28:38 fs.write: `.task/os/clear-stale-managed-cloud-node-identity/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/scripts/lib/managed-cloud-provisioning.ts`
- `packages/os/tests/gateway-placeholder-workspace-auth.test.ts`
- `packages/os/tests/managed-cloud-one-click-provisioning.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 03:36:49 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`

- 2026-09-08 03:37:13 apply-patch: `.task/os/clear-stale-managed-cloud-node-identity/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 03:37:38 `review.run`: passed — OK
- 2026-09-08 03:38:31 `verify`: passed — OK

- 2026-09-08 03:38:39 apply-patch: `.task/os/clear-stale-managed-cloud-node-identity/workpad.md`