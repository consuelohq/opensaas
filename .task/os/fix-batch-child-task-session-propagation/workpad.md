# fix batch child task session propagation

branch: `task/os/fix-batch-child-task-session-propagation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1787/fix-batch-child-task-session-propagation
github pr: https://github.com/consuelohq/opensaas/pull/1787
started: 2026-08-05

## acceptance criteria

- [x] Reproduce a batch child call losing the parent taskSession/branch.
- [x] Identify the exact dispatch/normalization path that drops task context.
- [x] Verify whether `consuelo update` installs the released packages/os version and identify the command-routing gap.
- [x] Produce a narrow approval plan for making batch inherit taskSession like code.call/code.run, with compatibility and test coverage.

## plan

1. Reproduce the failure with a top-level taskSession and task-scoped child calls.
2. Inspect batch dispatch, workspace call context propagation, task resolution, and OS package/update code.
3. Add a focused test contract and run current tests without production edits.
4. Summarize trace evidence, root cause, compatibility risks, and approval-gated implementation plan.

## current status

- Implementation and validation are complete; the branch is publish-valid and ready for task push/finish.
- Batch resolves the outer task handle once and binds `taskSession`, branch, and task worktree into sequential and parallel children. Session ID, task ID, metadata ID, and task branch aliases are supported.
- Conflicting child task context fails closed with `VALIDATION_ERROR` before child execution.
- Child results expose `parentTraceId`; OS trace persistence records the batch trace as each child's `mcp_trace_id` while retaining task session, branch, and worktree.
- Both OS and workspace facade trees and both standalone `tool-batch.ts` entrypoints carry the same behavior. Cross-package deduplication is deferred because released OS bundles do not contain `packages/workspace`.
- Top-level `consuelo update` now delegates to the installed OS lifecycle wrapper at `$CONSUELO_HOME/bin/consuelo`, forwarding channel/check/yes/json/quiet flags.

## files changed

- `packages/cli/src/commands/update.ts`
- `packages/cli/src/index.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/tool-batch.ts`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/cli-update-routing.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/generate-types.ts`
- `packages/workspace/scripts/lib/facade/batch.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/scripts/tool-batch.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`

## workspace-owned: files changed

- `packages/cli/src/commands/update.ts`
- `packages/os/tests/cli-update-routing.test.ts`

## workspace-owned: activity log

- 2026-08-05 18:37:58 fs.write: `.task/os/fix-batch-child-task-session-propagation/workpad.md`
- 2026-08-05 18:44:09 fs.write: `.task/os/fix-batch-child-task-session-propagation/workpad.md`
- 2026-08-05 18:52:35 fs.write: `packages/os/tests/cli-update-routing.test.ts`
- 2026-08-05 18:53:05 fs.write: `packages/cli/src/commands/update.ts`

## workspace-owned: validation evidence

- 2026-08-05 18:56:09 `checkFiles`: passed — OK
- 2026-08-05 19:03:04 `checkFiles`: passed — OK
- 2026-08-05 19:03:46 `audit`: failed — COMMAND_FAILED
- 2026-08-05 19:04:41 `review.run`: passed — OK
- 2026-08-05 19:04:41 `review.run`: passed — OK
- 2026-08-05 19:04:42 `review.run`: passed — OK
- 2026-08-05 19:04:42 `review.run`: passed — OK
- 2026-08-05 19:05:04 `verify`: failed — COMMAND_FAILED
- 2026-08-05 19:05:05 `verify`: failed — COMMAND_FAILED
- 2026-08-05 19:06:09 `review.run`: passed — OK
- 2026-08-05 19:06:10 `review.run`: passed — OK
- 2026-08-05 19:06:33 `verify`: passed — OK
- 2026-08-05 19:06:35 `verify`: passed — OK
- 2026-08-05 19:06:47 `verify`: passed — OK

## key decisions

