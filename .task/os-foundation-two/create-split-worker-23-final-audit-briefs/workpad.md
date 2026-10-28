# Create split Worker 23 final audit briefs

branch: `task/os-foundation-two/create-split-worker-23-final-audit-briefs`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1673/create-split-worker-23-final-audit-briefs
github pr: https://github.com/consuelohq/opensaas/pull/1673
started: 2026-07-27

## acceptance criteria

- [x] Keep `23-final-integration-audit.md` as the Worker 23 orchestrator.
- [x] Add seven domain audit briefs (`23a`-`23g`) and one synthesis brief (`23h`).
- [x] Require one review-only GitHub comparison PR spanning the full foundation diff.
- [x] Require direct GitHub inline findings, structured reviews, fix prompts, and dispositions.
- [x] Map each domain to original worker prompts and implementation/repair PRs.
- [x] Preserve Grok 4.5 high-signal review quality and severity rules.
- [x] Keep domain agents read-only and dispatch narrow repair tasks separately.
- [x] Add finding-ledger and eight domain/final report templates.
- [x] Validate references and contracts before publish.

## plan

1. Read the plan, Worker 23 brief, Grok template/procedure, registry, index, and validator.
2. Add a validator contract for `23a`-`23h` and capture red.
3. Author the orchestrator and eight briefs.
4. Update the index and Grok template direct-posting mode.
5. Run plan validation, strict review, verify, and publish PR #1673.

## current status

- Implementation and self-review complete. Plan validator, formatting, cross-reference audit, and strict repository review are green; preparing full verify and publish.

## files changed

- Reworked `workers/23-final-integration-audit.md` into the final-audit orchestrator.
- Added `workers/23a-*.md` through `workers/23h-*.md` domain and synthesis briefs.
- Added `reviews/final/README.md`, `finding-ledger.md`, seven domain report templates, and `23h-go-no-go.md`.
- Updated `workers/README.md` with the split audit sequence.
- Added `direct_audit_posting` to `workers/grok-review-template.md`.
- Extended `workers/validate-plan.ts` to enforce subbrief and report-template contracts.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 plan-validator red: exactly 8 missing subbrief failures.
- 2026-07-27 report-template red: exactly 10 missing template failures.
- 2026-07-27 plan validator: passed; 30 canonical workers, zero structural/reference/coverage failures.
- 2026-07-27 cross-reference audit: 8 briefs, all launch prompts covered, zero broken report links.
- 2026-07-27 Prettier check: all deliverable files formatted.
- 2026-07-27 18:32:30 `review.run --strict --mine --no-tests`: passed; zero findings and blockers.
- 2026-07-27 18:33:20 `verify`: passed — OK

## key decisions

- Use one canonical review-only PR from the pre-foundation baseline to the frozen final candidate.
- Worker 23 task agents post directly to GitHub; Grok remains read-only evidence.
- Original prompt files are authoritative intent inputs; PR closeouts are claims to verify.

## notes for ko

- Worker 22 can continue independently; this task is based on `main` and targets `stream/os-foundation-two`.

## improvements noticed

- Extended the validator for `23a`-`23h` and the report templates without changing the canonical 01-30 worker count.
- A single review-only baseline-to-candidate PR gives all domain reviewers one durable GitHub surface; oversized/omitted diff locations fall back to precise file-and-line top-level comments.

## issues and recovery

- Initial nested batch reads did not inherit `taskSession`; recovered with direct task-scoped reads. No plan files changed.

## Test-first contract

- Behavior: validator fails when an approved subbrief is missing or lacks GitHub, original-intent, OS, review, mission, or acceptance contracts.
- Red command: `bun packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`.
- Expected red: missing `23a`-`23h` files. Observed exactly eight missing-subbrief failures.
- Second red contract: missing report/ledger templates. Observed exactly ten missing-template failures.
- Runtime-test waiver: planning Markdown only; structural validator, strict review, and verify replace runtime tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-independent-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/27-grok-review-pipeline.md`
- `packages/os/plans/consuelo-os-foundation/workers/README.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`
- `packages/workspace/senior-engineer.md`
