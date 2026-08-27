# Close final Codex stable findings

branch: `task/os/close-final-codex-stable-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2216/close-final-codex-stable-findings
github pr: https://github.com/consuelohq/opensaas/pull/2216
started: 2026-08-26

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

- 2026-08-26 14:51:43 fs.write: `.task/os/close-final-codex-stable-findings/workpad.md`
- 2026-08-26 14:53:23 fs.write: `.task/os/close-final-codex-stable-findings/workpad.md`
- 2026-08-26 14:54:52 fs.write: `.task/os/close-final-codex-stable-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 14:54:45 `review.run`: passed — OK

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

behavior under test: Google schema preserves dryRun for synthetic mutation protection; Google handler executes from runtime package scope; trace estimation uses resolved input with raw input only as fallback.
existing local pattern: facade schema fields and executionScope handler metadata are asserted in facade tests; trace estimator has focused unit coverage for fallback token accounting.
new or changed tests: extend the existing facade Google dry-run/execution-plan tests and trace cost estimator unit tests.
focused red command: `bun test packages/os/tests/facade.test.ts packages/os/tests/trace-cost-estimator.test.ts` (exact facade test file confirmed during discovery).
expected red failure: Google dry-run returns OK, plan cwd resolves to project root, and fallback input tokens approximately double.
no-test waiver: not applicable.

- 2026-08-26 14:51:43 append: `.task/os/close-final-codex-stable-findings/workpad.md`

## Focused red evidence

trace `trc_51b66f64ab5b`: the three intended contracts failed exactly—Google executionScope was undefined, resolved+raw input estimated 32 tokens versus 18, and the existing synthetic dry-run case for Google returned OK. The broad facade file also exposed pre-existing media/subagent failures and rewrote its snapshot during the failed run; that generated snapshot mutation is being restored before implementation.

- 2026-08-26 14:53:23 append: `.task/os/close-final-codex-stable-findings/workpad.md`

## Green evidence

focused tests: 10 passed, 0 failed (`trc_914fbcc6beae`). Nx syntax/typecheck passed (`trc_ef15453bcaa8`). Direct generated-manifest check passed (`trc_2fb1784da18f`); the equivalent Nx target was blocked by a worktree Yarn membership error, not code. Strict review passed with 0 issues and 0 blockers (`trc_c5d6e3bc59b4`).

- 2026-08-26 14:54:52 append: `.task/os/close-final-codex-stable-findings/workpad.md`
