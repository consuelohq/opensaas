# fix PR 2310 pidless marker grace and guidance scoping

branch: `task/os/fix-pr-2310-pidless-marker-grace-and-guidance-scoping`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2338/fix-pr-2310-pidless-marker-grace-and-guidance-scoping
github pr: https://github.com/consuelohq/opensaas/pull/2338
started: 2026-08-31

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

- 2026-08-31 21:17:41 fs.write: `.task/os/fix-pr-2310-pidless-marker-grace-and-guidance-scoping/workpad.md`
- 2026-08-31 21:28:12 fs.write: `.task/os/fix-pr-2310-pidless-marker-grace-and-guidance-scoping/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 21:28:46 `review.run`: passed — OK

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

## Test-first contract

behavior under test: (1) an aged pidless `completion_unknown` run with a deferred parent fallback marker must remain unsettled for the runner handoff grace so a later authoritative marker can win; (2) task guidance tests must scope language and timeout assertions to the intended `code.call` example block
existing local pattern: durable subagent lifecycle regression tests plus `session-integration-guidance.test.ts`
new or changed tests: add a pidless deferred-fallback wait regression; refactor guidance assertions around an example-block extractor
focused red command: `bun test packages/os/tests/subagent-lifecycle-regressions.test.ts -t "pidless"`
expected red failure: current pidless branch uses aged `startedAt` with `STARTUP_GRACE_MS`, settling before `EXIT_MARKER_HANDOFF_GRACE_MS`
no-test waiver: not applicable

Review evidence: unresolved CodeRabbit threads `PRRT_kwDORPzu_c6d4Ksx` and `PRRT_kwDORPzu_c6d4Ks5` on PR #2310.

- 2026-08-31 21:17:41 append: `.task/os/fix-pr-2310-pidless-marker-grace-and-guidance-scoping/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/session-integration-guidance.test.ts`
- `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-31 21:26:26 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
## Final implementation and evidence

- Preserved the runner-owned exit-marker handoff grace for pidless `completion_unknown` runs whose parent fallback marker was deferred.
- Scoped guidance assertions to the individual `os.call` example containing the command or timeout under test.
- Red: `trc_c30188e04507` — the pidless handoff regression returned `completion_unknown` instead of `completed`.
- Focused green: `trc_df15e8cdc71c`.
- Guidance green: `trc_e5364f47910b`.
- Combined regression suite: `trc_0e303e5aa0b2` — 29 passed, 0 failed.
- OS typecheck: `trc_1cf8764ffae2`.
- Working-tree review diff: `trc_87d8a34228f0`.

- 2026-08-31 21:28:12 append: `.task/os/fix-pr-2310-pidless-marker-grace-and-guidance-scoping/workpad.md`
