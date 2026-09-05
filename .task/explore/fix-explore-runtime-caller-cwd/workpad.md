# Fix Explore runtime caller cwd

branch: `task/explore/fix-explore-runtime-caller-cwd`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2301
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/tests/explore-runtime-routing.test.ts`

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
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/tests/explore-runtime-routing.test.ts`

## acceptance criteria

- [ ] `confidence-score.js`, `decide-next.js`, and `exploit.js` resolve the caller repository from `CONSUELO_TOOL_CALLER_CWD` when executed from the installed runtime, falling back to `process.cwd()` only for direct/local use.
- [ ] The runtime-routing contract covers all three policy scripts, matching the existing `explore.js` caller-CWD pattern.
- [ ] Focused tests, strict review, verify, task promotion into `stream/explore`, and PR #2300 review/check state are clean.

## plan

1. Add the caller-CWD contract to the existing Explore runtime-routing test and prove it red.
2. Apply the same one-line repository-root resolution pattern already used by `explore.js` to all three policy scripts.
3. Run the focused runtime/policy suite, strict review, and verify; merge #2301 into the stream.
4. Re-check #2300 CI/reviews before Canary release.

## Test-first contract

behavior under test: installed-runtime policy tools use the original customer checkout supplied through `CONSUELO_TOOL_CALLER_CWD`, not the installed runtime directory.
existing local pattern: `packages/os/scripts/explore.js` passes/uses `CONSUELO_TOOL_CALLER_CWD`; `packages/os/tests/explore-runtime-routing.test.ts` already protects that boundary for Explore.
new or changed tests: extend `explore-runtime-routing.test.ts` to assert `confidence-score.js`, `decide-next.js`, and `exploit.js` resolve Git from `process.env.CONSUELO_TOOL_CALLER_CWD || process.cwd()`.
focused red command: `bun --cwd packages/os test tests/explore-runtime-routing.test.ts`.
expected red failure: all three policy scripts currently contain `resolveGitRoot(process.cwd())`, so the new caller-CWD assertion fails.
no-test waiver: not applicable.

## key decisions

- Codex P1 is valid: `executionScope: runtime` changes process CWD, so preserving only the env variable in the facade is insufficient unless each policy script consumes it.
- Keep the fix symmetric with `explore.js` rather than introducing a new helper in this hotfix.

- 2026-08-29 07:53:20 append: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/tests/explore-runtime-routing.test.ts`

## workspace-owned: activity log

- 2026-08-29 07:53:20 fs.write: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`
- 2026-08-29 07:53:46 fs.write: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`
- 2026-08-29 07:54:23 fs.write: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`
- 2026-08-29 07:55:09 fs.write: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`
- 2026-08-29 07:56:57 fs.write: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`

## validation evidence

- Red: `explore-runtime-routing.test.ts` failed 1/3 because the policy scripts still contained `resolveGitRoot(process.cwd())`.
- Implementation: all three scripts now use `resolveGitRoot(process.env.CONSUELO_TOOL_CALLER_CWD || process.cwd())`, matching `explore.js`.
- Green: focused runtime-routing test 3/3.

## current status

Codex P1 is addressed locally. Next: strict review, canonical verify, push/merge #2301 into `stream/explore`, then re-check #2300 review and CI.

- 2026-08-29 07:53:46 append: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`

## workspace-owned: validation evidence

- Red: `explore-runtime-routing.test.ts` failed 1/3 because the policy scripts still contained `resolveGitRoot(process.cwd())`.
- Implementation: all three scripts now use `resolveGitRoot(process.env.CONSUELO_TOOL_CALLER_CWD || process.cwd())`, matching `explore.js`.
- Green: focused runtime-routing test 3/3.
- 2026-08-29 07:54:06 `review.run`: passed — OK
- 2026-08-29 07:54:19 `verify`: passed — OK
- 2026-08-29 07:57:13 `review.run`: passed — OK
- 2026-08-29 07:57:55 `verify`: passed — OK

## final gate

- Strict review: 0 issues / 0 blockers.
- Canonical verify: full mode, passed, `publishValid=true`, DB risks/findings 0.
- Ready to promote #2301 into `stream/explore` as the Codex P1 follow-up.

- 2026-08-29 07:54:23 append: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`

## merge recovery

- `task.pr` could not merge #2301 because the task bootstrap started from `main` while the target `stream/explore` already contains #2297.
- The task facade exposes no typed task-sync/rebase operation. Recovery will merge `origin/stream/explore` into this task worktree with scoped Git, inspect every non-metadata conflict, and preserve both #2297's runtime-scope contract and this task's caller-CWD contract. No blanket ours/theirs resolution.

- 2026-08-29 07:55:09 append: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`

## merge recovery validation

- Merged `origin/stream/explore` into the task worktree using the scoped Git fallback because no typed task-sync/rebase surface exists.
- Exactly one code conflict occurred: `packages/os/tests/explore-runtime-routing.test.ts`.
- Resolved by preserving both #2297's runtime execution-scope contract and #2301's caller-repository preservation contract; no blanket ours/theirs choice.
- Post-resolution routing test: 4/4 green.
- Post-resolution full Explore science suite: 13 files / 89 tests green.
- No conflict markers remain; `git diff --check` is clean.

- 2026-08-29 07:56:57 append: `.task/explore/fix-explore-runtime-caller-cwd/workpad.md`
