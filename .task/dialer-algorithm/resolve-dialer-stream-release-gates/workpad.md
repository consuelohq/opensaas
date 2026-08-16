# resolve dialer stream release gates

branch: `task/dialer-algorithm/resolve-dialer-stream-release-gates`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2066/resolve-dialer-stream-release-gates
github pr: https://github.com/consuelohq/opensaas/pull/2066
started: 2026-08-15

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

- 2026-08-15 10:27:12 fs.write: `.task/dialer-algorithm/resolve-dialer-stream-release-gates/workpad.md`
- 2026-08-15 10:29:05 fs.write: `.task/dialer-algorithm/resolve-dialer-stream-release-gates/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 10:28:58 `review.run`: passed — OK

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

behavior under test: the dialer stream must satisfy the repository-level workspace verify/contracts gate against its PR base without changing D1-D4 runtime behavior.
existing local pattern: reproduce the exact Consuelo CI workspace verify failure, then align stale facade test expectations/fixtures to the existing production safety contract.
new or changed tests: test-only updates in packages/os/tests/facade/facade.test.ts and packages/workspace/tests/facade/facade.test.ts; no production source changes.
focused red command: targeted facade tests that previously failed in Consuelo CI for top-level fs.read fields and managed code.call task worktrees.
expected red failure: stale assertion wording plus code.call fixtures using arbitrary /tmp directories rejected by the managed task-worktree guard.
no-test waiver: not applicable; the failing tests themselves are the contract.

## Recovery state

- Reattached existing PR #2066 after the OS control plane outage; task branch/worktree were durable but the prior local edits were never pushed.
- Prior focused evidence: OS facade failing cases reproduced red, then 3/3 green after test-only fixture/assertion updates; mirrored workspace assertion 1/1 green; strict review returned zero blockers.
- Broad OS-suite/full local verify is intentionally not run because preflight detects a destructive-literal guardrail test; GitHub isolated CI is the broad validation surface.
- Acceptance: push only the two test files plus scoped task metadata, promote to stream, require PR #2014 zero failed checks, merge stream to main, then verify `Consuelo / dialer production release` and Railway runtime logs.

- 2026-08-15 10:27:12 append: `.task/dialer-algorithm/resolve-dialer-stream-release-gates/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/code-call/location.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/tests/facade/facade.test.ts`

## Final validation before publish

- Changed production code: none.
- Changed test files:
  - packages/os/tests/facade/facade.test.ts
  - packages/workspace/tests/facade/facade.test.ts
- Focused green evidence:
  - OS managed-worktree code.call tests: 2 passed, 701 skipped, exit 0.
  - OS `rejects mixed fs read pagination modes`: 1 passed, exit 0.
  - Workspace `rejects mixed fs read pagination modes`: 1 passed, exit 0.
- Strict review against `origin/stream/dialer-algorithm`: 2 files, 0 issues, 0 blocking issues, no tests requested.
- Negative-test telemetry writes expected `VALIDATION_ERROR` events to stderr; test commands exit 0. One OS run also emitted non-outcome-changing trace persistence warning for `bun:sqlite` under Vitest.
- Broad local package/repository test execution remains intentionally avoided because an unrelated OS guardrail test contains a destructive command literal; the broad validation surface is isolated GitHub CI on PR #2066 and then stream PR #2014.
- Release path after stream merge: main push -> `Consuelo Production Release` -> `Consuelo / dialer production release` -> Railway dialer-server + Cloudflare LeadConnector worker -> production smoke + release manifest -> explicit rollback available.

- 2026-08-15 10:29:05 append: `.task/dialer-algorithm/resolve-dialer-stream-release-gates/workpad.md`
