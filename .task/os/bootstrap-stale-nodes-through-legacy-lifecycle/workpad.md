# Bootstrap stale nodes through legacy lifecycle

branch: `task/os/bootstrap-stale-nodes-through-legacy-lifecycle`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2305/bootstrap-stale-nodes-through-legacy-lifecycle
github pr: https://github.com/consuelohq/opensaas/pull/2305
started: 2026-09-08

## acceptance criteria

- [ ] An active stale explicit node can invoke the narrow recovery path without `UNKNOWN_TOOL_SCOPE`.
- [x] Recovery uses only validated lifecycle metadata; no caller-controlled arbitrary host command is exposed.
- [x] Revoked nodes remain blocked and ordinary tools remain blocked on incompatible/not-ready explicit nodes.
- [x] Compatible modern nodes keep normal typed `lifecycle.update` behavior.
- [x] Release trust/base URL requirements are proven for legacy managed-cloud nodes before shipping.
- [x] Exact-version support is used only if the historical lifecycle CLI actually supports it.
- [x] Update/restart is proven to converge onto stable `runtime/current`, not the old immutable code root.
- [ ] Focused routing tests, affected Device Authority tests, Worker dry-run, strict review, and formal verify pass before publish.
- [x] Focused routing tests, affected Device Authority tests, Worker dry-run, strict review, and formal verify pass before publish.
- [ ] After deploy, direct top-level `nodeId: "cloud-1"` calls prove modern lifecycle status/readiness and `session.start` dry-run.

## plan

1. Recover and inspect the evicted task checkpoint without restoring stale task metadata.
2. Verify historical/current lifecycle CLI arguments, trust material persistence, managed-cloud service environment, and restart target path.
3. Choose the narrowest safe compatibility bootstrap based on that evidence.
4. Restore/adapt only the production/test changes needed for the final design; preserve TDD red/green evidence.
5. Run affected validation and publish task -> stream/os -> main, deploy Device Authority, then perform direct cloud-1 smoke tests.

## current status

- Original task session was evicted; `task.start --pr 2305` safely recreated the worktree and reactivated `tsk_5b900ab174b0`.
- Recovery checkpoint `23e14935842a9ee99853a5494ae4c8d0c4a50038` preserves the prior dirty work: `mcp-proxy.ts`, `workspace-node-registry-routing.test.ts`, and task logs/workpad.
- Direct explicit `lifecycle.status` to `cloud-1` still returns `UNKNOWN_TOOL_SCOPE`, confirming the stale runtime remains live.
- The task now contains the accepted narrow bridge: only stale explicit `lifecycle.update` is rewritten to fixed legacy `mac.call`; compatible nodes remain typed.
- The legacy bridge recovers release origin/public keys only from the VM's infrastructure-owned GCP startup metadata, validates the exact managed-cloud GCS/key contract, persists `runtime/trusted-release-keys.json` atomically, then invokes the historical lifecycle updater with argv.
- Historical release audit: `mac.call`, lifecycle `update`, `--channel`, `--yes`, and `--json` exist from 0.1.1; lifecycle facade tools first appear at 0.1.37; lifecycle `--version` first appears at 0.1.72. Stale exact-version requests therefore fail closed before upstream forwarding.
- Managed-cloud startup has embedded `CONSUELO_RELEASE_BASE_URL` and `CONSUELO_RELEASE_PUBLIC_KEYS_JSON` since at least 0.1.8, but did not persist them into steady-state systemd. GCP instance startup metadata is the durable original trust source reused by this bridge; no new long-lived secret/trust channel is added.
- Historical lifecycle activation repoints `runtime/current` before service restart, and managed-cloud systemd starts from `runtime/current`, so successful update converges onto the modern runtime rather than the old immutable bootstrap bundle.
- Current stable is 0.1.86 and repository release variable `CONSUELO_OS_MINIMUM_UPDATER_VERSION` is 0.1.0, so the pre-facade updater is permitted to consume current stable.

## Test-first contract

