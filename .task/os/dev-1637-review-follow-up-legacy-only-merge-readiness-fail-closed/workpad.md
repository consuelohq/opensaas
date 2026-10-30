# DEV-1637 review follow-up legacy-only merge readiness fail closed

branch: `task/os/dev-1637-review-follow-up-legacy-only-merge-readiness-fail-closed`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2706
started: 2026-10-30

## acceptance criteria

- [x] Defined explicit acceptance criteria and captured a failing test before production edits.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- packages/os/scripts/lib/task-merge-readiness.js
- packages/workspace/scripts/lib/task-merge-readiness.js
- packages/workspace/tests/task-merge-readiness.test.ts

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

## DEV-1637 review follow-up — test-first contract

Issue: https://linear.app/consuelo/issue/DEV-1637/repair-ci-merge-readiness-exact-head-fencing-and-complete-check
Review: https://github.com/consuelohq/opensaas/pull/2656#discussion_r4418255735 and #discussion_r4418255767
Observed: Both mirrored summarizeCheckRuns copies return PASSED when GitHub GraphQL rollup contains only a green legacy StatusContext, although Actions contexts may not yet exist. Other stream review comments belong to PostHog/media/browser and must remain separate.

Acceptance:
- A terminal SUCCESS legacy-only rollup is PENDING, including when a non-Actions check (e.g. CodeRabbit) is green.
- A real GitHub Actions CheckRun + successful legacy status can be PASSED. A failed legacy status remains FAILED; pending/unknown remain blocking.
- No change to canceled-run deduplication, pagination, SHA fencing or independent workflows; mirrors stay byte-for-byte identical.
- Add targeted failing tests before edits and run RED, then GREEN, entire critical selector, strict review and full verify.
- Publish scoped follow-up through task.push then task.pr. No pushing directly to main. Assess stream->main conflicts and unrelated review blockers before any main release; do not bypass or merge unrelated unsafe changes.

Test-first:
- New tests: all-legacy success (pending), status+third-party checkrun (pending), successful status + identified Actions workflow (passed), failed status (failed), preserving existing no-check and historical-context cases.
- Focused RED: bunx vitest run packages/workspace/tests/task-merge-readiness.test.ts (or canonical test runner).
- Expect RED: legacy-only success initially returns passed.
- No-test waiver: none.

- 2026-10-30 20:02:38 append: `.task/os/dev-1637-review-follow-up-legacy-only-merge-readiness-fail-closed/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 20:02:38 fs.write: `.task/os/dev-1637-review-follow-up-legacy-only-merge-readiness-fail-closed/workpad.md`
- 2026-10-30 20:03:43 fs.write: `.task/os/dev-1637-review-follow-up-legacy-only-merge-readiness-fail-closed/workpad.md`

## Validation progress — 2026-10-30
- Test-first RED reproduced: 15-suite run had 14 pass, 1 fail; legacy-only SUCCESS returned PASSED instead of PENDING.
- Mirror patch rejects no-effective-Actions conditions when legacy status exists, preserving failed precedence and unchanged behavior without legacy contexts.
- Targeted GREEN: 15/15 passes; helpers byte-identical; git diff --check clean.
- GitHub current main protection: no classic required status checks; main ruleset active (review details assessed separately). This does not warrant bypassing readiness.
- Stream review PR #2656 remains CONFLICTING against main with unrelated PostHog/media/browser review items; do not merge unrelated payload as part of DEV-1637 without resolving cross-lane concerns.

- 2026-10-30 20:03:43 append: `.task/os/dev-1637-review-follow-up-legacy-only-merge-readiness-fail-closed/workpad.md`

## workspace-owned: validation evidence

- 2026-10-30 20:03:59 `review.run`: passed — OK
- 2026-10-30 20:04:29 `verify`: passed — OK

## Final focused gates
- Focused 9 Vitest suites, 139/139 green (readiness, GitHub helper/review/source-control, selector).
- Strict review/noTests: 0 new, 0 preexisting, 0 blockers, eslint/typecheck/spec clean.
- Both mirrored readiness helpers byte-identical, git diff --check clean.
- PR #2656 remains conflicted with main and contains unrelated PostHog and browser review findings; code from these lanes is not authorized to be bypassed by DEV-1637 release.
