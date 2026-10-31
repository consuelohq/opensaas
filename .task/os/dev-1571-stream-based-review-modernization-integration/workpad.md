# DEV-1571 stream based review modernization integration

branch: `task/os/dev-1571-stream-based-review-modernization-integration`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2737
started: 2026-10-31

## acceptance criteria

- [x] Integrate only the verified DEV-1571 patch, without accidentally merging the divergent `main` history or changing other stream tasks.
- [x] Preserve all stream-owned test-selection rules; add a critical dedicated reviewer regression suite and regenerate the registry on the stream base.
- [x] Preserve `review --mine` task-local script, Bun/Vitest-aware selection, fail-closed results, and scoped Nx discovery.
- [x] Re-run focused tests and confirm no new regressions on the stream base.
- [x] Full strict review and publish-valid `verify` against current stream base, with no unresolved findings.
- [ ] Promote to `stream/os`, complete the task, mark Linear DEV-1571 `done`. Do not merge main or deploy.

## plan

1. Started first DEV-1571 task at `main`: https://github.com/consuelohq/opensaas/pull/2735, verified at `aa648f1738be524457833edcdfa9bb63e49357f4`.
2. Attempted task.pr promotion; GitHub refused merge due diverged `main`/`stream/os` history and non-metadata conflicts, including unrelated `task-merge-readiness.test.ts`.
3. Created this new managed task directly from `stream/os`. Cherry-picked the exact DEV-1571 commit in no-commit mode to avoid pulling unrelated main history; conflicts only in `test-selection.rules.json` and generated registry.
4. For rules: retained the current stream's complete rule catalog (including `os-task-push-binary-publication`) and inserted only `workspace-review-run-modernization`. Regenerated the stream-owned test registry with the repository tool. Both conflicts are resolved, cherry-pick sequencer exited; no force push or history rewriting.
5. Run strict review and full verify on current stream base; publish scoped task, promote through stream PR, and update Linear.

## Test-first contract and validation

- The implementation's TDD RED evidence and design are in the first DEV-1571 task workpad `.task/os/dev-1571-modernize-and-speed-up-review-run/workpad.md` and task PR #2735.
- Initial 9 regressions RED before changing implementation; added RED/GREEN checks for --all source selection, scoped Nx discovery, critical rule ownership, --mine task-local review, and incomplete test execution.
- This integration has the exact verified production patch; adapted only concurrent test-selection JSON to the stream base.
- Focused GREEN on stream: `bun x vitest run packages/workspace/tests/review-modernization.test.js packages/workspace/tests/review-run-state.test.js packages/workspace/tests/review-documentation-opportunity.test.js packages/workspace/tests/verification.test.js packages/workspace/tests/test-selection.test.js`: 128/128 passed, five suites, October 31 2026.
- Original main-based full verify passed (`publishValid=true`), 3 selected suites, zero blocking review findings, DB guardrails passed; reverify here before publication.
- Integration strict standalone review against `origin/stream/os`: exit 0, 3 selected suites PASS, zero own/related findings.
- Stream-based `verify`: `passed=true`, `publishValid=true`, review passed, selected suites passed, DB guardrails passed, no blocking findings. Stamp in this task's `verify.json`.
- No dependency additions or package manager migration needed; Hono is a web framework, not a testing framework.

## files changed

- `packages/workspace/scripts/lib/nx-projects.js`
- `packages/workspace/scripts/lib/review-tests.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/review-modernization.test.js`

## key decisions

- Prefer a stream-based isolated task over merging main to stream during task promotion: main vs stream merge would touch 615 files and conflicts include unrelated tests.
- Conflict resolution used current stream `test-selection.rules.json` as the authoritative base and injected only the new rule, preserving concurrent work.
- No changes to review coverage policy in `verify`, no app runtime or deployment changes.

## notes for ko

- `review.run` now follows the shared CI selector for Bun/Vitest/Jest/OS/Dialer/docs/sites, avoiding legacy Jest-only omissions.
- `--mine` invokes the reviewer version in the actual task worktree, not the main caller's potentially outdated source.
- Changed-file Nx project lookup measured ~4.9s before and ~1.1s after locally; not a general speed guarantee.

## improvements noticed

- More speed could come from safely batching per-package `npx eslint` invocations, but that was left untouched to avoid sacrificing package-specific lint rules.

## errors i ran into

- Original task promotion failed because diverged main/stream history caused three merge-tree conflicts, one in unrelated merge-readiness tests.
- New stream-based cherry-pick had two shared JSON conflicts. Resolved by preserving stream base plus the new rule and regenerating the registry. No other conflicts remained.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): integrate DEV-1571 reviewer modernization on OS stream" --changed
bun run task:pr
bun run task:finish
```

- 2026-10-31 05:26:53 write: `.task/os/dev-1571-stream-based-review-modernization-integration/workpad.md`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/nx-projects.js`
- `packages/workspace/scripts/lib/review-tests.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/review-modernization.test.js`

## workspace-owned: activity log

- 2026-10-31 05:26:53 fs.write: `.task/os/dev-1571-stream-based-review-modernization-integration/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 05:27:39 `verify`: passed — OK

- 2026-10-31 05:27:46 apply-patch: `.task/os/dev-1571-stream-based-review-modernization-integration/workpad.md`