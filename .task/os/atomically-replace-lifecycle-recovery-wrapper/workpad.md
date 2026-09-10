# atomically replace lifecycle recovery wrapper

branch: `task/os/atomically-replace-lifecycle-recovery-wrapper`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2265
started: 2026-08-29

## acceptance criteria

- [x] Updating `bin/consuelo` never truncates or partially overwrites the existing lifecycle/recovery wrapper in place.
- [x] Replacement content is fully written and chmodded on the same filesystem before one atomic rename installs it.
- [x] If the final rename fails/interruption is simulated, the previously working wrapper remains byte-for-byte intact and temporary staging is cleaned up.
- [x] Existing create/update/preserve status semantics and executable mode remain unchanged.
- [x] Recovery pinning/finalization contracts from PR #2263 remain green.
- [x] Focused lifecycle tests, strict review, and full verify pass before promotion to `stream/os`.

## plan

1. Add a RED lifecycle-command regression that starts with a valid wrapper, forces the final rename to fail, and proves the old wrapper must survive unchanged.
2. Stage the wrapper inside a temporary directory under `home/bin`, set executable mode there, and atomically rename the staged file over `bin/consuelo`; clean the temporary directory in a `finally` block.
3. Re-run focused recovery/materialization tests and adjacent install/lifecycle contracts.
4. Run strict review/full verify, promote into `stream/os`, then resume PR #2264 release checks.

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/lifecycle-command.test.ts`

## key decisions

- Use same-directory/same-filesystem staging plus `renameSync`; do not use truncate-then-write, copy-over, or unlink-first replacement.
- Preserve the current wrapper if staging, chmod, or rename fails. Cleanup failure must not replace the primary error or damage the existing command.
- This fix applies to all lifecycle wrapper materialization, not only the post-activation finalizer, so every update path has the same crash-safety property.

## Test-first contract

behavior under test: lifecycle wrapper updates are atomic; an interrupted/failed final replacement leaves the previously executable `bin/consuelo` intact.
existing local pattern: `materializeLifecycleCommand` currently compares existing content, then calls `writeFileSync(commandPath, source)` directly followed by chmod. Codex correctly identified that a short write/disk-full/interruption can corrupt the only recovery wrapper.
new or changed tests: extend `packages/os/tests/lifecycle-command.test.ts` with a failure-injection case that spies on `renameSync`, expects materialization to throw, and then verifies the original wrapper content/mode still exists with no staged temp directory left behind.
focused red command: after destructive-literal preflight, run the lifecycle-command test filtered to the atomic replacement case.
expected red failure: current code never calls `renameSync`, so the injected rename failure does not occur and the old wrapper is overwritten.
no-test waiver: not applicable.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none

## validation evidence

- Focused test safety preflight `trc_42e5f1a92939`: lifecycle-command regression source contains no destructive/system-modifying command literals.
- RED `trc_1ee98864749c`: the injected `renameSync` interruption was never reached under the old implementation, proving the wrapper was still overwritten directly instead of atomically.
- Focused GREEN `trc_0da0919f32ad`: lifecycle-command + bootstrap recovery contracts passed 8/8, including preservation of the original wrapper when atomic rename fails.
- Final selected-suite safety preflight `trc_8d21c16becd1`: all 30 selected lifecycle/install test files checked clean before execution.
- Exact selector execution `trc_b05eb7f05a27`: lifecycle handoff, lifecycle syntax, lifecycle facade, and Google/install-state suites all passed with zero failed suites.
- Changed-file syntax `trc_eb18c4c7ddd9`: both changed TypeScript files pass syntax checks.
- Strict review `trc_7d42c357acf8`: 0 task-owned issues, 0 pre-existing issues, 0 blockers. The installation docs opportunity is nonblocking; atomic crash-safety does not change the public install interface.
- Canonical verify `trc_8f17c767e799`: full mode, passed, publish-valid, with 0 DB risks/findings.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/lifecycle-command.test.ts`

- 2026-08-29 01:07:29 apply-patch: `.task/os/atomically-replace-lifecycle-recovery-wrapper/workpad.md`
- 2026-08-29 01:07:39 apply-patch: `packages/os/tests/lifecycle-command.test.ts`
- 2026-08-29 01:07:59 apply-patch: `packages/os/scripts/lib/install-state.ts`

- 2026-08-29 01:09:13 apply-patch: `.task/os/atomically-replace-lifecycle-recovery-wrapper/workpad.md`

## workspace-owned: validation evidence

- Focused test safety preflight `trc_42e5f1a92939`: lifecycle-command regression source contains no destructive/system-modifying command literals.
- RED `trc_1ee98864749c`: the injected `renameSync` interruption was never reached under the old implementation, proving the wrapper was still overwritten directly instead of atomically.
- Focused GREEN `trc_0da0919f32ad`: lifecycle-command + bootstrap recovery contracts passed 8/8, including preservation of the original wrapper when atomic rename fails.
- Final selected-suite safety preflight `trc_8d21c16becd1`: all 30 selected lifecycle/install test files checked clean before execution.
- Exact selector execution `trc_b05eb7f05a27`: lifecycle handoff, lifecycle syntax, lifecycle facade, and Google/install-state suites all passed with zero failed suites.
- 2026-08-29 01:09:15 `checkFiles`: passed — OK
- 2026-08-29 01:09:47 `review.run`: passed — OK
- 2026-08-29 01:10:42 `verify`: passed — OK

- 2026-08-29 01:10:47 apply-patch: `.task/os/atomically-replace-lifecycle-recovery-wrapper/workpad.md`