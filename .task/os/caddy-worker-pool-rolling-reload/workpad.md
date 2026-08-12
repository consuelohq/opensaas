# Caddy worker pool rolling reload

Branch: task/os/caddy-worker-pool-rolling-reload
Stream: stream/os
PR: #1850

## Goal
Activate Branch 5's supervised OS worker pool behind the existing private Caddy gateway, with health-aware load balancing and rolling worker replacement that preserves in-flight work and never broadens mutation retry semantics.

## Acceptance criteria
- Generated Caddy config includes every configured deterministic worker port, all loopback-only.
- Caddy uses non-sticky round-robin selection and active `/ready` health checks.
- Caddy may retry selection after connection/dial failure, but does not opt POST/mutations into post-connect round-trip retry.
- Existing gateway security headers, host gate, 4MB body limit, tenant isolation, and private-upstream validation remain unchanged.
- Proxy transport no longer imposes the legacy 15s response-header / 60s read-write execution caps on legitimate long MCP calls; dial timeout remains bounded.
- Worker pool exposes an explicit rolling replacement operation that replaces one slot at a time, waits for the replacement to become ready, and preserves healthy siblings.
- With >=2 workers, rolling replacement never intentionally drains all workers simultaneously.
- With one worker, replacement remains bounded and Caddy's dial-failure retry window can bridge the short backend gap; no fake zero-downtime guarantee is asserted.
- `consuelo reload`/`restart` uses the supervised pool for rolling worker replacement when a healthy supervisor snapshot is available; hard service restart remains the fallback when the pool is unavailable/unhealthy or the supervisor itself must be restarted.
- Existing watchdog path through canonical restart remains valid.
- Existing security, lifecycle, distribution, stateless MCP, replay, and worker-process tests remain green.

## Design
1. Keep Caddy static: deterministic worker ports mean drain/restart does not require Caddy config mutation.
2. Extend gateway generation from one upstream to a validated list while retaining the primary `upstream` metadata field for persisted-config compatibility.
3. Render `lb_policy round_robin`, `health_uri /ready`, bounded active checks, passive dial-failure awareness, and bounded `lb_try_duration`; do not configure `lb_retry_match` for POST.
4. Extend the worker pool with an explicit `replaceAllRolling()` operation. Replacement uses existing SIGTERM drain behavior and automatic slot relaunch, but the supervisor waits for a new instance of that slot to be ready before proceeding.
5. Use the existing atomic pool snapshot as the CLI control/observation surface. `consuelo-reload.js` asks each worker PID to terminate sequentially and waits for that slot's new instance to become ready; the supervisor remains alive. Fall back to the existing platform service restart when rolling preconditions are not met.
6. Keep default worker count = 1; Branch 6 enables configured multi-worker traffic without silently doubling resource usage.

## Test-first contract
Red tests will cover:
- multi-upstream Caddy rendering + health/LB + conservative retry + long-call timeout semantics;
- worker-pool rolling replacement ordering and sibling continuity;
- reload CLI choosing rolling replacement for a healthy supervised pool instead of kickstarting the whole LaunchAgent.

## Baseline
Pending targeted baseline run before test edits.

## Files expected
- packages/os/scripts/lib/security-gateway.ts
- packages/os/scripts/lib/worker-pool.ts
- packages/os/scripts/consuelo-reload.js
- packages/os/tests/security-gateway.test.ts
- packages/os/tests/worker-pool-lifecycle.test.ts
- packages/os/tests/consuelo-reload.test.ts
- possibly install/distribution contract tests if gateway provisioning needs worker-count propagation

## Non-goals
- No Branch 7 steering/catalog cache work.
- No multi-node/resource-affinity work.
- No distributed batch scheduler.
- No general idempotency ledger or mutation replay.
- No new load-balancer product.

## workspace-owned: files read

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/routes/health.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/tests/consuelo-reload.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`

## Final implementation status
- Caddy provisions every configured deterministic worker port, round-robins them, actively checks /ready, and keeps the ingress loopback-only.
- No POST/mutation retry widening: no lb_retry_match is configured. Dial timeout remains bounded; legacy response-header/read/write execution caps are removed.
- The supervisor exposes replaceAllRolling(); slots drain and replace sequentially, waiting for each replacement to become ready before moving on.
- SIGUSR2 requests a rolling worker reload without replacing the supervisor. consuelo reload uses this path when a healthy pool snapshot is present.
- consuelo restart/restart-now remains the hard supervisor/service refresh path for updates and watchdog recovery.
- Default worker count remains 1. No Branch 7 work was included.

## Validation
- TDD red contract: new Branch 6 tests initially failed on multi-upstream Caddy, timeout removal, rolling replacement, and reload signaling.
- Branch 6 regression: 59/59 passing across security-gateway, worker-pool lifecycle/process, consuelo-reload, lifecycle-restart-contract, and local-os-port-cutover.
- Real process proof: two real Bun workers survive crash isolation, then a real SIGUSR2 rolls both worker instances while the supervisor PID stays stable and both /ready endpoints recover.
- Runtime-state concurrency: 3/3 passing under bun test.
- OS syntax/typecheck: passed.
- Accidental facade snapshot rewrite from a broad Vitest probe was restored; no unrelated generated drift remains from that run.
- Caddy binary is not installed in this environment, so Caddyfile syntax/runtime validation is covered by generator contract tests rather than caddy validate.

## Recovery / notes
- The first broad gateway baseline was invoked from the wrong cwd and produced harness-path failures; rerunning from packages/os was green.
- A broad Node-hosted Vitest run hit two runtime-state tests that directly use Bun.sleep; the canonical bun test path passes 3/3.
- The pre-Branch-6 lifecycle source assertion hard-coded a literal reload-now spawn. It was updated to assert the new explicit reload->reload-now and restart->restart-now split.
- Repository-wide script-parity debt predates this task; Branch 6 does not widen into that cleanup.

## workspace-owned: validation evidence

- 2026-08-12 00:18:04 `audit`: failed — COMMAND_FAILED
- 2026-08-12 00:18:42 `review.run`: passed — OK
- 2026-08-12 00:19:16 `review.run`: passed — OK
- 2026-08-12 00:19:38 `verify`: passed — OK
- 2026-08-12 00:27:08 `verify`: passed — OK
- 2026-08-12 00:27:08 `verify`: passed — OK

## Current status
Branch 6 implementation is complete and publish-ready. Caddy load-balances the supervised worker pool, reload rolls worker slots without replacing the supervisor, hard restart remains canonical for supervisor/update recovery, the real two-worker process proof passes, strict review has zero blockers, and full verify is publish-valid. The only deferred items are pre-existing repository audit debt and direct Caddy binary validation because Caddy is not installed locally. No Branch 7 work is included.
