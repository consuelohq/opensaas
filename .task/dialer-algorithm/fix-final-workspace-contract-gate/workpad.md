# fix final workspace contract gate

branch: `task/dialer-algorithm/fix-final-workspace-contract-gate`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2108/fix-final-workspace-contract-gate
github pr: https://github.com/consuelohq/opensaas/pull/2108
started: 2026-08-16

## acceptance criteria

- [x] Reproduce the GitHub shared-gate failure on the exact PR head/base and isolate it from Dialer runtime behavior.
- [x] Add a deterministic regression for late owned exit-marker recovery from `completion_unknown`.
- [x] Make bounded waits treat `completion_unknown` as recoverable until the wait budget expires.
- [x] Preserve status/log observability and `WAIT_TIMEOUT` semantics when ambiguity remains.
- [x] Pass the complete focused durable-subagent suite, exact CI workspace-contract command, strict review, and canonical verify.

## plan

1. Reproduce the exact GitHub workspace-contract gate and inspect the Linux-only failure tail.
2. Trace durable runner ownership, exit-marker publication, and bounded wait semantics.
3. Add a deterministic late-marker recovery regression before changing lifecycle code.
4. Make `completion_unknown` recoverable during a bounded wait and widen only the fake-provider test budgets.
5. Re-run the focused durable suite, exact CI verify command, strict review, and canonical verify.

## current status

- Implementation complete and publish-valid. Ready to promote into `stream/dialer-algorithm` for the final GitHub CI gate.

## files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/SCRIPTS.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 03:09:49 fs.write: `.task/dialer-algorithm/fix-final-workspace-contract-gate/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:16:57 `review.run`: passed — OK
- 2026-08-16 03:17:25 `verify`: failed — COMMAND_FAILED
- 2026-08-16 03:18:15 `verify`: passed — OK
- 2026-08-16 03:18:53 `verify`: passed — OK

## key decisions

- `completion_unknown` remains a terminal observation state for status/log reads, but it is not a settled result for an active bounded wait because an owned exit marker can arrive later.
- If ambiguity survives the caller's wait budget, the wait returns `WAIT_TIMEOUT`; production provider deadlines are unchanged.
- Fake-provider lifecycle tests use a 5s wait budget to tolerate detached-run startup variance across macOS/Linux CI without changing production timeouts.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the exact GitHub `Consuelo / workspace contracts` gate for PR #2014 head `73590eb1e97f6a10fe1f6a5b549053ac9e994343` and base `de5a5547da7ef39f5440cae87fb11e0dd413e454` must pass with the repository's committed-only focused test selection.
existing local pattern: CI runs `bun run verify -- --base <base_sha> --committed-only-tests --no-stamp --review-arg --no-tests`; stream-sync already passed the combined-tree focused suites after task-routing env was scrubbed.
new or changed tests: start with no new test; first reproduce the exact CI gate and identify its concrete failing suite/contract. If a code/test defect exists, add the narrowest regression before fixing it.
focused red command: exact CI verify command on this task created from the failing PR head, after static preflight of the selected test sources.
expected red failure: reproduce the same workspace-contract failure as GitHub and capture the specific failed suite/output tail that Actions log truncation hid.
no-test waiver: not applicable.

## Acceptance criteria
- [x] exact CI verify command identifies the shared-gate failure and passes after the fix on the same base/head selection.
- [x] real defect has a focused deterministic regression and root-cause fix; no broad test weakening.
- [x] strict review and canonical verify are green for the task delta.
- [x] task is ready to promote; #2014 still must reach 0 failed / 0 pending before merge.

## Final validation
- RED: late-owned-exit-marker regression returned `completion_unknown` instead of `completed`.
- GREEN: deterministic recovery 1/1; durable subagent suite 48/48.
- Exact GitHub workspace-contract verify command with base `de5a5547da7ef39f5440cae87fb11e0dd413e454`: passed all 14 focused registry suites.
- Strict review: 0 issues / 0 blockers.
- Canonical verify: `publishValid: true`, 0 DB risks/findings.
- GitHub evidence: the failed run's Dialer job was green; only the shared verify/workspace gates failed on Linux durable-subagent timing.

- 2026-08-16 03:09:49 append: `.task/dialer-algorithm/fix-final-workspace-contract-gate/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`

- 2026-08-16 03:18:35 apply-patch: `.task/dialer-algorithm/fix-final-workspace-contract-gate/workpad.md`
