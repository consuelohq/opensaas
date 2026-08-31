# reconcile existing managed cloud node work with current OS architecture

branch: `task/os/reconcile-existing-managed-cloud-node-work-with-current-os-architecture`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1876
started: 2026-08-12

## acceptance criteria

- [x] Compare current `stream/os` with `stream/os-cloud` and the managed-cloud provisioning task branch.
- [x] Classify cloud work as integrated/current, valid historical evidence, obsolete/superseded, or future work.
- [x] Identify whether any old production code must be ported.
- [x] Identify install/cutover prerequisites for the existing cloud node without mutating live infrastructure.
- [x] Record the safe merge/port order for later cloud work.
- [x] Make no live VM, Cloudflare, GCP, installed-runtime, or Mac-node changes.

## plan

1. Inventory current canonical OS cloud/node/runtime architecture on `stream/os`.
2. Inventory `stream/os-cloud` and related managed-cloud task branches/commits.
3. Compare provisioning, enrollment, runtime bundle, Caddy/worker lifecycle, node routing/heartbeat, persistence, security, installer, and observability surfaces.
4. Classify the old deltas and record canary prerequisites.
5. Validate that only task documentation/metadata changed.

## Test-first contract

- No-test waiver: this task is a repository reconciliation/audit and intentionally changes no production behavior.
- Replacement validation: branch/file ancestry and diffs, targeted source reads, working-tree diff inspection, `git diff --check`, and workspace review with tests disabled.

## current status

- Reconciliation complete.
- `stream/os-cloud` is 336 commits behind current `stream/os`; the old provisioning branch is also based on that July-era architecture.
- Current `stream/os` already contains newer implementations of the substantive managed-cloud runtime work.
- No direct old-branch production-code port is recommended.
- No live infrastructure or installed node was changed.

## reconciliation result

### Executive verdict

- `stream/os-cloud` is archival evidence, not an integration target.
- Do **not** merge or cherry-pick PR #1706 or the old cloud stream wholesale.
- Current `stream/os` is authoritative for managed-node provisioning, enrollment, release delivery, Linux runtime lifecycle, workspace-node routing, worker supervision, and Caddy load balancing.
- The old cloud task is still useful as a historical failure log and later canary checklist.

### Already integrated — current stream/os is authoritative

- Managed-node plan/apply and GCP describe-before-create/drift-safe adapter.
- Router/NAT egress, no-public-IP + Shielded VM policy, retained data disk, and snapshot plans.
- GCE metadata authentication for private signed releases.
- Runtime-bundle executable closure and PATH-safe digest release directories.
- Linux user-home vs Consuelo data-home separation.
- Managed-node enrollment, durable device-key continuity, durable workspace identity, and provisional-node rollback.
- Workspace-node registry, heartbeat, D1 route substrate, and connector registration.
- Current Linux runtime starts `scripts/server/supervisor.ts`; current Caddy supports multiple upstreams, round robin, and `/ready`. These supersede the old single-process assumptions.

### Valid decisions/evidence to retain

- Keep one managed-node provisioning stack; the future product UI should call the existing platform-managed application service.
- Reuse workspace-node grants, heartbeat, D1 routes, and node registry rather than a cloud-only registry.
- VM/boot disk are replaceable; the durable data disk is retained by default and ordinary node removal must not delete it.
- No public IPv4; use IAP/OS Login-compatible administration.
- Bootstrap uses instance/service identity plus approved device enrollment, with no long-lived service-account key embedded.
- Private GCS release delivery, NAT egress, signed runtime verification, deterministic region/zone planning, and snapshot policies remain correct foundations.

- 2026-08-12 03:57:19 write: `.task/os/reconcile-existing-managed-cloud-node-work-with-current-os-architecture/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- `stream/os-cloud` as a long-lived product stream; new cloud work converges on `stream/os`.
- 2026-08-12 03:57:19 fs.write: `.task/os/reconcile-existing-managed-cloud-node-work-with-current-os-architecture/workpad.md`
- 2026-08-12 03:57:38 append: `.task/os/reconcile-existing-managed-cloud-node-work-with-current-os-architecture/workpad.md`
- 2026-08-12 03:57:38 fs.write: `.task/os/reconcile-existing-managed-cloud-node-work-with-current-os-architecture/workpad.md`
- 2026-08-12 03:57:42 append: `.task/os/reconcile-existing-managed-cloud-node-work-with-current-os-architecture/workpad.md`
- 2026-08-12 03:57:42 fs.write: `.task/os/reconcile-existing-managed-cloud-node-work-with-current-os-architecture/workpad.md`
- A separate cloud registry, sticky MCP routing, or cloud-specific MCP transport.
- Old runtime bundles, signed artifacts, or July branch heads as install sources.
- Old single-process runtime/Caddy assumptions; current supervisor and worker-pool gateway are authoritative.
- Stale live-repair instructions; reread live state at canary time.
- Treating local `--mode cloud` as customer provisioning; the old branch never implemented one-click/cloud-first onboarding.

## workspace-owned: validation evidence

- 2026-08-12 03:59:38 `review.run`: passed — OK
