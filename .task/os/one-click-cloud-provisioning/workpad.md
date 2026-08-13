# Branch 12 — One-click cloud provisioning

## Goal
Ship a real customer-facing `Create cloud node` flow from the existing Nodes launcher surface. Reuse the existing managed-GCP pricing and provisioning application services, support a workspace whose first/only node is cloud, and preserve the warm editorial launcher language. Do not deploy or mutate live GCP infrastructure in this task.

## Acceptance criteria
- [x] Authenticated launcher users can create a managed-cloud provisioning request from `/nodes` with plan + region only; provider machine identifiers and credentials remain private.
- [x] The central authority re-derives the selected public quote server-side, rejects invalid/stale plan or pricing revisions, and never trusts client-supplied machine type or price.
- [x] Provision creation is idempotent and duplicate browser retries cannot create duplicate billable nodes; a workspace cannot accidentally start multiple active jobs for the same request.
- [x] Provisioning jobs are durable, expose only safe customer state, and move through explicit lifecycle states (`requested`, `provisioning`, `booting`, `connecting`, `ready`, `failed`).
- [x] A trusted executor API can atomically claim a queued job, renew/complete/fail it, and no GCP credential is exposed to the browser or stored in a public node DTO.
- [x] The trusted executor reuses `provisionManagedCloudNode` / platform-managed GCP services; tests inject fakes and never invoke live `gcloud`.
- [x] One-click enrollment requires no second device-consent step: the VM generates its device key, exchanges a short-lived one-time provisioning enrollment credential with the central authority, and receives its workspace/connector bootstrap.
- [x] A first cloud node becomes the workspace home/default only after successful enrollment/readiness; an additional cloud node does not steal the existing default.
- [x] The Nodes dialog enables `Create cloud node`, shows user-facing plan name, CPU, RAM, region and monthly price, and shows progressive status without exposing GCP machine types/provider cost.
- [x] UI follows the existing warm-editorial launcher tokens (`#faf7f2`, serif-led hierarchy, terracotta accent, restrained rules/chrome), has accessible focus/aria-live/loading/error states, responsive plan layout, and works in dark mode.
- [x] Existing node listing/default selection/pricing, task routing, auth/security, and managed-cloud plan tests remain green.
- [x] No live cloud node update, GCP apply, release publication, or Sites/update reconciliation is performed in Branch 12.

## Architecture
1. `/nodes` POSTs plan/region/pricingRevision + idempotency key to a browser-session + CSRF protected node provisioning route.
2. Device Authority validates the workspace session and recomputes the current quote from the private pricing catalog.
3. Authority creates/reuses one durable provisioning job and one short-lived enrollment secret; only the secret hash is stored centrally.
4. A trusted provisioning runner (outside Cloudflare) claims queued jobs via an internal-auth endpoint. It owns Consuelo GCP project/release configuration and maps public plan IDs to private machine types.
5. Runner calls the existing `provisionManagedCloudNode` service. Startup receives only the one-time enrollment secret plus non-secret workspace/node identity.
6. The new VM generates its own Ed25519 device key and exchanges the one-time secret + public key with Device Authority. Authority provisions the existing Cloudflare connector/route, registers the node, returns the normal workspace bootstrap, and consumes the enrollment credential.
7. Heartbeat/registration transitions the job to ready. If no prior workspace node/default exists, the new node becomes home/default; otherwise the current default remains unchanged.
8. Nodes UI polls a safe job-status endpoint and renders requested → provisioning → booting → connecting → ready / failed.

## Test-first contract
RED before production implementation:
- [x] authority provisioning API: auth + CSRF required; invalid plan/region/revision rejected; duplicate idempotency key returns same job; duplicate active create cannot produce two jobs; public response excludes machineType/provider cost/secrets.
- [x] durable job store: atomic claim; second executor cannot claim active lease; completion/failure state transitions validated; expired lease is recoverable.
- [x] enrollment exchange: invalid/expired/replayed secret rejected; device public key is required; successful exchange creates connector/node bootstrap once; secret is consumed; first node gets home/default, subsequent node does not replace default.
- [x] executor: public plan maps server-side to private machine type and calls existing managed-cloud provisioner with injected fake client; no live gcloud in tests.
- [x] workspace-edge proxy: `/gateway/nodes/provision` and status route preserve browser session/CSRF semantics.
- [x] launcher materialization: no `Provisioning coming soon`; button activates only after pricing; payload contains plan/region/pricing version/idempotency; progress/error UI exists; generated HTML never contains `e2-standard-*` or provider cost fields.

## Validation plan
- Targeted Bun tests for provisioning contract/store/executor/Nodes materialization.
- Existing managed-cloud pricing, managed-cloud node instance/platform, launcher-nodes control plane/materialization/settings-site tests.
- Existing workspace-node registry/security tests touching default/home/connector bootstrap.
- Browser validation of generated Nodes page at desktop + narrow viewport in light/dark presentation if the repository browser harness is available.
- `git diff --check`, changed-file check, strict review, task verify before publication.

