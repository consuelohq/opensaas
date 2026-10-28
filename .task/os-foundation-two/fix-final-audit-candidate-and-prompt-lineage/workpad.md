# Fix final audit candidate and prompt lineage

branch: `task/os-foundation-two/fix-final-audit-candidate-and-prompt-lineage`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1677/fix-final-audit-candidate-and-prompt-lineage
github pr: https://github.com/consuelohq/opensaas/pull/1677
started: 2026-07-27

## acceptance criteria

- [x] Replace the ambiguous Worker 22 candidate freeze with the exact all-stream ordinary promotion PR head.
- [x] Require independent ancestry/inclusion proof for every required implementation stream and repair before freezing the audit SHA.
- [x] Encode exact approved original-prompt partitions for 23a-23h in the plan validator.
- [x] Reject missing, extra, or misassigned primary prompt paths, including accidental Worker 29 scope.
- [x] Enforce the approved implementation-intent union while explicitly classifying Workers 23, 27, and 29.
- [x] Run focused red/green assertions, plan validation, formatting, strict review, and full verify.
- [x] Publish and disposition the original Codex findings on PR #1674.

## plan

1. Read the two Codex findings, orchestrator candidate-freeze text, all 23a-23h prompt sections, and validator.
2. Capture focused red assertions for candidate authority and exact prompt partition enforcement.
3. Apply minimal orchestrator and validator changes.
4. Run focused green, full plan validation, formatting, strict review, and verify.
5. Publish PR #1677 and disposition the original GitHub threads.

## current status

- Both Codex lineage findings are fixed. Focused assertions, exact partition validation, full plan validation, formatting, and strict review are green; preparing verify and publish.

## files changed

- `workers/23-final-integration-audit.md`: freezes the ordinary all-stream promotion PR head and requires an ancestry table proving every required stream and repair is present.
- `workers/validate-plan.ts`: encodes and enforces exact primary prompt partitions for 23a-23h, required implementation-worker union, and 23/27/29 exclusions.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 18:51:39 `review.run`: passed — OK
- 2026-07-27 18:52:01 `verify`: passed — OK

## key decisions

- The frozen audit candidate is the ordinary all-stream promotion PR head, never a Worker 22 task branch or a single implementation stream.
- Exact primary prompt partitions are policy data in the validator, not inferred from prose.
- Required implementation-intent coverage is Workers 01-22, 24-26, 28, and 30. Worker 23 is the orchestrator, Worker 27 is review procedure, and Worker 29 is conditional on explicit Ko approval.

- Grok 4.5 remains unavailable because its provider balance returned 402; no result is claimed.

## notes for ko

## improvements noticed

- none yet

## issues and recovery

- none yet

## Test-first contract

- Focused behavior: the orchestrator must freeze the all-stream ordinary promotion PR head, and the validator must enforce each exact approved primary prompt set plus the required union/exclusions.
- Red command: focused Bun assertions over the orchestrator, 23a-23h briefs, and validator.
- Expected red: ambiguous Worker 22 freeze and absent exact prompt-partition policy.
- Runtime-test waiver: review-plan Markdown and structural validator policy only; focused assertions and the full plan validator are the behavioral tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/workers/23a-core-runtime-lifecycle-recovery-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`
