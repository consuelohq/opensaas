# Fix daemon lifecycle self-mutation guard

branch: `task/os/fix-daemon-lifecycle-self-mutation-guard`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1830/fix-daemon-lifecycle-self-mutation-guard
github pr: https://github.com/consuelohq/opensaas/pull/1830
started: 2026-08-11

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

- none yet

## workspace-owned: validation evidence

- 2026-08-11 18:40:58 `review.run`: passed — OK
- 2026-08-11 18:41:07 `verify`: passed — OK

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

## Discovery and test-first contract

- Live failure: launchd exposes XPC_SERVICE_NAME=com.consuelo.system, but Bash child processes receive XPC_SERVICE_NAME=0, bypassing the current self-update guard.
- Impact: synchronous update or repair invoked through OS can restart the daemon before the request finishes, leaving the lifecycle lock and activation journal incomplete.
- Scope: add an inherited explicit daemon marker, reject synchronous update and repair inside the daemon, retain update --check and restart behavior.
- Test-first contract: add focused red tests for marker-based update rejection and repair rejection, plus a startup contract proving the daemon marker is set before the server starts. Run those red before implementation, then focused lifecycle/server suites and typecheck green.
- Recovery: orphaned worktree was moved intact to /private/tmp/task-os-fix-daemon-lifecycle-self-mutation-guard-orphan-20260811 before task recovery.

## Implementation and verification

- Red: lifecycle marker update and repair tests called their engine methods; server contract could not find the marker (3 focused failures).
- Implementation: server/main.ts sets CONSUELO_OS_DAEMON_PROCESS=1 before configuration/app creation; lifecycle.ts rejects synchronous update and repair in inherited daemon context, retaining XPC_SERVICE_NAME as a compatibility fallback.
- Green: lifecycle-engine.test.ts and bun-product-server-contract.test.ts: 56 passed.
- Green: packages/os typecheck (workspace script syntax checks passed).
- Green: git diff --check.
- Local recovery: lifecycle lock absent and activation journal absent; launchd service healthy on runtime 0.1.25.
