# DEV-1637 repair CI merge readiness exact-head fencing and complete check retrieval

branch: `task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2698
started: 2026-10-29

## acceptance criteria

- [x] Record the test-first contract and red/green tests before production changes.
- [x] Superseded canceled runs become nonblocking only with safely identified effective workflow runs.
- [x] Preserve distinct workflow/matrix contexts and fail closed for real failures, missing jobs, pending/unknown contexts.
- [x] Check retrieval is complete, paginated, includes legacy statuses, and fails closed on truncation/provider errors.
- [x] Exact PR head SHA is required at GitHub merge for normal and squash modes.
- [x] Mirror OS/workspace code and preserve existing parity classification.
- [x] Run focused tests, real read-only regression, review and full verify before publishing to stream.
- [ ] Publish task PR and stream review PR; add exact SHAs/evidence to Linear. Main integration remains coordinator-owned.

## plan

1. Read the current stream, DEV-1630, and relevant code and test contracts.
2. Write RED regression tests before changing code; implement minimal fail-closed fixes; prove GREEN.
3. Verify historical GitHub PR evidence, mirror scripts, review static checks, run selection/review/verify.
4. Publish via task.push followed immediately by task.pr; report exact SHAs and leave main unchanged.

## files changed

- `packages/workspace/scripts/lib/task-merge-readiness.js` and `packages/os/scripts/lib/task-merge-readiness.js`
- `packages/workspace/scripts/lib/github.js` and `packages/os/scripts/lib/github.js`
- `packages/workspace/scripts/task-merge.js` and `packages/os/scripts/task-merge.js`
- `packages/workspace/tests/task-merge-readiness.test.ts`
- `packages/workspace/test-selection.rules.json`, `test-selection.registry.json`, and `tests/test-selection.test.js`

## key decisions

- Fail closed on unknown or partially read GitHub context results; never infer green from 100-row subsets.
- Treat order and provenance as proof requirements for removing canceled historical runs, without crossing workflow/matrix boundaries.
- Keep existing command modes and require `sha` GitHub precondition even on a merge without --wait.
- Explicit critical selector now covers the two GitHub helper script mirrors and runs both GitHub contract test suites; avoid coupling this targeted merge gate to unrelated all-OS package tests.

## notes for ko

- Two unrelated full-OS test failures remain visible to coordinator: PostHog read-only classifier list mismatch and previously corrupted Artifacts PNG fixture. Full package test: 3501 passed / 2 failed / 161 skipped / 7 todo, 2026-10-29.
- Source changes do not affect GitHub protected-branch required checks.

## improvements noticed

- Preexisting scripts documentation audit drift, outside DEV-1637.

## errors i ran into

- `fs.write` concurrent workpad history emitted 14 NULs; corrected workpad in the isolated task worktree, no external branches affected.
- Initial full verification encountered an auto-discovered unrelated OS package test; mapped GitHub merge helpers into existing focused critical selector, added red/green selector regression and ran full package separately for transparent evidence.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/github.js`
- `packages/os/scripts/lib/task-merge-readiness.js`
- `packages/os/scripts/task-merge.js`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/lib/task-merge-readiness.js`
- `packages/workspace/scripts/task-merge.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/task-merge-readiness.test.ts`
- `packages/workspace/tests/test-selection.test.js`

## DEV-1637 test-first contract (2026-10-29)

- Behavior: exact PR-head SHA must be passed as GitHub merge precondition, regardless of default/squash or --wait; changed PR head rejects via GitHub 409/422.
- Behavior: only superseded check runs from the same independently identified workflow are ignored; cross-workflow equal names and matrix duplicate jobs remain separate; current failures, missing replacement jobs, pending/unknown checks remain blocking.
- Behavior: fetch all GraphQL commit statusCheckRollup pages with totalCount and cursor verification, including legacy StatusContext nodes; never infer green from truncated, ambiguous or failed reads.
- Local pattern: packages/workspace/tests/task-merge-readiness.test.ts (Vitest); mirrored scripts packages/workspace and packages/os; githubRequest supports GraphQL POST /graphql.
- Tests first: extend task-merge-readiness.test.ts with 37-to-19 reproduction, cross-workflow collisions, matrix, missing/failed/pending/unknown and 105-item pagination, GraphQL failures/status contexts, sha-conditional merge with request stub.
- Focused RED: bunx vitest run packages/workspace/tests/task-merge-readiness.test.ts (from repository root); expect missing fetch summary export and unfiltered canceled outcomes, SHA omission.
- No-test waiver: none.
- Boundaries: no main merge, deployment, runtime update, auth/WAF/billing/carrier tests. DEV-1630 is already merged into stream baseline at 1d0d2f8b59801ef7fea1b94a37e90151da15835e; do not modify its binary publisher logic.

- 2026-10-29 21:17:54 append: `.task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval/workpad.md`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/task-merge-readiness.js`

## workspace-owned: activity log

