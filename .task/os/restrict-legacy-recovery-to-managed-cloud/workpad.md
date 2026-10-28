# restrict legacy recovery to managed cloud

branch: `task/os/restrict-legacy-recovery-to-managed-cloud`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2406
started: 2026-09-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/tests/managed-cloud-one-click-provisioning.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`


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

behavior under test: Device Authority rewrites stale explicit lifecycle.update to the fixed legacy GCP bootstrap only when the routed node has authoritative managed-cloud provisioning identity; stale non-managed nodes keep the normal typed lifecycle.update path, compatible nodes remain typed, and revoked nodes remain blocked.
existing local pattern: managed-cloud provisioning jobs are indexed durably by nodeId in Device Authority storage; the current store exposes by-job-id and mark-ready-by-node but no pure read-by-node method. The stream recovery patch currently rewrites any incompatible explicit lifecycle.update, which Codex correctly flagged as unsafe for stale desktop/non-GCE nodes.
new or changed tests: seed a managed-cloud provisioning job for stale bridge tests; add a stale non-managed lifecycle.update preservation case; keep compatible no-rewrite, revoked fail-closed, invalid caller input, and invalid release metadata cases. Add store coverage for authoritative read-by-node if existing store tests do not already exercise the index.
focused red command: bun run --cwd packages/os test -- tests/workspace-node-registry-routing.test.ts -t lifecycle
expected red failure: the new stale non-managed case forwards mac.call/GCP bootstrap instead of unchanged lifecycle.update because current stream code gates only on compatibility, not managed-cloud identity.
no-test waiver: not applicable.

## TDD evidence

- Source-safety preflight passed before the focused target: `bun test packages/os/tests/test-source-safety.test.ts` -> 1/1.
- RED: canonical lifecycle target failed exactly one new case because stale non-managed `lifecycle.update` was rewritten to `mac.call`; the other 6 lifecycle cases passed. Trace: `trc_eca12213673a`.
- Implementation: added authoritative `byManagedCloudProvisioningNode(nodeId)` lookup to both durable and memory stores; legacy rewrite now requires matching nodeId, accountId, workspaceId, and workspaceHost.
- GREEN: canonical lifecycle target -> 7/7; managed-cloud one-click provisioning -> 4/4, including node-index lookup before and after ready transition. Traces: `trc_f1a110199d0c`, `trc_05a182bda0ef`.
- Non-managed stale nodes preserve the typed lifecycle request and routing-only nodeId stripping. Compatible and revoked behavior remain covered by the existing lifecycle target.
- Added a tenant-mismatch case: a managed-cloud node index entry for the same nodeId but a different account/workspace does not authorize the legacy rewrite. Final lifecycle target -> 8/8; trace `trc_ef5ab7aab51d`.
- Full affected canonical Vitest boundary suite -> 104/104 across workspace routing, MCP scope, session.start foundation, and Device Authority architecture; trace `trc_71a363c75f53`.
- Managed-cloud one-click provisioning -> 4/4 under Bun, including authoritative node lookup surviving the ready transition; trace `trc_bcd57e5dda40`.
- Device Authority Wrangler dry-run passed: 622.16 KiB / 126.27 KiB gzip; trace `trc_7d8302c66a11`.
- Scoped strict review passed with 0 blocking issues; trace `trc_b569560dff04`.
- Formal verify against `origin/stream/os` passed with `publishValid: true`, 5 files in scope, 0 blocking issues, DB gate green; trace `trc_df1644baac1a`.
- The MCP docs opportunity is non-blocking and this change narrows an internal compatibility bootstrap; it does not add a new caller-facing MCP contract.

- 2026-09-08 03:16:21 append: `.task/os/restrict-legacy-recovery-to-managed-cloud/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 03:16:21 fs.write: `.task/os/restrict-legacy-recovery-to-managed-cloud/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/scripts/lib/managed-cloud-pricing.ts`
- `packages/os/tests/managed-cloud-one-click-provisioning.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 03:17:43 apply-patch: `packages/os/cloudflare/os-device-authority/src/types.ts`
- 2026-09-08 03:17:43 apply-patch: `packages/os/cloudflare/os-device-authority/src/stores.ts`
- 2026-09-08 03:17:43 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- 2026-09-08 03:17:43 apply-patch: `packages/os/tests/managed-cloud-one-click-provisioning.test.ts`

- 2026-09-08 03:18:09 apply-patch: `.task/os/restrict-legacy-recovery-to-managed-cloud/workpad.md`
- 2026-09-08 03:18:19 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 03:18:49 apply-patch: `.task/os/restrict-legacy-recovery-to-managed-cloud/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 03:19:14 `review.run`: passed — OK
- 2026-09-08 03:19:33 `verify`: passed — OK

- 2026-09-08 03:19:38 apply-patch: `.task/os/restrict-legacy-recovery-to-managed-cloud/workpad.md`