## Validation evidence
- 19 Branch 12 launcher/provisioning tests passed across `managed-cloud-one-click-provisioning`, `managed-cloud-one-click-runner`, `launcher-nodes-control-plane`, and `settings-site`.
- 21 existing managed-cloud enrollment/instance/platform tests passed.
- 37 Device Authority architecture/release/readiness tests passed.
- `os-device-authority-worker.test.ts`: 26/26 passed under its native Vitest runner. An earlier Bun invocation failed only because Bun does not implement Vitest `vi.stubGlobal`/`vi.unstubAllGlobals`.
- Broader managed-cloud pricing/GCP/foundation regression suites passed before the Vitest-runner mismatch stopped that batch.
- `git diff --check` passed.
- Changed production TypeScript passed the repository `check-files` syntax gate.
- No live Cloudflare Worker, provisioning runner, GCP VM, release, or node was mutated.
- Strict repository review passed with 0 blocking findings after fixing all five async error-boundary findings.
- Full `verify` review + DB gates pass, but publish-valid verification is currently blocked by the unchanged `packages/os/tests/operator-login.test.ts`: all 17 assertions pass, while Vitest exits 1 because three callback-rejection promises are handled late and reported as unhandled rejections. `git diff --quiet origin/stream/os -- packages/os/scripts/lib/operator-login.ts packages/os/tests/operator-login.test.ts` confirms Branch 12 does not touch that code.

## Scope boundaries
- Branch 12 does **not** fix `consuelo update` → hosted Sites reconciliation. That is the next approved fix so one final release can contain both.
- Branch 12 does **not** deploy the global control plane or existing cloud VM.
- Branch 12 does **not** redesign pricing; the merged pricing engine/catalog is authoritative.
- Branch 12 does **not** build multi-provider provisioning.

## Research / decisions
- Task PR #1910 already existed from `main`; before production edits the task was merged with current `origin/stream/os` to avoid implementing against stale launcher/runtime contracts.
- Existing Nodes UI and pricing catalog are already merged; `settings-site.ts` still ships a disabled `Provisioning coming soon` button.
- Existing managed-GCP CLI explicitly states `apply` uses the same application service intended for the future product UI. Reuse it.
- `gcloud` execution is process-local and cannot run inside a Cloudflare Worker, so provisioning execution must be outside the authority Worker.
- Existing device-code enrollment is interactive and therefore wrong for one-click. A one-time provisioning enrollment credential preserves VM-generated device keys without asking the user to authorize the node twice.
- Warm-editorial reference aligns with current launcher tokens. Public `packages/consuelo-website/DESIGN.md` is a different blue marketing system; do not restyle launcher to that system in this task.

## Issues / recovery
- Initial task had been created from `main`; synced `origin/stream/os` before production edits.
- One `code.call` sync attempt used an outer timeout in milliseconds too small; retry with the intended timeout succeeded.
- A broad `bun test` invocation included a Vitest-only suite; its failures were only missing `vi.stubGlobal`/`vi.unstubAllGlobals`. Re-running that suite with `vitest` passed 26/26.
- The repository has no `packages/os/tsconfig.json`; a direct `tsc -p` attempt failed on the nonexistent path. Repository syntax checks and executable test imports are used instead.
- Full publish verification is blocked by a pre-existing `operator-login` Vitest unhandled-rejection defect on the current stream. Branch 12 targeted/regression suites and strict review are green; do not merge to `stream/os` until that external gate is repaired and `verify` is rerun.
- Repository `explore` index failed after stream sync for a few queries; switched to bounded exact source reads. No product edits resulted from either issue.
- First workpad overwrite attempt omitted `force`; retried with `force: true`.

## Changelog
- 2026-08-13: Resumed existing Branch 12 task, synced current `stream/os`, read Senior Engineer + design guidance, audited Nodes/pricing/provisioning/enrollment/control-plane seams, and froze the one-click provisioning architecture.
- 2026-08-13: Implemented customer provisioning jobs, browser + CSRF creation/status routes, trusted executor claim/state routes, one-time VM auto-enrollment, first-node home/default behavior, existing GCP service reuse, warm-editorial Nodes progress UI, release-secret readiness, heartbeat-to-ready transition, and retry/idempotency hardening.

- 2026-08-13 18:37:51 write: `.task/os/one-click-cloud-provisioning/workpad.md`

## files changed

- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`


## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts`
- `packages/os/scripts/lib/managed-cloud-provisioning-runner.ts`
- `packages/os/scripts/lib/managed-cloud-provisioning.ts`
- `packages/os/scripts/managed-cloud-provisioning-runner.ts`
- `packages/os/tests/managed-cloud-one-click-runner.test.ts`

## workspace-owned: activity log

- 2026-08-13 18:37:51 fs.write: `.task/os/one-click-cloud-provisioning/workpad.md`
- 2026-08-13 18:41:00 write: `packages/os/scripts/lib/managed-cloud-provisioning.ts`
- 2026-08-13 18:41:00 fs.write: `packages/os/scripts/lib/managed-cloud-provisioning.ts`
- 2026-08-13 18:47:44 write: `packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts`
- 2026-08-13 18:47:44 fs.write: `packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts`
- 2026-08-13 18:51:31 write: `packages/os/scripts/lib/managed-cloud-provisioning-runner.ts`
- 2026-08-13 18:51:31 fs.write: `packages/os/scripts/lib/managed-cloud-provisioning-runner.ts`
- 2026-08-13 18:51:52 write: `packages/os/tests/managed-cloud-one-click-runner.test.ts`
- 2026-08-13 18:51:52 fs.write: `packages/os/tests/managed-cloud-one-click-runner.test.ts`
- 2026-08-13 18:52:14 write: `packages/os/scripts/managed-cloud-provisioning-runner.ts`
- 2026-08-13 18:52:14 fs.write: `packages/os/scripts/managed-cloud-provisioning-runner.ts`

## workspace-owned: validation evidence

- 2026-08-13 18:57:55 `review.run`: passed — OK
- 2026-08-13 18:59:04 `review.run`: passed — OK
- 2026-08-13 19:00:04 `verify`: failed — COMMAND_FAILED
