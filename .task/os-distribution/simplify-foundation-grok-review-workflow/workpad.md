# Simplify foundation Grok review workflow

branch: `task/os-distribution/simplify-foundation-grok-review-workflow`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1552/simplify-foundation-grok-review-workflow
github pr: https://github.com/consuelohq/opensaas/pull/1552
started: 2026-07-22

## acceptance criteria

- [x] Move the complete foundation plan from ignored local state to a tracked GitHub path.
- [x] Reuse `packages/os/scripts/subagent.ts`; do not add another product review tool.
- [x] Replace the generic Grok prompt with the complete high-signal Consuelo review contract.
- [x] Make GitHub comments, reviews, checks, and PR state the durable review record.
- [x] Remove Worker 27 as a separately dispatched implementation task and unblock Wave 0.
- [x] Require workers to stop and repair/alignment-check a broken environment instead of bypassing it.
- [x] Prove the plan contract red/green and smoke the existing Grok 4.5 invocation.
- [ ] Review this PR through the same contract, fix valid findings, merge through the stream to `main`, and sync local `main`.

## plan

1. Copy the locally approved plan into a tracked `packages/os/plans` path.
2. Extend the plan validator with the new dispatch, GitHub, review, and environment contracts; capture the expected red result.
3. Update the master plan, prompt index, dispatch guide, Worker 27 procedure, and Grok template to satisfy those contracts.
4. Run focused validation and the existing OS Grok wrapper with workspace-first routing and enforced Grok plan permissions.
5. Publish, review on GitHub, fix valid findings, and promote through `stream/os-distribution` to `main`.

## current status

- Task started from fresh `main` at `92fdaf6129a644b02d5baff5a1884189527171c1`.
- Existing `packages/os/scripts/subagent.ts` supports Grok, explicit model selection, instruction files, task sessions, JSON output, and workspace-first routing. This task is making its read policy enforce Grok's real plan permission mode with bounded turns.
- The approved plan is tracked at `packages/os/plans/consuelo-os-foundation/` so GitHub is the source of truth.
- The plan validator and focused subagent tests are green.
- Live Grok 4.5 review smoke completed through the existing wrapper with trace `trc_edbcfdc7e509`.

## files changed

- `.gitignore`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
- `packages/os/plans/consuelo-os-foundation/**`
- `.task/os-distribution/simplify-foundation-grok-review-workflow/**`
- `.task/tasks/os-distribution/simplify-foundation-grok-review-workflow.json`

## workspace-owned: files changed

- No new product tool. The review lane is a committed prompt/procedure over the existing OS subagent wrapper.
- Generated review prompts are temporary and ignored under `packages/os/.tmp-reviews/`; GitHub is the durable review record.
- Environment failures are blockers to diagnose and fix, not reasons to fall back to another machine or unscoped tooling.
- Grok read-only reviews use native `--permission-mode plan`, bounded turns, disabled memory, and disabled subagents.

## workspace-owned: activity log

- Plan validator: `bun packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts` passed with 30 workers and all coverage flags true.
- Focused test: `bun x vitest run packages/os/tests/subagent-executable-discovery.test.ts` passed (6 tests).
- Live Grok smoke completed with provider `grok`, model `grok-4.5`, status `completed`, and trace `trc_edbcfdc7e509`.
- Workspace review and verification passed with a publish-valid `verify.json` stamp.
- Broad `script-parity-audit.test.ts` remains red because its committed classification fixture omits many pre-existing current OS/workspace scripts; this focused task does not rewrite that unrelated audit baseline.

## workspace-owned: validation evidence

- Reuse the existing OS `subagent` wrapper instead of adding another review tool.
- Treat GitHub reviews, comments, checks, and PR state as the durable review record.
- Store rendered prompts only in the ignored task-worktree path `packages/os/.tmp-reviews/<task>/` and remove them after posting the GitHub record.
- Stop when environment, authentication, provider/model, GitHub, or validation lanes are not trustworthy.
- Use workspace-first routing where available and enforce Grok's native plan permission mode for read-only reviews.

## key decisions

- After this PR reaches `main`, dispatch Wave 0 in parallel: Worker 02, Worker 13 (read/test-first slice), Worker 18 (bounded research/prototype), Worker 26, and Worker 28 (read-only audit).
- Every worker reads the master plan and assigned brief, uses its registered environment, runs the Grok review procedure, posts all durable results to GitHub, and closes chat with only `done` plus the PR URL.

## notes for ko

- The existing wrapper's generic read policy needed provider-native enforcement; this task now fails closed when Grok cannot enforce plan permissions.

## improvements noticed

- A prompt under `/tmp` was rejected by the existing repo-boundary guard. Recovery: use the ignored task-worktree path under `packages/os/.tmp-reviews/`.
- `--workspace-only strict` is unsupported by the Grok provider. Recovery: use workspace-first `preferred` routing plus Grok's native plan permissions.
- A first model probe emitted a transient fallback warning. `grok models` confirmed `grok-4.5` as available/default, and the repeated wrapper smoke completed without the warning.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```