- Treat taskSession as the canonical inherited execution context; branch/id fallback should be derived once at the batch boundary, not independently re-resolved by each child.
- Preserve explicit child context only when it matches the bound outer context; reject conflicts rather than silently switching worktrees.
- Mirror the behavior in OS and workspace for now. A single imported implementation would create a broken runtime dependency because immutable OS release bundles exclude `packages/workspace`.
- Reserve top-level `consuelo update` for the signed OS lifecycle. The former npm-only CLI self-update behavior is removed from this command.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial unscoped `fs.read` returned `AMBIGUOUS_TASK_SELECTION` across active task worktrees (trace `trc_fd9dcc4ea940`), matching the reported child-context loss.
- The first CLI recovery message was blocked by the dangerous-material filter because it contained a downloaded-script pipe command. Replaced it with the non-executable installer URL.
- A live read-only batch smoke was marked as a verify-mode mutation because task evidence logging updates task metadata. Re-ran the same smoke in edit-capable mode; product behavior was already successful.
- A persisted-trace query initially used relative imports from the `code.call` temporary module directory. Re-ran with absolute file URLs and verified the trace rows.
- `packages/workspace` has no `typecheck` script. Full CLI typecheck remains blocked by pre-existing unresolved optional `twenty-sdk/cli` imports; the changed CLI command compiles independently and the executable CLI smoke passes.

## Test-first contract

