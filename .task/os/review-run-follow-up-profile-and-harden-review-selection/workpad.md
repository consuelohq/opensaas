# Review-run follow-up: profile and harden review selection

branch: `task/os/review-run-follow-up-profile-and-harden-review-selection`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2747
started: 2026-10-31

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/workspace/scripts/lib/review-typecheck-errors.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/tests/review-modernization.test.js`

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

## workspace-owned: files read

- `packages/workspace/scripts/review.js`
- `packages/workspace/senior-engineer.md`

## Scope / acceptance criteria (DEV-1666)

- [x] Replace O(changed-files) Git diff subprocesses used to attribute review findings with batched zero-context diff parsing; preserve committed, working tree, and staged line coverage, renamed/space-containing files, and no-code handling.
- [x] Guarantee that every failed Nx typecheck invocation yields a blocking diagnostic, even if its output is missing, oddly formatted, or lacks recognizable TS errors; normalize relative and absolute file paths correctly.
- [x] Write failing behavior-focused tests *before* implementing both fixes; keep current summary/JSON and no-tests ownership unchanged.
- [x] Measure old and new diff discovery on an identical >=30-file input, and record methodology.
- [ ] Run focused tests, review (with no-tests as verify owns suites), full verify, inspect diff, push + promote to stream/os only; do not merge main/deploy.

## Test-first contract

behavior under test: changed-line attribution with three batch diffs rather than three subprocesses per file; compiler failure always materializes one or more actionable TYPECHECK findings.

existing local pattern: Vitest suite `packages/workspace/tests/review-modernization.test.js` and review helpers under `scripts/lib`; exact Git diff hunk behavior in `review.js`.

new or changed tests: extend `review-modernization.test.js` with changed-line parser (staged+unstaged+base, spaces, rename, empty selection, call count), diagnostic parsing (TS formats, absolute vs relative, malformed output and failed no-output), CLI integration wiring.

focused red command: `bun x vitest run packages/workspace/tests/review-modernization.test.js`.

expected red failure: new helper functions are not yet exported/implemented; the test suite must fail until production implementation.

no-test waiver: none.

## Plan

1. Capture baseline changed-line Git subprocess timing, confirm exact helper contracts.
2. Write focused regressions and observe RED.
3. Implement minimal helper extraction and reviewer integration, observe GREEN.
4. Measure and verify; publish on stream safely.

## Notes for ko

- New Linear issue DEV-1666; previous modernization tracked as DEV-1571.
- Scoped to review-run Git line attribution and typecheck fail-closed parsing. No broader CI/stream changes.

- 2026-10-31 06:57:28 append: `.task/os/review-run-follow-up-profile-and-harden-review-selection/workpad.md`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/review-typecheck-errors.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/tests/review-modernization.test.js`

## workspace-owned: activity log

- 2026-10-31 06:57:28 fs.write: `.task/os/review-run-follow-up-profile-and-harden-review-selection/workpad.md`
- 2026-10-31 06:58:01 append: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 06:58:01 fs.write: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 06:58:09 fs.write: `.task/os/review-run-follow-up-profile-and-harden-review-selection/workpad.md`
- 2026-10-31 06:58:47 fs.write: `packages/workspace/scripts/lib/review-typecheck-errors.js`
- 2026-10-31 06:59:47 fs.write: `packages/workspace/scripts/review.js`
- 2026-10-31 07:01:53 fs.write: `.task/os/review-run-follow-up-profile-and-harden-review-selection/workpad.md`

## Baseline (pre-edit)

On the task worktree HEAD, selected 60 tracked workspace script/test files and ran the pre-existing per-file Git diff sequence (`base...HEAD`, `HEAD`, `--staged`) for each one. **180 Git subprocesses took 2,354 ms** using Bun `performance.now()`. New implementation must compare with the same 60-file input and report the actual subprocess count/time; this only benchmarks changed-line attribution, not the entire review.

- 2026-10-31 06:58:09 append: `.task/os/review-run-follow-up-profile-and-harden-review-selection/workpad.md`

- 2026-10-31 06:58:47 write: `packages/workspace/scripts/lib/review-changed-lines.js`
- 2026-10-31 06:58:47 write: `packages/workspace/scripts/lib/review-typecheck-errors.js`

- 2026-10-31 06:59:11 apply-patch: `packages/workspace/scripts/review.js`
- 2026-10-31 06:59:11 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-10-31 06:59:11 apply-patch: `packages/workspace/test-selection.registry.json`
- 2026-10-31 06:59:11 apply-patch: `packages/workspace/tests/review-modernization.test.js`

- 2026-10-31 06:59:47 write: `packages/workspace/scripts/review.js`

## workspace-owned: validation evidence

- 2026-10-31 07:00:53 `review.run`: passed — OK
- 2026-10-31 07:01:22 `verify`: passed — OK

## Execution evidence (2026-10-31)

- RED: 22 focused tests ran with 8 intentional failures before implementation (14 passing pre-existing tests).
- GREEN: 22/22 focused tests passing after implementation.
- Real modified-file equivalence: old/new Git changed-line attribution identical for reviewer, modernization test, rules, and registry (4/4).
- 60 tracked-file microbenchmark (same worktree/commands, Bun performance.now): 180 Git subprocesses / 2,376 ms before; 3 subprocesses / 47 ms after (~50.3x for this stage). Earlier baseline 2,354 ms. This measures only changed-line attribution, not full review execution.
- Review.run strict no-tests: 0 yours, 0 related, 0 pre-existing, no failed suites.
- Full verify: passed, publish-valid, 3 critical selected suites all passed (workspace publish gate, reviewer/selector, test selection), and DB guard 0 risks/0 findings.
- All changed files: `packages/workspace/scripts/review.js`, `packages/workspace/scripts/lib/review-changed-lines.js`, `packages/workspace/scripts/lib/review-typecheck-errors.js`, `packages/workspace/tests/review-modernization.test.js`, `packages/workspace/test-selection.rules.json`, `packages/workspace/test-selection.registry.json`.
- Git diff --check clean.
- Errors during workflow: inline code.call program resolves imports from a generated temp script, not process.cwd(); fixed to use absolute path. A generated fs.apply_patch hunk did not match; used fs.read + fs.write scoped to task, then reviewed diff and reran tests.
- Publication: task PR #2747 targeting stream/os, pending promotion at evidence capture time. No main merge or deployment authorized.

- 2026-10-31 07:01:53 write: `.task/os/review-run-follow-up-profile-and-harden-review-selection/workpad.md`
