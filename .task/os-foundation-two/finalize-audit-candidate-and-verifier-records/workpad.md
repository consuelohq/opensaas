# Finalize audit candidate and verifier records

branch: `task/os-foundation-two/finalize-audit-candidate-and-verifier-records`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1679/finalize-audit-candidate-and-verifier-records
github pr: https://github.com/consuelohq/opensaas/pull/1679
started: 2026-07-27

## acceptance criteria

- [x] Replace every 23h “second candidate SHA” requirement with the latest numbered frozen candidate SHA.
- [x] Require every cross-wave journey and final acceptance result to apply to that exact latest SHA.
- [x] Add synthesis verifier and replacement-rationale fields to the finding ledger.
- [x] Enforce both contracts in the plan validator.
- [x] Run focused red/green, full plan validation, formatting, strict review, and verify.
- [x] Merge PR #1679 and disposition both current-head Codex threads.

## plan

1. Read the two current-head Codex findings and affected blocks.
2. Capture focused red assertions.
3. Apply minimal 23h, ledger, and validator fixes.
4. Run focused green, plan validation, formatting, strict review, and verify.
5. Publish and merge PR #1679, then disposition the original threads.

## current status

- Both final Codex findings are fixed. Focused assertions, full plan validation, formatting, and strict review are green; preparing verify and publish.

## files changed

- `workers/23h-cross-wave-final-go-no-go.md`: every journey and acceptance gate now applies to the exact latest numbered frozen candidate SHA, including a clean round-one candidate.
- `reviews/final/finding-ledger.md`: adds explicit synthesis-verifier and replacement-rationale fields.
- `workers/validate-plan.ts`: enforces both final contracts.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 19:11:33 `review.run`: passed — OK
- 2026-07-27 19:11:56 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

## Test-first contract

- Focused behavior: 23h evidence always applies to the latest numbered frozen candidate, and verifier replacement identity/rationale has a durable validated ledger field.
- Red command: focused Bun assertions over 23h, the ledger, and validator.
- Expected red: two named failures.
- Runtime-test waiver: planning Markdown and structural validation only.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```