- behavior under test: batch children inherit the outer taskSession and resolve the same task branch/worktree unless a child explicitly overrides context.
- existing local pattern to follow: task-scoped `code.run` passes taskSession on the outer call and nested workspace helpers inherit it.
- new or changed tests: batch dispatch/context inheritance unit test plus CLI/runtime smoke test with multiple active task worktrees.
- focused red commands: OS facade batch tests and CLI update routing tests before implementation.
- red evidence: batch inheritance tests failed because children had no bound context (`trc_3f371bce996f`); CLI routing tests failed because the lifecycle delegate did not exist (`trc_7ff45bf69ba7`).
- expected red failure observed: task-scoped children returned `AMBIGUOUS_TASK_SELECTION`; top-level `update` was absent and the dormant command targeted npm CLI installation.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/cli/package.json`
- `packages/cli/src/commands/os.test.ts`
- `packages/cli/src/commands/os.ts`
- `packages/cli/src/commands/update.test.ts`
- `packages/cli/src/commands/update.ts`
- `packages/cli/src/errors.ts`
- `packages/cli/src/index.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/logger.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/tool-runner.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/facade/facade.test.ts`

## validation evidence

- Live batch reproduction failed exactly at child context resolution: batch trace `trc_5f650463f043`; child traces `trc_3b01259c1d73`, `trc_478ffd9637ba`.
- Focused current batch tests: 7 passed, 660 skipped (trace `trc_26161a5a06bb`); they do not cover context inheritance.
- Broad facade baseline: 625 passed / 42 failed for unrelated media manifest and existing code.call fixture issues (trace `trc_d7fb147d29fd`).
- CLI source help test: `consuelo --help` contains `os` but not `update` (trace `trc_143e231fd620`).
- OS lifecycle update tests: 8 passed, 34 skipped; lifecycle help advertises `consuelo update` (trace `trc_567d449b9d26`).
- OS batch contract: 6 passed, including sequential, parallel, conflicting context, and session/task/id/branch aliases (`trc_2e358f32b6b4`, OS sub-run passed).
- Workspace batch contract: 6 passed, including alias parity after resolver alignment (`trc_efb57d455837`).
- CLI update routing: 3 passed (`trc_143f4c53baf7`).
- CLI process smoke: top-level help exposes `update`; update help renders; all lifecycle flags were forwarded to a fake installed OS wrapper (`trc_a6c01ea8a6c7`).
- Standalone OS and workspace `tool-batch.ts` smokes both inherited the top-level task session and linked child results to the parent (`trc_6ddb9a6f0cf3`).
- Persisted trace proof: batch `trc_fcb81f1ded12`; child traces `trc_972c36e90de2` and `trc_607f338dd74c` retained `taskSession=tsk_e6e09f96c481`, the task branch/worktree, and `mcp_trace_id=trc_fcb81f1ded12`.
- OS typecheck and focused CLI command compilation passed (`trc_716c3a51c32f`).
- Changed-file static checks passed for all touched TypeScript and generated type files (`trc_28f8d6dab3ae`).
- Repository audit remains red on unrelated global debt: script-doc inventory drift, 9,497 historical missing doc paths, and stale/deleted semantic-index entries (`trc_df618ec07636`).
- Diff-scoped review passed with zero task-owned findings and zero blocking related findings (`trc_3a8b7e1f6013`).
- Full verification passed and wrote the publish-valid stamp at `.task/os/fix-batch-child-task-session-propagation/verify.json` (`trc_b7f01785ea45`).

## approval plan

1. Add red regression tests proving a top-level batch taskSession/task-id/branch resolves once and is inherited by sequential and parallel task-sensitive children.
2. Replace the current option-only batch fanout with a bound execution-context dispatcher shared with direct tool calls; merge inherited taskSession/branch/taskWorktree into each child and reject conflicting child overrides.
3. Add parent/child trace linkage and assert child trace rows retain task session, branch, and worktree.
4. Mirror the implementation in packages/workspace or delete the duplicate and import one canonical batch implementation.
5. Route the top-level CLI `consuelo update` to the OS lifecycle updater; move npm CLI self-update behind an explicit CLI-specific command if still needed.
6. Validate with focused facade tests, multi-worktree live smoke tests, lifecycle update tests, runtime bundle/release tests, and a canary release activation check.

- 2026-08-05 18:44:09 write: `.task/os/fix-batch-child-task-session-propagation/workpad.md`

- 2026-08-05 18:51:13 apply-patch: `packages/os/tests/facade/facade.test.ts`

- 2026-08-05 18:51:52 apply-patch: `packages/os/scripts/lib/facade/types.ts`
- 2026-08-05 18:51:52 apply-patch: `packages/os/scripts/lib/facade/batch.ts`
- 2026-08-05 18:51:52 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-08-05 18:52:35 write: `packages/os/tests/cli-update-routing.test.ts`

- 2026-08-05 18:53:05 write: `packages/cli/src/commands/update.ts`

- 2026-08-05 18:53:11 apply-patch: `packages/cli/src/index.ts`

- 2026-08-05 18:54:07 apply-patch: `packages/workspace/scripts/lib/facade/types.ts`
- 2026-08-05 18:54:07 apply-patch: `packages/workspace/scripts/lib/facade/batch.ts`

- 2026-08-05 18:54:36 apply-patch: `packages/workspace/scripts/lib/facade/executor.ts`

- 2026-08-05 18:55:05 apply-patch: `packages/workspace/tests/facade/facade.test.ts`

- 2026-08-05 18:57:02 apply-patch: `packages/workspace/scripts/generate-types.ts`

- 2026-08-05 18:59:04 apply-patch: `packages/os/scripts/generate-types.ts`
- 2026-08-05 18:59:33 apply-patch: `packages/os/tests/facade/facade.test.ts`
- 2026-08-05 18:59:33 apply-patch: `packages/workspace/tests/facade/facade.test.ts`

- 2026-08-05 19:00:38 apply-patch: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-08-05 19:01:23 apply-patch: `packages/os/scripts/tool-batch.ts`
- 2026-08-05 19:01:23 apply-patch: `packages/workspace/scripts/tool-batch.ts`

- 2026-08-05 19:02:20 apply-patch: `packages/os/scripts/tool-batch.ts`
- 2026-08-05 19:02:21 apply-patch: `packages/workspace/scripts/tool-batch.ts`

- 2026-08-05 19:02:42 apply-patch: `packages/workspace/SCRIPTS.md`
- 2026-08-05 19:02:42 apply-patch: `packages/os/SCRIPTS.md`

- 2026-08-05 19:03:34 apply-patch: `.task/os/fix-batch-child-task-session-propagation/workpad.md`

- 2026-08-05 19:05:28 apply-patch: `packages/cli/src/index.ts`

- 2026-08-05 19:06:55 apply-patch: `.task/os/fix-batch-child-task-session-propagation/workpad.md`