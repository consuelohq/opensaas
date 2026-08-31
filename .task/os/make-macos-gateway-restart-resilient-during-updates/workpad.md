# Make macOS gateway restart resilient during updates

branch: `task/os/make-macos-gateway-restart-resilient-during-updates`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2079/make-macos-gateway-restart-resilient-during-updates
github pr: https://github.com/consuelohq/opensaas/pull/2079
started: 2026-08-15

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

- 2026-08-15 19:02:12 fs.write: `.task/os/make-macos-gateway-restart-resilient-during-updates/workpad.md`
- 2026-08-15 19:05:09 fs.write: `.task/os/make-macos-gateway-restart-resilient-during-updates/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 19:04:44 `review.run`: passed — OK
- 2026-08-15 19:04:59 `verify`: passed — OK

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

behavior under test: macOS lifecycle update/restart must not roll back an otherwise healthy release when a managed LaunchAgent is still settling after bootout and the first launchctl bootstrap transiently returns exit 5; restart errors must identify the affected label.
existing local pattern: createReloadServiceController reconciles Caddy, runs the activated runtime reload adapter, then for waitForCompletion=true loops managed LaunchAgents through bootout -> bootstrap -> kickstart. Current code bootstraps immediately and fails the whole update on the first nonzero result.
new or changed tests: add a focused lifecycle service regression with a fake runner where the first bootstrap for one managed gateway returns exit 5 while launchctl print still reports it unloading; require bounded retry to succeed, preserve bootout/bootstrap/kickstart ordering, and include the service label in terminal failures.
focused red command: bun --cwd packages/os test tests/lifecycle-service.test.ts
expected red failure: current controller performs a single bootstrap attempt and throws `canonical reload adapter failed: Bootstrap failed: 5: Input/output error` without the gateway label.
no-test waiver: not applicable.

## Live failure evidence

The 0.1.46 -> 0.1.49 canary update downloaded, verified, staged, migrated, and activated the signed target bundle, then rolled back during service-restart because launchctl bootstrap returned exit 5. All managed LaunchAgents were loaded again after rollback. Target bundle is intact. This task fixes that transient restart boundary before the next publication.

- 2026-08-15 19:02:12 append: `.task/os/make-macos-gateway-restart-resilient-during-updates/workpad.md`

## workspace-owned: files read

- `packages/os/tests/lifecycle-restart-contract.test.ts`

- 2026-08-15 19:02:39 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-15 19:02:59 apply-patch: `packages/os/scripts/lib/lifecycle/service.ts`

## Validation

- RED: focused lifecycle restart contract failed 2/12 exactly on single-attempt bootstrap behavior and missing gateway label (trace trc_c740e831b645).
- GREEN: focused lifecycle restart contract passes 12/12 after bounded exit-5 retry with launchctl print recovery and label-rich terminal errors (trace trc_5cb881cac82d).
- Syntax/typecheck passed (trace trc_5aa6eaa7ba50).
- Strict review against origin/main: 0 issues / 0 blockers (trace trc_ec122de830d9).
- Formal verify against origin/main: passed=true, publishValid=true, DB guard clean (trace trc_8b6158e291be).

- 2026-08-15 19:05:09 append: `.task/os/make-macos-gateway-restart-resilient-during-updates/workpad.md`
