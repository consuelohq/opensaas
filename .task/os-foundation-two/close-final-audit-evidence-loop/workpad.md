# Close final audit evidence loop

branch: `task/os-foundation-two/close-final-audit-evidence-loop`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1678/close-final-audit-evidence-loop
github pr: https://github.com/consuelohq/opensaas/pull/1678
started: 2026-07-27

## acceptance criteria

- [x] Permit repeatable candidate-freeze and verification rounds after domain or synthesis repairs.
- [x] Assign repair verification and GitHub-thread disposition ownership for 23h-raised findings.
- [x] Add per-finding validation evidence to the shared ledger.
- [x] Add required GitHub review-output links to every 23a-23g report template.
- [x] Add the full synthesis intent-lineage matrix to the 23h report template.
- [x] Extend plan validation so none of these evidence contracts can be removed silently.
- [x] Run focused red/green, full plan validation, formatting, strict review, and verify.
- [x] Publish PR #1678 and disposition all five current-head Codex threads.

## plan

1. Read the five current-head Codex findings and exact affected blocks.
2. Capture focused red assertions for all five evidence-loop gaps.
3. Apply minimal orchestrator, 23h, ledger, report-template, and validator fixes.
4. Run focused green, full plan validation, formatting, strict review, and verify.
5. Publish PR #1678, merge to the stream, and disposition the original GitHub threads.

## current status

- All five current-head Codex findings are fixed. Focused assertions, full plan validation, formatting, and strict review are green; preparing verify and publish.

## files changed

- `workers/23-final-integration-audit.md`: supports repeatable numbered review/freeze rounds after both domain and synthesis repairs.
- `workers/23h-cross-wave-final-go-no-go.md`: assigns synthesis repair verification and disposition to the same independent 23h reviewer or a recorded independent replacement.
- `reviews/final/finding-ledger.md`: records per-finding validation evidence.
- `reviews/final/23a-report.md` through `23g-report.md`: link the structured review object, top-level summary, agent-fix prompt, and disposition index on GitHub.
- `reviews/final/23h-go-no-go.md`: persists the synthesis intent-lineage matrix.
- `workers/validate-plan.ts`: enforces all five evidence-loop contracts.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 19:01:31 `review.run`: passed — OK
- 2026-07-27 19:01:56 `verify`: passed — OK

## key decisions

- The review-only PR head may advance between explicitly numbered review rounds, including after 23h findings; it must remain immutable within a round.
- The same independent 23h reviewer verifies synthesis repairs unless the orchestrator records a fresh independent replacement.
- Repository reports must carry direct links to the required GitHub artifacts, not merely finding threads.
- The 23h report must preserve its independently reconstructed requirement-level intent lineage.

- Grok 4.5 remains unavailable because the provider returned 402 usage balance exhausted; no Grok result is claimed.

## notes for ko

## improvements noticed

- none yet

## issues and recovery

- none yet

## Test-first contract

- Focused behavior: iterative synthesis repair rounds remain executable; synthesis verifier ownership is explicit; ledger/report templates persist all required evidence.
- Red command: focused Bun assertions over the orchestrator, 23h brief, finding ledger, seven domain reports, 23h report, and validator.
- Expected red: five named evidence-loop failures matching the current-head Codex findings.
- Runtime-test waiver: audit-plan Markdown and structural validator policy only; focused assertions and full plan validation are the behavioral tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/reviews/final/finding-ledger.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
