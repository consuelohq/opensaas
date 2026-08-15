# Retry primary macOS launch agent bootstrap during lifecycle restart

branch: `task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2085/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart
github pr: https://github.com/consuelohq/opensaas/pull/2085
started: 2026-08-15

## acceptance criteria

- [x] Primary macOS LaunchAgent bootstrap retries launchd's transient exit-5/Input-output race with bounded attempts.
- [x] A job that becomes visible after a transient bootstrap failure is accepted and kickstarted.
- [x] Non-transient bootstrap failures still fail immediately; exhausted transient retries fail closed with label context.
- [x] Detached restart, direct fallback, and health acceptance contracts remain unchanged.
- [ ] Review/verify, stream/main promotion, canary publication, local update, and route smoke are complete.

## plan

1. Add the focused lifecycle restart regression first and prove RED.
2. Add bounded retry only to the primary LaunchAgent bootstrap helper, following the existing gateway-sidecar retry posture.
3. Prove GREEN with focused tests, static checks, review, and full verify.
4. Promote through stream/main, publish canary, update the local install, and smoke affected routes.

## current status

- Implementation is GREEN locally. Focused contract is 13/13, touched-file checks pass, and `git diff --check` is clean. Review/verify and publication remain.

## files changed

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## workspace-owned: activity log

- 2026-08-15 19:41:27 fs.write: `.task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart/workpad.md`
- 2026-08-15 19:42:29 fs.write: `.task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart/workpad.md`
- 2026-08-15 19:43:27 fs.write: `.task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 19:42:04 `checkFiles`: passed — OK
- 2026-08-15 19:42:57 `review.run`: passed — OK
- 2026-08-15 19:43:16 `verify`: passed — OK

## key decisions

- Reuse the exact failure classification and bounded retry posture already used for macOS gateway sidecars: exit-5/Input-output is transient; other launchctl failures are not.
- Keep the repair inside the canonical reload adapter instead of adding another process-control path or changing lifecycle service ownership.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The installed canary was valid but stuck at 0.1.46 after two detached updates to 0.1.50 failed at the primary `launchctl bootstrap` with exit 5. This task is the narrow recovery for that observed blocker.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`

## Acceptance criteria

- [ ] A transient macOS `launchctl bootstrap` failure for the primary Consuelo OS LaunchAgent (`Bootstrap failed: 5` / `Input/output error`) no longer aborts an otherwise valid lifecycle update immediately.
- [ ] After a transient bootstrap failure, the reload adapter checks whether the primary job is already loaded; if so, it proceeds to the existing kickstart path without another bootstrap.
- [ ] If the job is not loaded, the adapter retries the same immutable plist with a bounded attempt count and short delay, matching the gateway-sidecar retry posture.
- [ ] Non-transient bootstrap failures still fail immediately; exhausted transient retries fail closed with a useful primary-launch-agent error.
- [ ] Existing detached restart scheduling, conflicting-label cleanup, direct-mode fallback, and named health acceptance remain unchanged.
- [ ] Focused lifecycle restart contract goes RED before implementation and GREEN after implementation; syntax/type checks, review, and full publish verify pass.
- [ ] The fix is promoted through `stream/os` to `main`, a new canary runtime is published, the local canary update completes, and affected local routes are smoked.

## Plan

1. Extend the existing lifecycle restart contract test first so it requires bounded primary LaunchAgent bootstrap retry and loaded-job acceptance; run focused RED.
2. Implement the smallest retry inside `scripts/consuelo-reload.js`, reusing existing launchd helpers and sidecar retry semantics rather than adding a new lifecycle abstraction.
3. Run focused GREEN, syntax/type checks, diff check, strict review, and full verify.
4. Push/promote into `stream/os`, merge the stream to `main`, wait for the resulting OS canary publication, then rerun the detached local update and smoke the local OS routes.

## Test-first contract

behavior under test: the primary macOS Consuelo OS LaunchAgent bootstrap tolerates launchd's transient exit-5 teardown race by checking whether the job became loaded and otherwise retrying a bounded number of times, while non-transient failures remain immediate and detached lifecycle semantics stay unchanged.
existing local pattern: `createReloadServiceController` already retries macOS gateway sidecar bootstrap four times with a short delay and accepts `launchctl print` success after an exit-5 bootstrap; `lifecycle-restart-contract.test.ts` already protects the script-level reload/restart contract with deterministic source assertions.
new or changed tests: extend `packages/os/tests/lifecycle-restart-contract.test.ts` with an explicit primary-bootstrap retry contract covering bounded attempts, transient exit-5/Input-output detection, loaded-job acceptance through the existing launchd-loaded check, retry delay, and a clear exhausted-retry error.
focused red command: `bun --cwd packages/os test tests/lifecycle-restart-contract.test.ts`.
expected red failure: `scripts/consuelo-reload.js::bootstrapLaunchAgent()` currently calls `launchctl bootstrap` exactly once and has no primary retry constants/loop/transient exit-5 handling.
no-test waiver: none.

- 2026-08-15 19:41:27 append: `.task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart/workpad.md`

- 2026-08-15 19:41:43 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-15 19:41:59 apply-patch: `packages/os/scripts/consuelo-reload.js`

- 2026-08-15 19:42:23 apply-patch: `.task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart/workpad.md`

## RED / GREEN evidence

- RED: `bun --cwd packages/os test tests/lifecycle-restart-contract.test.ts` failed 1/13 at the new primary-bootstrap retry contract because `consuelo-reload.js` had no retry constants/loop or transient exit-5 handling (trace `trc_40ec7cb45d0b`).
- GREEN: the exact same focused command passed 13/13 after implementation (trace `trc_289ed5b8fd0a`).
- Touched-file `checkFiles` passed for the reload script and lifecycle restart contract (trace `trc_c46a10c74eee`).
- `git diff --check` passed cleanly (trace `trc_db7b7c158325`).

- 2026-08-15 19:42:29 append: `.task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart/workpad.md`


## Pre-publish validation

- `bun run --cwd packages/os typecheck` passed (`workspace script syntax checks passed`, trace `trc_3ff10d9692b1`).
- Strict task review against `origin/stream/os`: 0 task issues, 0 blockers, 0 pre-existing findings (trace `trc_92668e37b632`).
- Full `verify --base origin/stream/os`: passed with `publishValid: true`; review and DB guard clean (trace `trc_e59e33bf419c`).
- Implementation blast radius is two product/test files: `scripts/consuelo-reload.js` and `tests/lifecycle-restart-contract.test.ts`.

- 2026-08-15 19:43:27 append: `.task/os/retry-primary-macos-launch-agent-bootstrap-during-lifecycle-restart/workpad.md`
