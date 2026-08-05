# route test mode cleanup through test dialer

branch: `task/dialer/route-test-mode-cleanup-through-test-dialer`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1769/route-test-mode-cleanup-through-test-dialer
github pr: https://github.com/consuelohq/opensaas/pull/1769
started: 2026-08-04

## acceptance criteria

- [x] Test-mode sessions route terminate, retry-cleanup, and related group follow-ups through the test dialer that created their provider calls.
- [x] Live sessions continue to route through the live dialer.
- [x] A focused regression test fails before the fix and passes after it.
- [x] Dialer-server tests, typecheck, formatting, and publish verification pass.

## plan

1. Trace how session call mode is persisted and how compatibility-runtime follow-up operations choose a dialer.
2. Add a focused failing test for test-mode cleanup routing.
3. Implement the narrow routing fix, run focused and package validation, then merge the task into `stream/dialer`.

## current status

- Provider-mode persistence and follow-up routing are implemented; all package and publish verification gates are green.

## files changed

- `packages/dialer/src/types.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/src/domain/parallel-group.ts`
- `packages/dialer/src/domain/parallel-group.spec.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.ts`
- `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/runtime/railway.test.ts`
- `.task/dialer/route-test-mode-cleanup-through-test-dialer/workpad.md`

## workspace-owned: files changed

- Added a red provider-mode persistence assertion: expected `twilio-test`, received `undefined`.
- Persisted an optional `providerMode` on parallel groups; old groups without it route live for backward compatibility.
- Routed termination, callback handling, group reads, TwiML lookup, workspace termination, and cleanup retries through the stored owning dialer.
- Added selector tests for test-mode routing, legacy live routing, and failure when test credentials disappear.

## workspace-owned: activity log

- Focused provider/group/runtime tests: 16 pass, 0 fail after implementation.
- `bun test packages/dialer/src`: 171 pass, 0 fail.
- `bun test packages/dialer-server/src`: 69 pass, 0 fail.
- Dialer and dialer-server typechecks: pass.
- Dialer and dialer-server builds: pass.
- Follow-up focused routing tests after static-review cleanup: 13 pass, 0 fail.
- Publish verification: pass with 0 review findings and a valid publish stamp.

## workspace-owned: validation evidence

- 2026-08-04 20:13:53 `verify`: failed — COMMAND_FAILED
- 2026-08-04 20:17:23 `verify`: passed — publish-valid, 0 blocking review findings, database checks passed.
- 2026-08-04 20:17:23 `verify`: passed — OK

## key decisions

- Preserve the existing live/test dialer architecture and select the owning dialer from persisted session/group state rather than rebuilding the integration.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The task-start hook's suggested `batch` failed twice because it did not propagate the valid task session to nested `fs.apply_patch`; discovery continued as equivalent direct OS calls.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-04 20:06:38 apply-patch: `.task/dialer/route-test-mode-cleanup-through-test-dialer/workpad.md`
- 2026-08-04 20:09:40 apply-patch: `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- 2026-08-04 20:11:05 apply-patch: `packages/dialer/src/types.ts`
- 2026-08-04 20:11:05 apply-patch: `packages/dialer/src/domain/parallel-group.ts`
- 2026-08-04 20:11:05 apply-patch: `packages/dialer/src/domain/parallel-group.spec.ts`
- 2026-08-04 20:11:05 apply-patch: `packages/dialer-server/src/runtime/twilio-provider-mode.ts`
- 2026-08-04 20:11:05 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-08-04 20:11:05 apply-patch: `packages/dialer-server/src/runtime/railway.test.ts`
- 2026-08-04 20:11:42 apply-patch: `packages/dialer/src/index.ts`
- 2026-08-04 20:11:42 apply-patch: `packages/dialer-server/src/runtime/twilio-provider-mode.ts`

- 2026-08-04 20:12:30 apply-patch: `packages/dialer-server/src/runtime/railway.test.ts`

- 2026-08-04 20:13:00 apply-patch: `.task/dialer/route-test-mode-cleanup-through-test-dialer/workpad.md`

## workspace-owned: files read

- `/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-dialer-route-test-mode-cleanup-through-test-dialer/packages/dialer-server/src/runtime/railway.ts`

- 2026-08-04 20:17:37 apply-patch: `.task/dialer/route-test-mode-cleanup-through-test-dialer/workpad.md`