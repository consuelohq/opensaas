# Move dialer guidance into stream context

branch: `task/dialer/move-dialer-guidance-into-stream-context`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2252
started: 2026-08-28

## acceptance criteria

- [x] Keep the dialer guidance available through stream.context for area=dialer.
- [x] Remove the duplicate global Steering copy while preserving a recoverable archive.
- [x] Verify byte identity before moving and rerun stream.context after moving.

## plan

1. Resolve the stream-owned instruction path and compare it with the global copy.
2. Archive the duplicate global copy after confirming the stream file is exact.
3. Rerun stream.context and inspect the task diff.

## files changed

- packages/workspace/streams/dialer/AGENTS.md (already present; no content delta)
- /Users/kokayi/Consuelo/Steering-archive/dialer-AGENTS.md (recoverable archive outside the repo)

## key decisions

- The canonical location is packages/workspace/streams/dialer/AGENTS.md; areas/dialer/AGENTS.md remains the area-wide runbook.
- The duplicate was archived instead of deleted so the move is recoverable.

## notes for ko

- The stream file and old Steering file were byte-identical: 11,655 bytes with SHA-256 9b6b4f860023f2fc20901d8dbac9415acef681c2fae5018fd74c58cbb85f90cd.
- The workspace fs.write helper could not see the generated task as active, so the scoped code.call edit path was used for task metadata only.

## improvements noticed

- none yet

## errors i ran into

- session.start initially required the missing area field; retrying with area=dialer succeeded.
- fs.write reported no active task despite valid worktree metadata; no source edit was attempted through that path.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```


## Test-first contract

behavior under test: the dialer guidance is loaded by stream.context for area=dialer and is no longer stored in the global Steering folder
existing local pattern: stream.context(area=dialer) resolves packages/workspace/streams/dialer/AGENTS.md; areas/dialer/AGENTS.md remains the area-wide runbook
new or changed tests: none; this relocates an instruction document without changing executable behavior
focused red command: stream.context with area=dialer before the move already resolved the stream file; no executable red test applies
expected red failure: not applicable to a documentation-only relocation
no-test waiver: approved for this documentation-only move; validation will compare content, inspect the diff, and rerun stream.context

## Follow-up source fix

behavior under test: managed component installation must not recreate stream-scoped dialer instructions under the global visible Steering directory
existing local pattern: provisionManagedComponentIndexes currently calls reconcileVisibleDialerSteering; stream.context(area=dialer) already resolves packages/workspace/streams/dialer/AGENTS.md
new or changed tests: update managed-components and install-state integration tests to assert no visible dialer file or seed_steering action
focused red command: bun test packages/os/tests/managed-components.test.ts packages/os/tests/install-state.test.ts
expected red failure: current provisioning creates Steering/dialer-AGENTS.md and returns seed_steering
no-test waiver: not applicable; this source behavior change has focused regression coverage

## Final source-fix status

- Root cause: provisionManagedComponentIndexes called reconcileVisibleDialerSteering, which copied the stream file into visible Consuelo/Steering during install/update.
- Fix: removed that call and action type, deleted the dedicated synchronizer and its unit test, and retained the stream file as the canonical source.
- Regression proof: managed-components.test.ts passes 18/18, including the no-visible-dialer-file assertion; os-get-steering-trace.test.ts passes 4/4.
- install-state.test.ts was attempted narrowly against the changed provisioning path but timed out at its existing 5-second test limit after 18 seconds; no assertion failure was reported.
- Static package syntax check passes and no production/test references to the removed synchronizer or seed_steering remain.

## workspace-owned: validation evidence

- 2026-08-28 23:57:26 `verify`: failed — COMMAND_FAILED