- 2026-10-29 21:17:54 fs.write: `.task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval/workpad.md`
- 2026-10-29 21:19:05 apply-patch: `packages/workspace/tests/task-merge-readiness.test.ts`
- 2026-10-29 21:20:18 write: `packages/os/scripts/lib/task-merge-readiness.js`
- 2026-10-29 21:20:18 write: `packages/workspace/scripts/lib/task-merge-[fs.write concurrent log truncated]
- 2026-10-29 21:20:18 fs.write: `packages/workspace/scripts/lib/task-merge-readiness.js`
- 2026-10-29 21:20:41 apply-patch: `packages/workspace/scripts/lib/github.js`
- 2026-10-29 21:20:41 apply-patch: `packages/os/scripts/lib/github.js`
- 2026-10-29 21:20:41 apply-patch: `packages/workspace/scripts/task-merge.js`
- 2026-10-29 21:20:41 apply-patch: `packages/os/scripts/task-merge.js`
- 2026-10-29 21:24:47 fs.write: `.task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval/workpad.md`
- 2026-10-29 21:28:58 fs.write: `.task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 21:21:26 `audit`: failed — COMMAND_FAILED
- 2026-10-29 21:23:25 apply-patch: `packages/workspace/tests/task-merge-readiness.test.ts`
- 2026-10-29 21:24:06 apply-patch: `packages/workspace/scripts/lib/task-merge-readiness.js`
- 2026-10-29 21:24:06 apply-patch: `packages/os/scripts/lib/task-merge-readiness.js`
- 2026-10-29 21:25:06 `review.run`: passed — OK
- 2026-10-29 21:26:17 `verify`: failed — COMMAND_FAILED
- 2026-10-29 21:30:13 `review.run`: passed — OK
- 2026-10-29 21:30:48 `verify`: failed — COMMAND_FAILED
- 2026-10-29 21:33:15 `review.run`: passed — OK
- 2026-10-29 21:33:31 `verify`: passed — OK

## DEV-1637 implementation and validation evidence

- Baseline: origin/stream/os at 1d0d2f8b59801ef7fea1b94a37e90151da15835e, after completed DEV-1630.
- TDD RED: 12-suite first run: 7 expected failures, 5 preexisting passes. Added two adversarial tests: 2 expected failures, 12 passes. No test skipped or weakened.
- TDD GREEN: bunx vitest run packages/workspace/tests/task-merge-readiness.test.ts => 14/14 passing (2026-10-29 17:24 EDT).
- Live read-only proof: GitHub PR #2651 at head 56aea5499b851bef4b2a357f37e9248eca84407e -> statusCheckRollup 37 historical entries; effective merge readiness returns passed, total 19, passed 19, failed 0, pending 0, matching gh pr checks.
- Retrieval: GraphQL commit statusCheckRollup cursor/totalCount verified across all pages; CheckRun + legacy StatusContext included, unique context IDs enforced to reject repeated pages and partial response/read failures; absent/unknown contexts block.
- Workflow deduplication: a superseded run is removed only if a strictly latest run from the same workflow is established by ordered workflow-run metadata and check start ordering; matrix members and cross-workflow same-name jobs are never coalesced; missing replacement jobs and ambiguous ordering block.
- Exact-head: task-merge sends the PR head SHA to mergePullRequest for --wait and no-wait paths; GitHub PUT sha precondition applies in default or --squash mode, and a mocked concurrent SHA change returns 409 with no retry/bypass.
- Mirroring: packages/os and packages/workspace script changes kept paired; existing task-merge.js divergent imports preserved.
- GitHub historical nuance: commit-level statusCheckRollup is also the semantics used by gh pr checks. GitHub now links some historic same-SHA workflow runs to a later PR; this is commit-SHA readiness, not an assertion that each historic workflow run is uniquely associated with PR #2651. GitHub's merge endpoint will still reject a changed head or required-check violation.
- Audit/scripts result: pre-existing unrelated SCRIPTS parity drift: missing documentation railway:logs, railway:redeploy, research:ingest, tools:search; undocumented docs:deploy, media:svg, os:release-workspace-edge, web:deploy. Scope excluded; no changes to script inventory/docs.
- No main merge, deploy, runtime update, auth/WAF, billing or calls performed.

- 2026-10-29 21:24:47 append: `.task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval/workpad.md`

## Test-first contract — selector follow-up

- Behavior: changes to both mirrored github.js merge transport helpers must select focused merge-readiness plus github helper tests, and must not incidentally select the all-OS package suite; preserve all other existing selectors. The broad OS suite was run explicitly: 3501 passed, two unrelated failures (PostHog manifest classifier drift and corrupt PNG fixture), 161 skipped, 7 todo; no safety gates are bypassed at GitHub.
- Test to write first: change test-selection.test.js to include packages/os/scripts/lib/github.js and workspace mirror in the exact changed-file contract, assert focused suite selection, and assert broad package test is absent; run RED then amend explicit critical mapping/registry. Focused RED command: bunx vitest run packages/workspace/tests/test-selection.test.js -t 'agent-boundary tooling changes'.
- Workpad NUL metadata issue: 14 NUL bytes emitted during concurrent fs.write history logging; replaced with descriptive text using task-scoped Bun file write, preserved all remaining workpad content and other worktrees.

- 2026-10-29 21:28:58 append: `.task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval/workpad.md`

- 2026-10-29 21:29:14 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-10-29 21:29:25 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-10-29 21:30:00 apply-patch: `.task/os/dev-1637-repair-ci-merge-readiness-exact-head-fencing-and-complete-check-retrieval/workpad.md`

- 2026-10-29 21:31:39 apply-patch: `packages/workspace/scripts/lib/github.js`
- 2026-10-29 21:31:39 apply-patch: `packages/os/scripts/lib/github.js`