behavior under test: an explicitly routed active stale managed-cloud node whose manifest predates lifecycle facade tools can recover to a modern runtime through one narrow compatibility path while revocation/readiness gates remain fail-closed.
existing local pattern: Device Authority already recognizes explicit lifecycle recovery tools, strips routing-only `nodeId`, and blocks ordinary tools on stale/revoked nodes. Historical runtimes include legacy `mac.call` plus lifecycle/reload scripts, but the exact lifecycle CLI/trust/service contract must be verified before selecting the bridge.
new or changed tests: preserve the lifecycle routing cases in `workspace-node-registry-routing.test.ts`; adapt them to the proven final primitive; cover injection-shaped lifecycle metadata, invalid release metadata failing before upstream contact, revoked nodes, compatible no-rewrite behavior, and routing-only nodeId stripping.
focused red command: run the final new lifecycle-bootstrap routing case after dangerous-literal preflight; before production implementation it must fail on current Device Authority behavior.
expected red failure: stale explicit lifecycle recovery is forwarded as a typed lifecycle tool and an old node rejects it with `UNKNOWN_TOOL_SCOPE`; once the final bridge contract is encoded, the focused test should fail because the bridge is absent.
no-test waiver: not applicable.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`


## workspace-owned: files changed

- `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

## workspace-owned: activity log

- 2026-09-08 02:31:42 fs.write: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

## workspace-owned: validation evidence

- canonical destructive-literal source safety preflight: `bun test packages/os/tests/test-source-safety.test.ts` -> 1/1 pass.
- TDD RED: lifecycle routing target initially failed because stale update still forwarded `lifecycle.update` and stale exact-version was accepted.
- focused GREEN: canonical Vitest lifecycle target -> 6/6 pass, including stale rewrite, invalid caller input, two invalid managed-cloud release-metadata cases, compatible no-rewrite, and revoked-node denial.
- mocked invalid release metadata proves untrusted GCS origin/private key material exits before the fake legacy lifecycle child runs and before a trust file is written.
- affected Device Authority boundary suite: 102/102 pass across `workspace-node-registry-routing`, `mcp-central-proxy-scope`, `session-start-foundation`, and `os-device-authority-architecture`.
- Device Authority Worker dry-run: Wrangler 4.114.0 bundles successfully, 621.35 KiB / 126.16 KiB gzip.
- generated inline bootstrap syntax was parsed successfully under Bun during focused validation; permanent tests remain runner-agnostic under canonical Vitest.
- strict repo-wide review run `5327456a0582e9eedcfff69bbd267d6c94806cc30c39dc63bf4f1ab32520de94` completed successfully with exit code 0 after the client transport 502.
- formal `verify` against `origin/stream/os`: passed, `publishValid: true`, exactly 2 product/test files in scope, 0 blocking issues, DB gate passed; trace `trc_c44f5333072f`.
- 2026-09-08 03:02:16 `review.run`: failed — COMMAND_FAILED
- 2026-09-08 03:04:12 `review.run`: passed — OK
- 2026-09-08 03:06:42 `verify`: passed — OK

## key decisions

- Do not trust nested batch routing as cloud evidence; only direct top-level `nodeId: "cloud-1"` calls count.
- Do not restore the checkpoint's stale task metadata files; recover only engineering content after the final design is proven.
- Do not expose general `mac.call` or arbitrary shell as a recovery capability.
- The stale bridge accepts only `stable|beta|canary|dev`; unsupported fields and exact-version requests are rejected. Release URL/key material never comes from the caller.
- The inline legacy command parses, validates, and persists infrastructure-owned GCP metadata without sourcing/executing the startup script; the release metadata is passed to lifecycle through argv/env after validation.

## notes for ko

- The old worktree was evicted, not lost. Its dirty state survives as a recovery checkpoint commit.

## improvements noticed

- Task recovery tooling preserves a checkpoint commit even when the worktree is evicted; a first-class typed restore operation would make this recovery less manual.

## issues and recovery

- Initial `fs.read` with `tsk_5b900ab174b0` returned `TASK_SESSION_NOT_FOUND`. Registry metadata showed the session was `evicted` with dirty recovery checkpoint `23e14935842a9ee99853a5494ae4c8d0c4a50038`. Re-adopting PR #2305 via `task.start` recreated the original worktree/session without creating a new branch or PR.
- `stream.sync` correctly refused because the local `stream/os` worktree contains unrelated edits from another task. No typed stream->task refresh tool exists, so the task worktree was guarded for unexpected dirty paths and then synced to `origin/stream/os` through task-scoped `code.call`; unrelated stream work was untouched.
- A broad Bun-native four-file test run produced one runner-only failure because `session-start-foundation` mutates the global `Bun`; the canonical package Vitest command passes all 102 affected tests. No product change was made for the runner mismatch.
- Strict `review.run --all --strict --no-tests` returned a transport 502 after submission. The authoritative review-run record `5327456a0582e9eedcfff69bbd267d6c94806cc30c39dc63bf4f1ab32520de94` is still `running` for change hash `f1ff0f7b42e883946aea127bc87c15b0f84dfaff51a0c790f3b747752f31b2fb`; do not start a duplicate review.

