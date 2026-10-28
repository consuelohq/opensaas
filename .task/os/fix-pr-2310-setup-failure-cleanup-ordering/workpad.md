# fix PR 2310 setup failure cleanup ordering

branch: `task/os/fix-pr-2310-setup-failure-cleanup-ordering`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2333
started: 2026-08-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: when runner setup throws after the provider spawns, cleanup must remain a failed durable outcome even if the SIGTERM-aware provider exits zero.
existing local pattern: subagent lifecycle regressions inject setup failure after spawn and assert durable marker/state plus provider process-group cleanup.
new or changed tests: make the spawned provider trap SIGTERM and exit 0, then retain the failed setup assertion.
focused red command: `bun test packages/os/tests/subagent-lifecycle-regressions.test.ts --test-name-pattern 'terminates the detached runner and owned provider when running-state persistence fails|terminates an owned provider when runner setup fails after spawn'`
expected red failure: the ordinary provider close listener wins first and writes a completed marker instead of preserving the setup exception.
no-test waiver: not applicable.
review evidence: PR #2310 thread `PRRT_kwDORPzu_c6d2_6j` (`trc_03b66ebc2a75`).

- 2026-08-31 20:48:09 append: `.task/os/fix-pr-2310-setup-failure-cleanup-ordering/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-31 20:48:09 fs.write: `.task/os/fix-pr-2310-setup-failure-cleanup-ordering/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/subagent/process-termination.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- `packages/os/tests/subagent-runner-termination.test.ts`

## workspace-owned: validation evidence

- 2026-08-31 20:58:47 `review.run`: passed — OK
