# fix watchdog bootstrap handoff after lifecycle activation

branch: `task/os/fix-watchdog-bootstrap-handoff-after-lifecycle-activation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2344/fix-watchdog-bootstrap-handoff-after-lifecycle-activation
github pr: https://github.com/consuelohq/opensaas/pull/2344
started: 2026-08-31

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

- 2026-08-31 22:54:01 fs.write: `.task/os/fix-watchdog-bootstrap-handoff-after-lifecycle-activation/workpad.md`
- 2026-08-31 22:59:11 fs.write: `.task/os/fix-watchdog-bootstrap-handoff-after-lifecycle-activation/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 22:58:13 `review.run`: passed — OK
- 2026-08-31 22:58:53 `verify`: passed — OK

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

behavior under test: on macOS, after a successfully unloaded sidecar definition, launchctl bootstrap exit 5 is accepted when launchctl print shows the service is visible; genuinely unavailable services still fail after bounded retries.
existing local pattern: packages/os/tests/lifecycle-service-adapter.test.ts injects a deterministic process runner and asserts launchctl command sequencing for sidecar reloads.
new or changed tests: add a regression covering loaded watchdog -> successful bootout -> bootstrap exit 5 -> visible service, plus preserve the existing unavailable/failure case.
focused red command: bun --cwd packages/os test tests/lifecycle-service-adapter.test.ts
expected red failure: current adapter bootouts the newly visible watchdog again and ultimately throws gateway bootstrap failed instead of accepting visibility.
no-test waiver: not applicable.

## Live canary evidence

- PR #2310 published signed canary 0.1.95 successfully.
- First local activation rolled back to 0.1.94 with: gateway bootstrap failed for com.consuelo.watchdog: Bootstrap failed: 5.
- Both OS workers and Caddy remained healthy; watchdog was loaded, idle, and last exit code 0.
- Temporarily unloading only the idle watchdog before retry allowed exact 0.1.95 activation to complete with lifecycle phase succeeded.

- 2026-08-31 22:54:01 append: `.task/os/fix-watchdog-bootstrap-handoff-after-lifecycle-activation/workpad.md`

- 2026-08-31 22:55:10 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-31 22:55:57 apply-patch: `packages/os/scripts/lib/lifecycle/service.ts`

## Validation evidence

- RED: lifecycle-restart-contract failed 1/25 because bootstrapAttempts was 4 instead of 1.
- GREEN: lifecycle-restart-contract passed 25/25.
- Related lifecycle/ingress/retention suites passed 48/48.
- OS syntax/typecheck passed.
- Strict review: 0 blockers, 0 task issues.
- Full task verify: publishValid true; DB guard clean.
- Documentation opportunity is non-blocking because this changes internal launchd recovery semantics without changing an operator-facing command or contract.

- 2026-08-31 22:59:11 append: `.task/os/fix-watchdog-bootstrap-handoff-after-lifecycle-activation/workpad.md`
