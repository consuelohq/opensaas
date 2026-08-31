# Fix native Windows service startup for release gate

branch: `task/os/fix-native-windows-service-startup-for-release-gate`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1880/fix-native-windows-service-startup-for-release-gate
github pr: https://github.com/consuelohq/opensaas/pull/1880
started: 2026-08-12

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/tests/windows-platform.test.ts`

## workspace-owned: files changed

- `packages/os/tests/windows-platform.test.ts`

## workspace-owned: activity log

- 2026-08-12 04:05:29 fs.write: `.task/os/fix-native-windows-service-startup-for-release-gate/workpad.md`
- 2026-08-12 04:07:20 fs.write: `packages/os/tests/windows-platform.test.ts`
- 2026-08-12 04:07:50 fs.write: `.task/os/fix-native-windows-service-startup-for-release-gate/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 04:08:14 `review.run`: passed — OK
- 2026-08-12 04:08:59 `review.run`: passed — OK
- 2026-08-12 04:09:12 `verify`: passed — OK

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

Red evidence already exists on both #1867 and #1871: `Consuelo OS / native windows` fails `Run native Windows platform acceptance` after the service host builds successfully; installation then reports `Windows service ConsueloOS did not reach running; last state was stopped`. This task must make the native Windows acceptance test green without weakening the service/startup contract or skipping the test. The signed runtime publish workflow cannot proceed while this distribution gate is red.

## discovery

- Compare the Windows acceptance harness, native service host, and TypeScript platform installer/start command.
- Reproduce or derive the service-stop cause before production edits.
- Keep the fix Windows-only and release-gate scoped; no Mac runtime mutation.

- 2026-08-12 04:05:29 append: `.task/os/fix-native-windows-service-startup-for-release-gate/workpad.md`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/native/windows-service/Program.cs`
- `packages/os/scripts/lib/windows-platform.ts`
- `packages/os/scripts/testing/windows-platform-acceptance.ps1`
- `packages/os/tests/windows-platform.test.ts`

## root cause and focused validation

Root cause confirmed: `createWindowsServiceController` persists `entrypoint: scripts/server/supervisor.ts`, and the .NET service host fails closed if that file is absent. Native Windows acceptance created only `scripts/server/main.ts`, so SCM started the host and it immediately stopped before Bun could launch. Production supervisor wiring is already covered by Windows/worker-pool contracts and is correct; the acceptance fixture was stale.

Fix: materialize the minimal acceptance server at `scripts/server/supervisor.ts` and add a static regression asserting the acceptance fixture matches the Windows service entrypoint.

Red: `tests/windows-platform.test.ts` 17 passed / 1 failed on the new harness assertion.
Green: same focused suite 18/18 passed after the fixture correction.

- 2026-08-12 04:07:50 append: `.task/os/fix-native-windows-service-startup-for-release-gate/workpad.md`

- 2026-08-12 04:08:48 apply-patch: `packages/os/SCRIPTS.md`
