# finish rollback compatibility after stable topology

branch: `task/os/finish-rollback-compatibility-after-stable-topology`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2115/finish-rollback-compatibility-after-stable-topology
github pr: https://github.com/consuelohq/opensaas/pull/2115
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

- 2026-08-16 03:26:24 fs.write: `.task/os/finish-rollback-compatibility-after-stable-topology/workpad.md`
- 2026-08-16 03:28:13 fs.write: `.task/os/finish-rollback-compatibility-after-stable-topology/workpad.md`
- 2026-08-16 03:30:54 fs.write: `.task/os/finish-rollback-compatibility-after-stable-topology/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:28:53 `review.run`: passed — OK
- 2026-08-16 03:29:44 `verify`: failed — COMMAND_FAILED
- 2026-08-16 03:30:43 `verify`: passed — OK

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

behavior under test: Build on the already-merged stable Caddy worker topology fix and finish lifecycle rollback convergence: a newer controller can roll back to an older immutable runtime installer, and reconciled Caddy config is applied without restarting ingress or relying on the disabled admin API.
existing local pattern: `createReloadServiceController` runs target-runtime daemon-definition refresh then the target Caddy migration and reload adapter; Caddy migration currently applies changed config through the LaunchAgent.
new or changed tests: rollback compatibility contract and zero-downtime Caddy config signal contract. Existing canonical worker-pool regression from the prior merged task must remain green.
focused red command: `bun test packages/os/tests/caddy-worker-pool-reconciliation.test.ts packages/os/tests/lifecycle-restart-contract.test.ts packages/os/tests/lifecycle-ingress-continuity.test.ts`
expected red failure: old rollback installer rejects the newer definitions-only flag; Caddy migration still restarts the LaunchAgent instead of signaling config reload.
no-test waiver: none.

- 2026-08-16 03:26:24 append: `.task/os/finish-rollback-compatibility-after-stable-topology/workpad.md`

## RED → GREEN evidence

- RED: focused suite 20 pass / 2 fail. Failures were exactly the intended remaining contracts: older rollback installer rejected the newer definitions-only option; Caddy migration still used LaunchAgent kickstart instead of a config-file signal.
- Implementation: automatic rollback tolerates only the specific older-installer definitions-only rejection and continues using stable runtime/current LaunchAgent definitions; normal activation remains strict. Caddy reconciliation now signals the loaded Caddy service with SIGUSR1 whenever the gateway is configured, avoiding both `kickstart -k` and the intentionally disabled admin API.
- GREEN: same focused suite 22 pass / 0 fail, 134 assertions. Existing stable worker-topology test remains green.

## current status
- Remaining rollback/Caddy changes are implementation-complete on the current stream head; proceeding through strict review, formal verify, task merge, stream-to-main shipment, runtime promotion, local update/restart, and smoke checks.

- 2026-08-16 03:28:13 append: `.task/os/finish-rollback-compatibility-after-stable-topology/workpad.md`

## review / verification

- Strict review against current `origin/stream/os`: 0 task issues, 0 blockers.
- Exact selected verification suites all passed: gateway/Caddy 31 tests; lifecycle handoff 197 tests; lifecycle facade 9 selected tests; syntax passed.
- Formal verify is `publishValid=true`; DB guard has warnings only for the migration file and 0 findings.

- 2026-08-16 03:30:54 append: `.task/os/finish-rollback-compatibility-after-stable-topology/workpad.md`