### wait cycle: strict review completion

Wait reason: allow the already-running resumable strict review to finish after the client transport 502.
Duration: 30 seconds, then inspect the authoritative review-run record immediately.
Resume action: read the `opensaas-review-runs` record/lock for key `5327456a0582e9eedcfff69bbd267d6c94806cc30c39dc63bf4f1ab32520de94`.
Expected signal: record status becomes `completed` with an exit code and the lock disappears.
Fallback: if still running, use another bounded wait cycle; if orphaned/failed, inspect its captured stdout/stderr before deciding whether to resume/retry.

Observed result: wait ran 2026-09-08T02:55:10.293Z -> 2026-09-08T02:55:40.296Z. Immediate wake check at 02:55:47Z still showed `status: running`, PID 21701, lock present, same change hash/base, and no completed stdout/stderr yet.
Next decision: keep the same review authoritative; wait another 60 seconds and re-check the same record. Do not submit another review.

Second observed result: wait ran 2026-09-08T02:55:59.286Z -> 2026-09-08T02:56:59.289Z. Immediate check at 02:57:04Z still showed the same `running` PID 21701 and lock, with no completed stdout/stderr. Because elapsed runtime is now materially above normal review latency, inspect the typed process state before another wait cycle.

Process check: typed `mac.process` confirms PID 21701 is still a live Bun process and adjacent Node child processes from the review remain alive; there is no evidence the recorded run is orphaned.
Wait reason: allow the live strict review and its child checks to finish without duplicating or killing them.
Duration: 60 seconds.
Resume action: inspect the same authoritative review record/lock immediately.
Expected signal: `completed` record with exit code and no lock.
Fallback: if still running after this cycle, inspect the review child/check identity from the review implementation before deciding whether the gate itself is hung.

Review-stage inspection: `review.run --all` calls `getAllTsFiles(root)`, then runs ESLint and typecheck over that repo-wide set even with `--no-tests`. The long-running Bun/Node process tree is therefore consistent with the submitted over-broad review rather than evidence of an orphan.
Wait reason: allow the authoritative repo-wide strict review to finish within the documented 15-minute review budget.
Duration: 120 seconds.
Resume action: immediately inspect the same review record/lock and captured output.
Expected signal: completed record. If it fails only on unrelated repo-wide findings, run the correctly scoped strict diff review after this run reaches a terminal state.
Fallback: if it remains running near the 15-minute budget, inspect record/process liveness once more before treating the run as stuck.

Third observed result: wait ran 2026-09-08T02:59:46.218Z -> 2026-09-08T03:01:46.223Z. Immediate check at 03:01:50Z still showed the same `running` PID 21701, same review identity/change hash, and lock present, with no captured terminal output. Elapsed runtime is about 11m40s and remains inside the documented 15-minute review budget.
Wait reason: give the same authoritative repo-wide review one final bounded window before the 15-minute budget expires.
Duration: 150 seconds.
Resume action: immediately inspect the same review record, lock, and captured stdout/stderr.
Expected signal: completed terminal record with exit code.
Fallback: if still running near 14m15s, inspect process liveness and review-run state; do not submit a duplicate until the existing run is terminal/orphaned.

Final review result: the 150-second wait call itself returned a transport 502, but authoritative state inspection at 2026-09-08T03:06:18Z showed the original review completed at `2026-09-08T03:04:12.385Z` with `exitCode: 0`, lock removed, same branch/base/change hash. Repo-wide Twenty typecheck errors appeared in captured output but were classified as pre-existing/non-blocking by review; strict review passed. No duplicate review was submitted.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): bootstrap stale cloud nodes safely" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-08 02:31:42 write: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/tests/test-source-safety.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 02:50:01 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 02:55:02 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 02:55:56 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 02:57:09 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 02:57:20 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 02:58:48 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 03:02:00 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 03:06:27 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`

- 2026-09-08 03:06:49 apply-patch: `.task/os/bootstrap-stale-nodes-through-legacy-lifecycle/workpad.md`