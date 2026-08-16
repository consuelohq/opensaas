# Anchor Caddy worker topology to stable pool base

branch: `task/os/anchor-caddy-worker-topology-to-stable-pool-base`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2110/anchor-caddy-worker-topology-to-stable-pool-base
github pr: https://github.com/consuelohq/opensaas/pull/2110
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 03:16:49 fs.write: `.task/os/anchor-caddy-worker-topology-to-stable-pool-base/workpad.md`
- 2026-08-16 03:21:48 fs.write: `.task/os/anchor-caddy-worker-topology-to-stable-pool-base/workpad.md`
- 2026-08-16 03:22:51 fs.write: `.task/os/anchor-caddy-worker-topology-to-stable-pool-base/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:22:24 `review.run`: passed — OK
- 2026-08-16 03:22:46 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- worker-pool topology must remain anchored to a stable pool base even inside worker-1 where `CONSUELO_OS_PORT`/`PORT` are that worker's bind port;
- Caddy reconciliation from worker-1 must keep the canonical 46321+46322 pool rather than drifting to 46322+46323;
- worker children must receive both a stable pool-base signal and their own bind port;
- routine topology reconciliation must not restart Caddy merely because worker-local env differs from the pool base.

existing local pattern:
- `resolveWorkerPoolConfiguration` derives desired worker ports from environment;
- supervisor knows the canonical base port before spawning workers;
- `reconcileCaddyWorkerPoolConfig` renders Caddy from `resolveWorkerPoolConfiguration`;
- `reconcile-caddy-worker-pool.ts` owns the optional live Caddy action after file reconciliation.

new or changed tests:
- `worker-pool-lifecycle.test.ts`: stable base wins over worker-local bind port;
- `worker-pool-process.test.ts` / supervisor contract: children receive stable pool base separately from bind port;
- `caddy-worker-pool-reconciliation.test.ts`: worker-1 env still renders base/base+1 and never base+1/base+2;
- migration/restart contract: ordinary same-topology reconciliation does not restart public ingress.

focused red command:
- `bun x vitest run packages/os/tests/worker-pool-lifecycle.test.ts packages/os/tests/worker-pool-process.test.ts packages/os/tests/caddy-worker-pool-reconciliation.test.ts`

expected red failure:
- current worker config treats worker-1's `CONSUELO_OS_PORT=46322` as the pool base and derives 46322+46323.

no-test waiver: not applicable.

## Live reproduction
- actual pool snapshot: base 46321, workers 46321/46322 ready.
- live Caddyfile after failed 0.1.54 activation: upstreams 46322/46323.
- lifecycle request was served from a worker process whose environment sets both `CONSUELO_OS_PORT` and `PORT` to that worker's bind port.

- 2026-08-16 03:16:49 append: `.task/os/anchor-caddy-worker-topology-to-stable-pool-base/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/caddy-worker-pool-reconciliation.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/scripts/migrations/reconcile-caddy-ha-watchdog.ts`
- `packages/os/tests/caddy-worker-pool-reconciliation.test.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`
- `packages/os/tests/worker-pool-process.test.ts`

## Root cause and implementation
- Live 0.1.54 acceptance kept the connector healthy but failed activation because Caddy had been rewritten to 46322+46323 while the actual HA pool remained 46321+46322.
- Root cause: worker children intentionally set `CONSUELO_OS_PORT` and `PORT` to their own bind port. Lifecycle/Caddy reconciliation reused those variables as the pool base, so a request handled by worker-1 shifted topology by one port.
- `CONSUELO_OS_WORKER_BASE_PORT` now carries stable pool topology separately from worker bind ports. Supervisor, daemon bootstrap, native lifecycle isolation, reload, and lifecycle health all preserve/prefer it.
- Caddy reconciliation additionally treats the recorded `node/runs/os-worker-pool.json` topology as authoritative when valid. This makes the next candidate release backward-compatible with currently running 0.1.53 workers that do not yet export the new base variable.
- Operational docs now distinguish stable pool base from worker-local bind ports.

## Validation
- Test-first reproduction was red: stable base 48100 + worker-local 48101 incorrectly derived 48101+48102.
- Targeted worker-pool/Caddy/native-lifecycle tests: 25/25 passed after implementation.
- Full critical lifecycle/MCP suite: 225/225 passed; syntax passed; workspace selection 39/39 passed (`trc_becb38fbec30`).

- 2026-08-16 03:21:48 append: `.task/os/anchor-caddy-worker-topology-to-stable-pool-base/workpad.md`

## Final gate
- Strict review: 0 issues / 0 blockers (`trc_64471981d80d`).
- Formal verify: `publishValid=true` (`trc_b95a831e0020`).
- Nonblocking docs opportunity points at public CLI docs, but the changed `lifecycle.ts` behavior is internal pool-base resolution; operator-facing behavior is documented in `packages/os/SCRIPTS.md`.

- 2026-08-16 03:22:51 append: `.task/os/anchor-caddy-worker-topology-to-stable-pool-base/workpad.md`
