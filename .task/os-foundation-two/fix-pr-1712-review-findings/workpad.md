# fix pr 1712 review findings

branch: `task/os-foundation-two/fix-pr-1712-review-findings`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1713/fix-pr-1712-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1713
started: 2026-07-29

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Report repair is complete and locally validated.
- Commit/push and branch-aware review/verify are next.
- PR #1712 closure remains intentionally pending until the repair is promoted to the stream.

## files changed

- `packages/os/plans/consuelo-os-foundation/reviews/final/23g-report.md`
- task metadata/workpad records

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-29 01:55:18 fs.write: `.task/os-foundation-two/fix-pr-1712-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-07-29 01:59:25 `review.run`: passed — OK

## key decisions

- Reconstructed the 45 requirement rows from the original audit branch, then expanded them deterministically to the required ten-column contract.
- Preserved `DOMAIN BLOCKED` and all six original finding dispositions; this task repairs review evidence only.
- Used PR #1674 base `702053057d19c066607d4508b49d42b183d17b32` and candidate `ef2530b136ec2a170915b583abfb2341899bd6ab`.

## notes for ko

- Consuelo OS bootstrap returned HTTP 404, so the configured typed workspace fallback was used.
- PR #1712 currently has no effective diff because its original audit record had already been promoted to the stream; repair PR #1713 is the current task surface.

## improvements noticed

- none yet

## issues and recovery

- Initial plan-validator command used a cwd-relative path that Bun did not resolve; retried once with the repository-relative script path and passed.
- Pre-commit `review.run` reported zero task files because it compares committed revisions; the branch-aware gate will be rerun after `task.push`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```

## Review-finding repair contract

### Acceptance criteria

- [x] Record PR #1674's verified base SHA and exact candidate SHA in `23g-report.md`.
- [x] Replace the six-column intent-lineage matrix with the required ten-column evidence/status/remediation matrix for every existing requirement row.
- [x] Link all six 23G finding threads plus the structured review, summary, consolidated fix prompt, and disposition record.
- [ ] Validate report structure and links, merge the repair to `stream/os-foundation-two`, then close superseded PR #1712.

### Plan

1. Preserve the original 45 requirement rows while expanding each to the Worker 23G contract.
2. Map automated/runtime evidence and disposition to the already-recorded findings and validation results; do not change the domain judgment.
3. Run deterministic report assertions, the foundation plan validator, workspace review, and publish verification.

### Test-first contract

- Change type: documentation-only audit-record repair.
- No-test waiver: no runtime behavior changes; replace a behavioral pretest with deterministic Markdown structure/link assertions and the existing foundation plan validator.
- Expected proof: exactly ten matrix columns, 45 data rows, verified base/candidate coordinates, and all ten required GitHub artifact URLs present.

- 2026-07-29 01:55:18 append: `.task/os-foundation-two/fix-pr-1712-review-findings/workpad.md`

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/reviews/final/23g-report.md`

## Pre-push validation

- Deterministic report structure: passed; 45 rows, ten columns each, zero placeholders.
- Durable GitHub evidence: passed; all six finding links and four required review-artifact links present.
- Exact coordinates: passed; base and candidate SHA recorded.
- Foundation plan/report validator: passed with zero structural failures and zero forbidden matches.
- Documentation-only no-test waiver applies; no runtime/product code changed.
- Initial strict review: zero task-owned/blocking findings, with 23 pre-existing Twenty SDK ESLint/typecheck findings; rerun required after commit.
