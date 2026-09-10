# preserve real MCP calls during worker drain

branch: `task/os/preserve-real-mcp-calls-during-worker-drain`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2156/preserve-real-mcp-calls-during-worker-drain
github pr: https://github.com/consuelohq/opensaas/pull/2156
started: 2026-08-17

## acceptance criteria

- [x] Reproduce the live failure through the real `/mcp` route and prove the request is still counted when drain begins.
- [x] Managed Unix worker retirement uses a non-terminating graceful drain signal so an active real MCP call can settle before worker exit.
- [x] Existing two-worker/Caddy admission, response-body, auth/signature, and lifecycle update contracts remain fail-closed and green.
- [ ] Ship a corrected signed dev release, promote that exact release set to canary, install locally, and repeat the controlled 8-second MCP same-version update with zero post-baseline `/mcp` EOF/502.

## plan

1. Build a focused RED around the real `/mcp` request path using existing signed-edge/auth fixtures and a controllable slow tool dependency; observe `workerState.activeRequests` during execution and drain.
2. Prove whether request accounting or the worker control signal is the failing layer; implement only the proven root-cause fix without relaxing MCP auth or Caddy signature boundaries.
3. Treat seamless stale-supervisor hot adoption as a separate architecture improvement; for this canary migration, deliberately reload the supervisor once after installing the corrected signed runtime before judging subsequent rolling updates.
4. Run focused MCP/drain tests, the exact lifecycle selector, strict review, and formal verify.
5. Merge to main, wait for signed dev publication, promote exact dev release set to canary, install locally, and re-run the live controlled MCP hold plus Caddy log-offset acceptance.

## current status

- Live canary 0.1.66 is installed and pinned locally, but it is not soak-ready: same-version canary reconciliation cut a controlled 8-second MCP `code.call` and Caddy logged a new `/mcp` EOF/502 after the 01:17:38 baseline.
- Live local receipt for the failed request arrived at 01:18:00.999; worker-1 then drained and Caddy logged EOF/502 at 01:18:06.281. The roll completed with replacement worker-1 shortly afterward.
- Current supervisor PID 28451 started at 19:26 local, before 0.1.66, and remains the orchestrator because its snapshot advertises `supportsRuntimeCurrentRollingReload: true`; child workers are 0.1.66.
- Root cause is now proven locally without Caddy: Bun SIGTERM closes the active MCP socket while `activeRequests=1`; the identical authenticated call survives SIGUSR2 and exits cleanly afterward.
- Production fix uses a dedicated non-terminating graceful drain signal for managed Unix workers. Focused tests are 22/22 and the exact lifecycle gate is 19 files / 212 tests green.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`

## workspace-owned: files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`

## workspace-owned: activity log

- 2026-08-17 01:31:20 fs.write: `.task/os/preserve-real-mcp-calls-during-worker-drain/workpad.md`
- 2026-08-17 01:37:19 fs.write: `.task/os/preserve-real-mcp-calls-during-worker-drain/workpad.md`

## workspace-owned: validation evidence

- 2026-08-17 01:36:34 `review.run`: passed — OK
- 2026-08-17 01:36:56 `verify`: passed — OK
- 2026-08-17 01:37:44 `verify`: passed — OK

## key decisions

- Treat canary as failed acceptance until the live controlled MCP hold survives a same-version roll. Do not advance beta/stable.
- Keep Caddy/Cloudflared and node-bound signed auth unchanged; failure is local worker lifecycle after a valid request reaches `/mcp`.
- Do not assume stale-supervisor handoff is the only cause: the failed request was received before worker-1 drain, so the real MCP accounting path must be reproduced directly.
- A fully seamless hot handoff from an old in-memory supervisor to new orchestration code would require worker adoption rather than the current orphan-reclaim path. That is separate from this proven signal bug; do not widen this task into an unsafe supervisor takeover redesign.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- First 0.1.65 -> 0.1.66 update also produced one pre-baseline `/mcp` EOF/502. Same-version 0.1.66 reproduced it under a frozen post-update baseline, proving the issue is not only a transition from older child code.
- Intermittent MCP network errors also occur on some unrelated read-only calls; only errors with a matching post-baseline Caddy `/mcp` EOF/502 and local request receipt are attributed to worker drain.

## Test-first contract

behavior under test: a real JSON-RPC `/mcp` tools/call whose facade execution is still pending remains active when worker drain begins, and the supervisor's managed graceful Unix drain signal must allow that call to settle before process exit. SIGTERM is retained for service/hard-failure paths, not supervisor-managed graceful worker retirement.

existing local pattern: `health-readiness.test.ts` already proves synthetic slow-stream drain; MCP auth/route tests provide signed-edge request fixtures; `worker-pool-lifecycle.test.ts` and `lifecycle-restart-contract.test.ts` cover supervisor rolling/reload contracts.

new or changed tests: add a real authenticated MCP route + actual process-signal drain regression and assert the worker snapshot has `activeRequests=1` at signal time; update worker-pool expectations and explicit platform signal mapping.

focused red command: run the new MCP/signal-drain regression before production edits.

expected red failure: SIGTERM closes the real MCP socket before the pending tool response completes even though the worker request counter is still active.

no-test waiver: none.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-17 01:23:03 apply-patch: `.task/os/preserve-real-mcp-calls-during-worker-drain/workpad.md`

## workspace-owned: files read

- `packages/os/manifests/generated/core.manifest.json`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`
- `packages/os/tests/workspace-gateway-node-end-to-end.test.ts`

- 2026-08-17 01:35:36 apply-patch: `.task/os/preserve-real-mcp-calls-during-worker-drain/workpad.md`

Final validation: focused 23/23 and exact lifecycle selector 19 files / 213 tests plus OS syntax passed (trc_288864cdead8). Strict review found 0 issues / 0 blockers / 0 doc gaps (trc_bd742ffda70c). Formal verify passed full mode with DB guard clean and publishValid=true (trc_ef100cfc82ac).

Final implementation: Unix supervisor-managed worker retirement uses SIGUSR2 rather than SIGTERM; Windows retains its existing SIGTERM path pending native evidence for a non-terminating equivalent. Worker main listens for the managed drain signal in addition to SIGTERM/SIGINT. The real authenticated /mcp regression proves activeRequests=1 at signal time, the JSON-RPC response completes, then the worker exits cleanly. SCRIPTS.md documents the Bun SIGTERM socket behavior. Seamless hot adoption of a historical supervisor is separate architecture work; for this canary migration, reload the supervisor once after installing the corrected signed runtime before judging subsequent rolls.

- 2026-08-17 01:37:19 append: `.task/os/preserve-real-mcp-calls-during-worker-drain/workpad.md`
