# Stop no-op Caddy reloads from cutting MCP requests during updates

branch: `task/os/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2128/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates
github pr: https://github.com/consuelohq/opensaas/pull/2128
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

- 2026-08-16 04:48:02 fs.write: `.task/os/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates/workpad.md`
- 2026-08-16 04:50:56 fs.write: `.task/os/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates/workpad.md`
- 2026-08-16 04:51:51 fs.write: `.task/os/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 04:51:22 `review.run`: passed — OK
- 2026-08-16 04:51:46 `verify`: passed — OK

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

behavior under test: Caddy worker-pool reconciliation must signal Caddy only when it actually changes the generated Caddy topology. A same-version lifecycle update with an already-correct `46321+46322` pool may call reconciliation more than once, but those no-op reconciliations must not send `SIGUSR1` and must not interrupt `/mcp`.
existing local pattern: `reconcile-caddy-worker-pool.ts` delegates file generation to `reconcileCaddyWorkerPoolConfig`, then currently signals `com.consuelo.caddy`. Caddy supports SIGUSR1 config reload, but the live same-version acceptance proved that even a no-op reload can cut an in-flight reverse-proxy request.
new or changed tests: add an executable migration contract with injected/spawn-observable signaling behavior: `changed=false` => zero `launchctl kill SIGUSR1`; `changed=true` => one signal when the service is loaded. Preserve existing reconciliation and lifecycle continuity suites.
focused red command: run the new migration contract plus `caddy-worker-pool-reconciliation.test.ts` and lifecycle ingress continuity.
expected red failure: current migration signals Caddy whenever the gateway is configured, regardless of `result.changed`.
no-test waiver: none.

## Live failure evidence
- Same-version 0.1.57 update kept Caddy PID 73974 and Cloudflared PID 78003 unchanged but rolled both workers.
- Caddy log: SIGUSR1 reloads at 04:43:26.512Z and 04:43:28.339Z; `/mcp` 502 EOF at 04:43:29.294Z (`trc_5aa94338b531`).
- The failed MCP call did not produce a local OS receipt. The same connector recovered ~2 seconds later without branch/rebind.
- Root cause in shipped runtime: `reconcile-caddy-worker-pool.ts` signals Caddy whenever `result.reason !== 'gateway-not-configured'`; it does not require `result.changed`.

- 2026-08-16 04:48:02 append: `.task/os/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/migrations/reconcile-caddy-worker-pool.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## GREEN evidence
- Refactored `reconcile-caddy-worker-pool.ts` into an import-safe migration with an injectable Caddy reload decision. No-op reconciliation returns before any launchctl call; a real changed topology signals loaded Caddy exactly once with SIGUSR1.
- New executable migration tests passed 2/2; the stale static contract that required unconditional signaling was updated to the intended changed-only behavior.
- Critical lifecycle gate: 202/202 passed, syntax passed, lifecycle facade 9/9, and test-selection 39/39 (`trc_792e75f4565c`).
- `packages/os/SCRIPTS.md` now documents that same-version no-op reconciliation does not signal Caddy.

- 2026-08-16 04:50:56 append: `.task/os/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates/workpad.md`

## Final gate
- Strict review: 0 issues / 0 blockers (`trc_7861ce5e330d`).
- Formal verify: `publishValid=true`; migration warnings are expected for the changed Caddy reconciliation migration and contain no DB finding (`trc_e4087366445f`).

- 2026-08-16 04:51:51 append: `.task/os/stop-no-op-caddy-reloads-from-cutting-mcp-requests-during-updates/workpad.md`
