# complete lifecycle rollback convergence on current os stream

branch: `task/os/complete-lifecycle-rollback-convergence-on-current-os-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2112/complete-lifecycle-rollback-convergence-on-current-os-stream
github pr: https://github.com/consuelohq/opensaas/pull/2112
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

- 2026-08-16 03:22:36 fs.write: `.task/os/complete-lifecycle-rollback-convergence-on-current-os-stream/workpad.md`
- 2026-08-16 03:23:26 fs.write: `.task/os/complete-lifecycle-rollback-convergence-on-current-os-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:23:53 `review.run`: passed — OK
- 2026-08-16 03:24:26 `verify`: passed — OK

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

behavior under test: The current OS stream must roll back from a newer candidate to an older immutable runtime even when the older installer predates newer reconciliation flags; Caddy topology must always use the supervisor's canonical worker-pool base/count rather than the slot port of whichever HA worker handles the lifecycle request; applying reconciled Caddy config must not restart ingress or depend on the disabled Caddy admin API.
existing local pattern: lifecycle service controller owns immutable-runtime reconciliation; `caddy-worker-pool-reconciliation.ts` owns generated Caddy topology; `reconcile-caddy-worker-pool.ts` owns live application; tests use temp node homes and injected process runners.
new or changed tests: lifecycle rollback compatibility contract; Caddy worker-bound environment regression; zero-downtime Caddy signal contract.
focused red command: `bun test packages/os/tests/caddy-worker-pool-reconciliation.test.ts packages/os/tests/lifecycle-restart-contract.test.ts packages/os/tests/lifecycle-ingress-continuity.test.ts`
expected red failure: request-worker `CONSUELO_OS_PORT` shifts Caddy upstreams by one slot; rollback rejects older installer capabilities; migration restarts or otherwise does not reapply config via the loaded LaunchAgent's config-file signal.
no-test waiver: none.

## Recovery evidence from installed canary
- Installed target release supported the newer definitions-only installer mode while its previous rollback release did not; the new controller passed the new option to the old installer and rollback failed.
- Live worker-pool snapshot was base 46321 with ready workers 46321/46322 while generated Caddyfile was 46322/46323, proving worker-slot environment contaminated pool topology.
- Managed Caddy has `admin off`; a live `launchctl kill SIGUSR1 gui/501/com.consuelo.caddy` probe succeeds and preserves the process, while CLI admin reload cannot connect.
- The previous main-based task has verified implementation evidence but conflicts with the newer stream history; this task restacks only the five code/test files on the current `stream/os` head.

- 2026-08-16 03:22:36 append: `.task/os/complete-lifecycle-rollback-convergence-on-current-os-stream/workpad.md`

## RED → GREEN evidence on current stream

- RED: focused suite 20 pass / 3 fail. Failures were exactly the intended contracts: request-worker port produced 48101/48102 instead of canonical 48100/48101; migration still used Caddy LaunchAgent kickstart; rollback rejected the older installer capability.
- Implementation: preserve installed stable LaunchAgent definitions only for automatic rollback when an older immutable installer specifically rejects the newer definitions-only mode; prefer validated supervisor pool snapshot over request-worker environment for Caddy topology; signal loaded Caddy with SIGUSR1 to re-read the file without restarting ingress.
- GREEN: same focused suite 23 pass / 0 fail, 133 assertions.
- Live canary recovery already proved the canonical topology correction: generated Caddyfile converged to 46321/46322, matching supervisor state, while the MCP connection remained available.

## current status
- Restacked implementation is complete on current stream head and ready for strict review / formal verification.

- 2026-08-16 03:23:26 append: `.task/os/complete-lifecycle-rollback-convergence-on-current-os-stream/workpad.md`
