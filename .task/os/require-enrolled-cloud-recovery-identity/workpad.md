# require enrolled cloud recovery identity

branch: `task/os/require-enrolled-cloud-recovery-identity`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2408
started: 2026-09-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
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

behavior under test: stale explicit lifecycle.update enters the legacy managed-cloud GCP bootstrap only when the authoritative provisioning job represents a node that actually completed the one-time cloud enrollment lifecycle. Jobs that are merely created/provisioning/booting or terminal failed must preserve the normal typed lifecycle path even if their stale nodeId index still exists.
existing local pattern: `consumeManagedCloudProvisioningEnrollment` is the unique transition into `connecting`; it sets `enrollmentConsumedAt`. `markManagedCloudProvisioningReadyByNode` transitions a non-terminal enrolled job to `ready`. Failed jobs are terminal and keep the historical `mcpjn:<nodeId>` index. The proxy currently checks matching node/account/workspace/host only, so a failed pre-enrollment job can falsely authorize the legacy GCP rewrite.
new or changed tests: seed a same-tenant failed managed-cloud job for a stale explicitly routed node and prove lifecycle.update remains typed; keep existing managed connecting/ready rewrite, stale non-managed typed, tenant mismatch typed, invalid input, compatible, and revoked cases. Prefer status eligibility `connecting|ready`, because `connecting` is created only by successful enrollment consumption and `ready` is durable heartbeat confirmation.
focused red command: `bun run --cwd packages/os test -- tests/workspace-node-registry-routing.test.ts -t lifecycle` after canonical destructive-literal source-safety preflight.
expected red failure: the new failed-job case forwards `mac.call` instead of unchanged `lifecycle.update` because the current predicate ignores provisioning status.
no-test waiver: not applicable.

## TDD / validation evidence

- Source-safety preflight before RED: 1/1 pass, trace `trc_597ae89cfd5c`; final source-safety rerun after implementation: 1/1, trace `trc_3809c3d50747`.
- RED: lifecycle target failed exactly one new case because a same-tenant managed-cloud job in terminal `failed` state still authorized the `mac.call` rewrite; 8 other lifecycle cases passed. Trace `trc_e98065d9fe91`.
- Implementation: legacy managed-cloud eligibility now additionally requires provisioning status `connecting` or `ready`. `connecting` is set only by successful one-time enrollment consumption; `ready` is durable node readiness. Created/provisioning/booting/failed jobs cannot authorize the bridge even if a historical nodeId index remains.
- Focused GREEN: lifecycle routing 9/9. The primary stale-cloud recovery case now seeds an enrolled `connecting` job to prove recovery remains available before ready heartbeat; failed pre-enrollment remains typed. Trace `trc_ed1323e99d9d`.
- Final affected boundary: 132/132 across workspace routing, MCP scope, session.start, Device Authority architecture, managed-cloud provisioning, universal login, device status, and managed-cloud enrollment; trace `trc_448c684a82bd`.
- Final Device Authority Wrangler dry-run passed: 622.79 KiB / 126.32 KiB gzip with production bindings resolved; trace `trc_b4e8f8aa70be`.
- Scoped strict review passed with 0 issues; trace `trc_aeedce01aedb`.
- Formal verify against `origin/stream/os` passed with `publishValid: true`, exactly 2 product/test files in scope, review green, and DB gate green; trace `trc_95cff7c3a2e5`.

- 2026-09-08 03:48:14 append: `.task/os/require-enrolled-cloud-recovery-identity/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 03:48:14 fs.write: `.task/os/require-enrolled-cloud-recovery-identity/workpad.md`

- 2026-09-08 03:48:37 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`

- 2026-09-08 03:48:57 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- 2026-09-08 03:49:03 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 03:49:28 apply-patch: `.task/os/require-enrolled-cloud-recovery-identity/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 03:49:54 `review.run`: passed — OK
- 2026-09-08 03:50:08 `verify`: passed — OK

- 2026-09-08 03:50:15 apply-patch: `.task/os/require-enrolled-cloud-recovery-identity/workpad.md`