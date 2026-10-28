# Fix final audit review findings round two

branch: `task/os-foundation-two/fix-final-audit-review-findings-round-two`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1676/fix-final-audit-review-findings-round-two
github pr: https://github.com/consuelohq/opensaas/pull/1676
started: 2026-07-27

## acceptance criteria

- [x] Remove the copied domain-only conclusion from Worker 23h and retain final `GO`/`NO-GO` plus Worker 23 classification.
- [x] Add the exact Worker 23h brief reference to the final go/no-go report template.
- [x] Extend plan validation to enforce the 23h report-to-brief link.
- [x] Rename new immutable validator constants to repository-standard SCREAMING_SNAKE_CASE.
- [x] Rerun plan validation, formatting, strict review, and full verify.
- [x] Publish and disposition the three original GitHub review threads.

## plan

1. Read the three GitHub findings and exact affected blocks.
2. Capture a focused red contract reproducing all three issues.
3. Apply minimal documentation and validator fixes.
4. Run validator, formatting, strict review, and verify.
5. Publish PR #1676 into the stream and disposition PR #1674 threads.

## current status

- All three review findings are fixed. Focused assertions, full plan validation, formatting, and strict review are green; preparing verify and publish.

## files changed

- `workers/23h-cross-wave-final-go-no-go.md`: removed conflicting domain-only conclusion and clarified synthesis reviewer/report terminology.
- `reviews/final/23h-go-no-go.md`: added exact synthesis-brief traceability.
- `workers/validate-plan.ts`: renamed immutable constants and extended exact report-to-brief validation through 23h.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-27 18:43:20 `review.run`: passed — OK
- 2026-07-27 18:43:45 `verify`: passed — OK

## key decisions

- Worker 23h is the final synthesis and must not inherit domain-only return language.
- Report traceability includes 23h, not only 23a-23g.
- Follow the repository constant naming rule even though strict review did not flag it.

## notes for ko

- Grok 4.5 remains unavailable because the provider returned 402 usage balance exhausted; no Grok result is claimed.

## improvements noticed

- none yet

## issues and recovery

- An earlier repair task accidentally bootstrapped from `main`; it contained no product edits. This round-two task was created explicitly from `stream/os-foundation-two`.

## Test-first contract

- Focused behavior: 23h must issue the final decision, its report must link the exact brief, and new immutable validator constants must use SCREAMING_SNAKE_CASE.
- Red command: focused Bun assertion over the three affected files.
- Expected red: three named failures matching the Codex and Qodo findings.
- Runtime-test waiver: the change is review-plan Markdown plus structural validator policy; the focused assertion and plan validator are the behavioral tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/reviews/final/23h-go-no-go.md`
- `packages/os/plans/consuelo-os-foundation/workers/23h-cross-wave-final-go-no-go.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`
