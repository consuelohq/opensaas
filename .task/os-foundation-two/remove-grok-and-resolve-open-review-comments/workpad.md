# Remove Grok and resolve open review comments

branch: `task/os-foundation-two/remove-grok-and-resolve-open-review-comments`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1680/remove-grok-and-resolve-open-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1680
started: 2026-07-27

## acceptance criteria

- [x] Resolve all five currently open CodeRabbit threads on PR #1674.
- [x] Remove every Grok and review-subagent invocation from Worker 23 and briefs 23a-23h.
- [x] Add a standalone assigned-worker review framework preserving the existing high-signal review quality bar.
- [x] State that original prompts are intent evidence only and their historical Grok/review execution instructions must not be followed.
- [x] Make requirement ownership authoritative across overlapping domain seams and define transfer/disposition rules.
- [x] Make the shared finding ledger orchestrator-owned, serialized, deterministic, and conflict-checked.
- [x] Restrict conditional promotion to an exact valid CONDITIONAL result with no unresolved P0/P1 and all P2 waivers recorded.
- [x] Enforce 23h GitHub output fields and all new contracts in the plan validator.
- [x] Post replies and resolve the CodeRabbit threads after current-head validation.

## plan

1. Enumerate unresolved CodeRabbit threads and verify each against the current stream head.
2. Inventory Grok/subagent references in Worker 23 artifacts and read the existing high-signal template.
3. Capture focused red assertions for the five CodeRabbit issues and the no-Grok worker contract.
4. Add the direct assigned-worker review framework and update the orchestrator, 23a-23h, reports/index, and validator.
5. Run focused green assertions, plan validation, formatting, strict review, and full verify.
6. Merge PR #1680 into the stream, reply to and resolve all five CodeRabbit threads, and request current-head review.

## current status

- Implementation and self-review complete. All five CodeRabbit issues are fixed in the packet; the final-audit agents now perform the full review directly with no delegated model, wrapper, or review subagent. Focused validation, plan validation, formatting, and strict review are green; preparing full verify and publication.

## files changed

- Added `workers/independent-review-framework.md` as the assigned-worker review-quality contract.
- Updated `workers/23-final-integration-audit.md` with direct-review ownership, authoritative seam domains, serialized ledger writes, and a safe conditional-promotion exception.
- Updated `workers/23a-*.md` through `workers/23h-*.md` to prohibit delegated review and supersede historical review instructions in original prompts.
- Updated final audit report templates with authoritative-domain and secondary-seam fields.
- Updated `reviews/final/finding-ledger.md` with a single-writer serialized protocol and deterministic/conflict-checked records.
- Updated `workers/README.md` and `reviews/final/README.md` with the direct-review contract.
- Extended `workers/validate-plan.ts` to enforce all new contracts and the five CodeRabbit findings.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 20:18:17 `review.run`: passed — OK
- 2026-07-27 20:18:43 `verify`: passed — OK

## key decisions

- Preserve the review quality framework but detach it completely from Grok, model wrappers, and delegated reviewers.
- The assigned 23a-23h task agent performs every inspection, judgment, GitHub post, repair verification, and disposition itself.
- Historical original-worker prompts remain product-intent evidence; their embedded review/execution instructions are non-operative.
- Existing automated comments, including CodeRabbit, are evidence to verify and disposition, never a substitute reviewer.
- Overlapping domains use an authoritative-domain owner plus secondary seam reviewers; only the owner can disposition a requirement/finding.
- The orchestrator is the sole ledger writer; domain agents post to GitHub and submit report data, avoiding concurrent Markdown edits.

## notes for ko

- No Grok invocation will be attempted for this task or required by the resulting Worker 23 packet.
- Five unresolved CodeRabbit threads were found on PR #1674: seam ownership, serialized ledger writes, Grok failure semantics, conditional promotion safety, and 23h GitHub-output validation.

## improvements noticed

- none yet

## issues and recovery

- A final no-delegation diagnostic initially scanned `validate-plan.ts` with the same forbidden regex it defines, producing a false positive. The orchestrator and all eight subbriefs had zero forbidden invocation matches. Recovery: scope the content check to executable worker instructions and separately verify that the validator contains the prohibition policy.

## Test-first contract

- Behavior: Worker 23 and 23a-23h must be self-contained direct reviews with no Grok/subagent invocation; the five CodeRabbit process contracts must be explicit and validator-enforced.
- Existing pattern: `workers/validate-plan.ts` structurally validates the final-audit packet and report templates.
- Focused red command: Bun assertion over the orchestrator, 23a-23h briefs, ledger/report templates, and validator.
- Expected red: Grok references present; no authoritative seam ownership; ledger not serialized; conditional exception too broad; 23h GitHub fields not enforced.
- Runtime-test waiver: documentation and structural validator changes only. Focused assertions, plan validation, formatting, strict review, and full verify replace runtime tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/reviews/final/23h-go-no-go.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23a-core-runtime-lifecycle-recovery-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/README.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`
- `packages/workspace/senior-engineer.md`
