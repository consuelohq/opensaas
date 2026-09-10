# stabilize durable subagent exit marker ci

branch: `task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2449/stabilize-durable-subagent-exit-marker-ci
github pr: https://github.com/consuelohq/opensaas/pull/2449
started: 2026-09-10

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

- 2026-09-10 03:27:58 fs.write: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`
- 2026-09-10 03:29:22 fs.write: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`
- 2026-09-10 03:32:12 fs.write: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`
- 2026-09-10 03:34:01 fs.write: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 03:32:45 `review.run`: passed — OK
- 2026-09-10 03:33:50 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: a durable detached subagent run must not be finalized as failed merely because the short-lived runner process exits before the parent observes its durable exit marker; successful provider completion must remain attachable and resolve to completed.
existing local pattern: `packages/os/tests/subagent-orchestration-contract.test.ts` exercises Grok through the detached runner; lifecycle/runner code owns state.json and exit-marker publication/recovery.
new or changed tests: add a deterministic regression that reproduces the runner-exit/exit-marker observation race rather than relying on Linux timing.
focused red command: `bunx vitest run packages/os/tests/subagent-orchestration-contract.test.ts packages/os/tests/subagent-lifecycle-regressions.test.ts` (narrow with -t once the new regression exists).
expected red failure: current lifecycle returns `COMMAND_FAILED` / `runner process exited without writing a durable exit marker` when runner liveness turns false before its just-produced marker becomes observable.
no-test waiver: not applicable.

CI evidence: #2014 run 34432579534 failed both `Consuelo / verify` and `Consuelo / workspace contracts` on the same test: `runs Grok through the durable detached runner`; Dialer and OS-contract gates passed. Durable logs were inspected before this task was opened.

- 2026-09-10 03:27:58 append: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tests/subagent-runner-termination.test.ts`

### diagnosis and focused proof

- Durable #2014 Linux logs showed both failed gates shared one failure: Grok detached-runner returned fallback `COMMAND_FAILED` because the runner exited before publishing its own exit marker.
- Deterministic RED added in `subagent-lifecycle-regressions.test.ts`: launch the real detached `runner.ts` under Node 24 with an 8 MiB stdin payload while a fast provider explicitly closes fd 0. Before the fix, Node crashed with an unhandled `Error: write EPIPE`, exit code 1, and no owned success marker.
- Root cause: `runner.ts` had no error listener on `provider.stdin`; the already-hardened synchronous `runSubagentProcess` path had EPIPE handling, but the detached durable runner did not.
- FIX: attach `provider.stdin` error handling before `.end()`. Ignore expected `EPIPE`/`ERR_STREAM_DESTROYED` (or an already-finished run); for any other stdin error preserve it as setup failure and terminate/escalate the owned provider so existing close/finalization logic writes a failed marker.
- GREEN: deterministic detached-runner EPIPE regression 1/1; exact `runs Grok through the durable detached runner` contract 1/1. No retry/grace-period increase and no gate weakening.

- 2026-09-10 03:29:22 append: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`

### selector-owned validation

- Moved the deterministic detached-runner EPIPE regression from `subagent-lifecycle-regressions.test.ts` into `subagent-runner-termination.test.ts`, which is already explicitly owned by the critical `os-subagent-runtime` selector. The lifecycle test file is restored byte-for-byte (0 diff lines).
- Selector ownership check for `subagent-runner-termination.test.ts` matched only `os-subagent-runtime`; no auto whole-OS package suite.
- GREEN focused after move: detached-runner EPIPE regression 1/1; exact Grok detached-runner contract 1/1.
- GREEN CI-equivalent selector for the two actual changed files (`runner.ts`, `subagent-runner-termination.test.ts`): only `OS durable subagent orchestration contracts` and `OS subagent syntax contracts` selected; both passed; 0 failed suites.
- This avoids hiding or weakening the existing full-package baseline: the earlier exploratory auto-package failure remains documented as unrelated current-main drift, while this task's critical selector now exactly covers the production fix and regression.

- 2026-09-10 03:32:12 append: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`

### publish gate

- Strict review vs `origin/stream/dialer-algorithm`: 2 files, 0 blocking issues, 0 pre-existing issues, 0 documentation opportunities.
- Canonical verify: PASS / full / publishValid=true. Review pass; critical selector pass; DB guard pass with 0 risks and 0 findings.
- Verify pre-publish HEAD: `a2a00a26803295152cbda5af6c2ee0c3b978cb20`; changed production/test files only: `runner.ts` and `subagent-runner-termination.test.ts`.

- 2026-09-10 03:34:01 append: `.task/dialer-algorithm/stabilize-durable-subagent-exit-marker-ci/workpad.md`
