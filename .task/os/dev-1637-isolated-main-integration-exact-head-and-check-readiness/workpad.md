# DEV-1637 isolated main integration exact head and check readiness

branch: `task/os/dev-1637-isolated-main-integration-exact-head-and-check-readiness`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2708
started: 2026-10-30

## acceptance criteria

- [x] Defined explicit acceptance and test-first contract before source edits.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- packages/os/scripts/lib/github.js
- packages/workspace/scripts/lib/github.js
- packages/os/scripts/lib/task-merge-readiness.js
- packages/workspace/scripts/lib/task-merge-readiness.js
- packages/os/scripts/task-merge.js
- packages/workspace/scripts/task-merge.js
- packages/workspace/tests/task-merge-readiness.test.ts
- packages/workspace/test-selection.rules.json
- packages/workspace/test-selection.registry.json (regenerated)

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

## DEV-1637 scoped main integration — test-first contract

Working location: consuelohq/opensaas, source main 8e0e256372ee90fe899722d36e8cd6fb9165b357.
Task branch starts from main (not stream) to avoid merge conflicts and unrelated security/review findings in PR #2656. Original DEV-1637 task PR #2698 and follow-up #2706 are already merged to stream/os. This task is the separately authorized release of DEV-1637 to main; do not merge PR #2656 as a shortcut.

Acceptance:
- Capture all original DEV-1637 invariants: complete GraphQL pagination with status contexts, exact checked head SHA in merge API, cancellation dedup without masking failed/missing/matrix/workflow checks, and no fail-open on legacy-only statuses.
- Preserve main CI improvements and existing test selector rules; do not copy stream test-selection.rules.json wholesale. Mirror workspace and OS implementations where parity is mandated.
- Bring test-first regression fixtures across from the reviewed stream diff and run RED against existing main implementation before production edits. Validate with focused tests, strict review, full verify and exact-head real GitHub PR checks/reviews.
- Publish a specifically scoped GitHub main-target PR, not the broad conflicting stream PR. Do not deploy or update runtime/carrier/browser; no force/admin/auto/bypass.
- If conflicts or required checks become non-reconcilable, keep main unchanged and report precise blocker.

Test-first plan:
- First change tests to include robust DEV-1637 regression contracts and preserve main regression tests.
- Focused RED: bunx vitest run packages/workspace/tests/task-merge-readiness.test.ts.
- Expect failures for missing getPullRequestCheckSummary, SHA precondition and historical check dedup/legacy-only status.
- Then integrate only the reviewed helper, GitHub transport, task-merge and essential test-selection changes.
- No-test waiver: none.

PR initial target from session bootstrap is stream/os; must be retargeted to main for this deliberately isolated coordinator release once validated, not merged with task.pr into stream.

- 2026-10-30 20:06:33 append: `.task/os/dev-1637-isolated-main-integration-exact-head-and-check-readiness/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 20:06:33 fs.write: `.task/os/dev-1637-isolated-main-integration-exact-head-and-check-readiness/workpad.md`

## workspace-owned: validation evidence

- 2026-10-30 20:08:11 `review.run`: passed — OK
- 2026-10-30 20:08:53 `verify`: passed — OK

## Isolated main integration evidence
- Baseline main: 8e0e256372ee90fe899722d36e8cd6fb9165b357; original DEV-1637 and review fix from verified stream/os.
- Test-first RED: 9 failures / 6 passes with complete stream regression test against old main implementation, including missing pagination, SHA fencing and legacy-only fail-open.
- Focused GREEN after port: 15/15 readiness, 4+4 mirrored GitHub helpers. Wider 10 Vitest suites: 156/156 passing.
- Both mirrored GitHub transport and readiness helper files byte-identical; git diff --check clean.
- Existing main test selection retained, only critical merge readiness selector extended for both GitHub helper files; generated registry refreshed with canonical script.
- Strict review on scoped diff: 0 issues, 0 blockers; one informational documentation opportunity.
- GitHub main ruleset active deletion protection, no required_status_checks rule; does not change local fail-closed gate. Scoped PR must still use its exact SHA and visible CI/reviews.
- Avoid merging broad stream PR #2656 (current conflicting) or unrelated PostHog/media/browser changes.
