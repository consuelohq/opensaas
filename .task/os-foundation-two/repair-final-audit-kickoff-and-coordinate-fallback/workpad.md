# repair final audit kickoff and coordinate fallback

branch: `task/os-foundation-two/repair-final-audit-kickoff-and-coordinate-fallback`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1686/repair-final-audit-kickoff-and-coordinate-fallback
github pr: https://github.com/consuelohq/opensaas/pull/1686
started: 2026-07-28

## acceptance criteria

- [x] Domain reviewers must inspect the exact completed foundation candidate even when Worker 23 did not pre-create synthetic audit branches or a review-only PR.
- [x] PR #1674 at immutable head `ef2530b136ec2a170915b583abfb2341899bd6ab` is an allowed authoritative review surface for the current completed foundation wave.
- [x] Missing audit plumbing is recorded as process debt, not treated as a reason to skip code review when an exact immutable candidate and GitHub surface are recoverable.
- [x] All Worker 23 briefs and the independent review framework use the same recovery rule.
- [x] Validator and focused assertions pass.

## plan

1. Inspect Worker 23 orchestration, framework, and 23a-23h coordinate language.
2. Replace hard-stop-only coordinate rules with deterministic recovery and fallback review surfaces.
3. Add validation assertions that forbid blocking solely because synthetic review plumbing is absent.
4. Run focused checks, plan validation, review, and verify.
5. Publish and merge the docs repair into `stream/os-foundation-two`.

## current status

- Repair complete and validated.
- All 23a-23h briefs now authorize PR #1674 at exact head `ef2530b136ec2a170915b583abfb2341899bd6ab` as the current round-one fallback review surface.
- Reviewers must inspect code when the exact immutable candidate and retained comparison are recoverable; missing synthetic audit branches or the dedicated review-only PR are process debt only.
- Focused assertions, Prettier, full plan validation, strict review, and full verify all pass.

## test-first contract

- Behavior under test: reviewers continue into code inspection when an exact immutable candidate can be recovered, even if synthetic audit branches or the dedicated review-only PR are missing.
- Existing pattern: plan validation and focused textual assertions over Worker 23 artifacts.
- New or changed tests: add validator requirements for coordinate recovery/fallback and reject hard-stop-only language.
- Focused red command: run targeted Python assertions against the current Worker 23 Markdown before edits.
- Expected red failure: current briefs contain `Stop if any of those coordinates drift or cannot be independently verified` and require only the canonical review-only PR.
- No-test waiver: docs-only workflow correction; validation is structural/textual plus the full plan validator and workspace review.

## files changed

- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/independent-review-framework.md`
- `packages/os/plans/consuelo-os-foundation/workers/23a-core-runtime-lifecycle-recovery-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23b-provider-control-plane-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23c-web-auth-launcher-traces-security-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23d-native-platform-local-control-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23e-distribution-release-ci-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23f-multi-node-registry-routing-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23g-repository-boundaries-operability-docs-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23h-cross-wave-final-go-no-go.md`
- `packages/os/plans/consuelo-os-foundation/workers/README.md`
- `packages/os/plans/consuelo-os-foundation/reviews/final/README.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-28 00:50:35 fs.write: `.task/os-foundation-two/repair-final-audit-kickoff-and-coordinate-fallback/workpad.md`
- GitHub state verified for PR #1674.
- Root-cause inspection completed across Worker 23 orchestrator, shared framework, and 23a-23h briefs.

## workspace-owned: validation evidence

- Focused pre-edit inspection showed the same hard-stop rule in 23a-23h.
- PR #1674 state verified: MERGED; head `ef2530b136ec2a170915b583abfb2341899bd6ab`; base `main`.
- Focused post-edit assertions: 8 briefs checked, zero errors.
- Prettier check: all matched files pass.
- Full plan validator: 30 workers, zero structural failures, zero missing references, zero forbidden matches.
- Strict `review.run --no-tests`: zero issues and zero blockers.
- Full `verify`: passed, publishValid true, zero DB risks.
- 2026-07-28 00:53:46 `review.run`: passed — OK
- 2026-07-28 00:54:02 `verify`: passed — OK
- 2026-07-28 00:54:27 `verify`: passed — OK

## key decisions

- Preserve exact-SHA review discipline.
- Remove synthetic audit-branch/PR existence as an absolute prerequisite to code inspection.
- Prefer the dedicated review-only PR when it exists; otherwise use the ordinary promotion PR, including a merged immutable PR, and its exact head/base comparison.
- Block only when no exact candidate and no authoritative comparison can be recovered.

## notes for ko

- The workers did not malfunction. They obeyed an over-constrained prompt and matching brief language.

## improvements noticed

- Worker dispatch prompts should state the intended terminal behavior first: review the completed code unless the code identity itself is unknowable.

## issues and recovery

- Initial `fs.read` calls were ambiguous because many active tasks existed. Started a dedicated task and used its taskSession.
- Initial `code.run` GitHub call used unsupported operation `pr.get`; corrected to `pr.view`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os-foundation): keep final audits reviewing recoverable candidates" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/reviews/final/README.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23a-core-runtime-lifecycle-recovery-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23b-provider-control-plane-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23c-web-auth-launcher-traces-security-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23d-native-platform-local-control-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23e-distribution-release-ci-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23f-multi-node-registry-routing-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23g-repository-boundaries-operability-docs-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23h-cross-wave-final-go-no-go.md`
- `packages/os/plans/consuelo-os-foundation/workers/independent-review-framework.md`
- `packages/workspace/senior-engineer.md`
