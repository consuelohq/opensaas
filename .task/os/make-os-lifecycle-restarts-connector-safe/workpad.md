# make OS lifecycle restarts connector-safe

branch: `task/os/make-os-lifecycle-restarts-connector-safe`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1999/make-os-lifecycle-restarts-connector-safe
github pr: https://github.com/consuelohq/opensaas/pull/1999
started: 2026-08-15

## acceptance criteria

- [x] An in-band `lifecycle restart` invoked from the active Consuelo daemon returns a successful accepted response before any process/gateway disruption.
- [x] The restart is handed to the existing durable native lifecycle operation worker (`kind: restart`) instead of running `engine.restart()` inline.
- [x] Terminal/out-of-daemon lifecycle restart keeps the existing synchronous engine behavior.
- [x] Update detachment behavior remains unchanged.
- [x] Existing OAuth/MCP/session security boundaries are unchanged.
- [x] Focused lifecycle tests pass; no broad `packages/os` suite is executed when destructive-literal preflight forbids it.

## plan

1. Reproduce the in-band restart bug with a focused `runLifecycleCli` regression test.
2. Route daemon-context restart through the already-supported native lifecycle operation launcher.
3. Keep direct CLI restart synchronous outside daemon context.
4. Run focused lifecycle/native-operation tests and strict review.
5. Publish to `stream/os` if validation is green.

## Test-first contract

behavior under test: an active daemon must acknowledge `lifecycle restart` before the restart worker can terminate the serving process; it must not await `engine.restart()` inline.
existing local pattern: self-hosted updates already use `createDetachedNativeLifecycleOperationLauncher`, and `NativeLifecycleOperationInput` already supports `{ kind: 'restart' }`.
new or changed tests: add a `runLifecycleCli` daemon-context restart regression in `packages/os/tests/lifecycle-engine.test.ts`; assert launcher receives `{ kind: 'restart' }`, inline engine restart is not called, and JSON result is accepted/detached.
focused red command: `bunx vitest run tests/lifecycle-engine.test.ts -t "hands a self-hosted restart to the durable lifecycle worker"` from `packages/os`.
expected red failure: current CLI calls `engine.restart()` inline, so the launcher is not called / mocked inline restart throws or is observed.
no-test waiver: not applicable.

## current status

- Reproduced transport-level failure live: synchronous lifecycle restart killed the in-flight MCP call; Caddy-only restart also caused a temporary connector 502.
- Stateless request handling recovered on fresh requests, but it cannot preserve an in-flight transport through the process/gateway being restarted.
- Existing native lifecycle operation infrastructure already supports `restart`; CLI only special-cases in-band `update` today.
- Implemented the missing daemon-context restart handoff. `runLifecycleCli` now acknowledges the durable restart operation before its worker performs the disruptive restart.
- Terminal/out-of-daemon restart remains synchronous and still calls `engine.restart()` directly.
- Focused lifecycle/native-operation validation and strict review are green. Ready to publish to `stream/os`.

## files changed

- `packages/os/scripts/lifecycle.ts` — route active-daemon restart through the durable native lifecycle worker.
- `packages/os/tests/lifecycle-engine.test.ts` — regression for reply-safe daemon restart plus terminal synchronous behavior.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 03:00:46 fs.write: `.task/os/make-os-lifecycle-restarts-connector-safe/workpad.md`
- 2026-08-15: inspected lifecycle CLI, reload adapter, native lifecycle operation support, and restart tests.
- 2026-08-15: traced 502 to in-flight transport termination during OS/Caddy restart; confirmed watchdog recovery and fresh-request recovery.

## workspace-owned: validation evidence

- RED: `bunx vitest run tests/lifecycle-engine.test.ts -t \"hands a self-hosted restart to the durable lifecycle worker\"` failed with exit code 1 because the current CLI awaited inline `engine.restart()`.
- GREEN: the same focused regression passed after the lifecycle dispatch fix.
- `bunx vitest run tests/lifecycle-engine.test.ts tests/native-lifecycle-operation.test.ts tests/lifecycle-restart-contract.test.ts` — 87/87 passed.
- `bun run typecheck` from `packages/os` — passed (`workspace script syntax checks passed`).
- 2026-08-15 03:02:28 `review.run`: passed — OK

## key decisions

- Do not attempt to make an existing TCP/HTTP/MCP stream survive process death. Make in-band destructive lifecycle commands reply-safe by handing them to the existing out-of-process lifecycle worker.
- Keep hard restart semantics in the detached worker; this avoids changing release/supervisor semantics while protecting the request that initiates the restart.
- Preserve synchronous restart outside daemon context so terminal lifecycle operations retain completion/health semantics.

## notes for ko

- "Stateless" removes server-side affinity/state dependency for new requests; it does not make an in-flight connection immortal when its gateway/process is deliberately restarted.
- Branching worked because it forced a fresh transport. The same chat also recovered once the connector re-established after watchdog/launchd recovery.

## improvements noticed

- Caddy config changes still cause a short connector interruption when Caddy itself is restarted. This task focuses first on ensuring in-band lifecycle restart returns before that disruption; graceful Caddy config reload can be a separate hardening task if still needed.

## issues and recovery

- Initial task start hit a concurrent `git fetch --prune` remote-ref race; one safe retry succeeded.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): make in-band lifecycle restart reply-safe" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-15 03:00:46 write: `.task/os/make-os-lifecycle-restarts-connector-safe/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
