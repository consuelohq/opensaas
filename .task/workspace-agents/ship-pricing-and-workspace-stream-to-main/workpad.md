# ship pricing and workspace stream to main

branch: `task/workspace-agents/ship-pricing-and-workspace-stream-to-main`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1432/ship-pricing-and-workspace-stream-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1432
started: 2026-07-12

## acceptance criteria

- [x] Sync the workspace-agents stream with current `main` without discarding either side of the two guidance conflicts.
- [x] Preserve main's current engineering/safety doctrine while adopting the unified public `task.start` and subagent guidance from the stream.
- [ ] Rebuild PR #1380 so its effective diff is pricing-only and preserve the purposeful repository deletions already resolved on current `main`.
- [ ] Merge the cleaned pricing task into `stream/workspace-agents`.
- [ ] Run focused Workspace contracts, website pricing tests/build, review, and verify.
- [ ] Refresh and merge PR #1335 into `main` only after the combined stream is green.
- [ ] Record exact SHAs, checks, and any skipped/stale review findings.

## plan

1. Fetch current refs and re-audit PRs #1335 and #1380 against current `main`.
2. Merge current `main` into this task branch and semantically resolve `STEERING.md` and `senior-engineer.md`.
3. Validate the combined guidance and generated/tooling contracts, then merge this integration task into the stream.
4. Rebuild #1380 from the updated stream using only its pricing commits, force-push with Ko's explicit approval, and validate the reduced diff.
5. Merge #1380 into the stream, refresh #1335, run final stream checks, and merge #1335 to `main`.

## Test-first contract

- Behavior under test: the merged Workspace surface exposes one public `task.start`, subagent rather than worker contracts, current main safety/design doctrine, and a pricing-only #1380 diff.
- Existing pattern: current manifest/workflow/facade tests plus website structure/build checks.
- Focused tests: Workspace workflow-intent, tool-manifest, facade/test-selection tests; pricing route structure and website build.
- Red expectation: current stream cannot merge into main due to the two guidance conflicts; current #1380 includes unrelated history.
- No-test waiver: conflict-marker resolution itself is documentation integration, so proof is semantic inspection plus existing contract tests rather than a new unit test.

## current status

- Approved by Ko for semantic conflict resolution, the #1380 force-push rewrite, and merges to `main`.
- Integration task created from `stream/workspace-agents`.
- Current `main` merged and both guidance conflicts resolved semantically in commit `30d41968b5`.
- Focused contracts, strict review, and full verify are green; ready to merge this integration task into the stream.

## files changed

- `packages/workspace/STEERING.md`
- `packages/workspace/senior-engineer.md`
- task metadata/workpad/verify evidence

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-12 23:58:53 fs.write: `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/workpad.md`
- Task started after read-only conflict and review investigation.

## workspace-owned: validation evidence

- Preflight merge simulation identified only `packages/workspace/STEERING.md` and `packages/workspace/senior-engineer.md` as workspace-stream conflicts.
- Preflight showed #1380 was based on main and carried unrelated history relative to the stream.
- 2026-07-13 00:02:42 `review.run`: passed — OK
- 2026-07-13 00:03:11 `verify`: passed — OK
- Focused Workspace/OS contract run: 56 tests passed.
- `git diff --check` and conflict-marker scan passed.

## key decisions

- Combine both guidance versions semantically; never choose wholesale ours/theirs.
- `task.start` remains the sole public task-start entrypoint; reusable internal intent logic may remain internal.
- Rebuild #1380 rather than resolving unrelated inherited files.

## notes for ko

- Purposeful large deletions on current main are treated as resolved source-of-truth changes and will not be reintroduced or reverted through pricing cleanup.

## improvements noticed

- Deferred review debt is already captured in shared one-PR handoff prompts.

## issues and recovery

- `task.intent` returned a provisional session that cannot scope `task.start`; recovered by calling `task.start` without that provisional session, as required by the current workflow.
- An initial test-selection run used `bun --cwd packages/workspace`, which changed the repository root and produced two false failures. Reran the same suites from the repository root; all 56 focused tests passed.

---

## publish checklist

```bash
bun run task:push -- --message "chore(workspace): integrate stream with main" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-12 23:58:53 write: `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/workpad.md`

## workspace-owned: test selection

- changed files: `.github/actions/yarn-install/action.yaml`, `.task/tasks/workspace-agents/add-ko-social-persona-guide.json`, `.task/tasks/workspace-agents/clean-subagent-runtime-and-quiet-wait.json`, `.task/tasks/workspace-agents/fix-coderabbit-review-comments-for-pr-1335.json`, `.task/tasks/workspace-agents/fix-pr-1335-registry-suites.json`, `.task/tasks/workspace-agents/fix-pr-1335-workspace-contract-gate.json`, `.task/tasks/workspace-agents/promote-pr-review-collector-to-github-reviews.json`, `.task/tasks/workspace-agents/ship-pricing-and-workspace-stream-to-main.json`, `.task/tasks/workspace-agents/unify-task-intent-and-task-start-tooling.json`, `.task/workspace-agents/add-ko-social-persona-guide/current.json`, `.task/workspace-agents/add-ko-social-persona-guide/session.json`, `.task/workspace-agents/add-ko-social-persona-guide/workpad.md`, `.task/workspace-agents/clean-subagent-runtime-and-quiet-wait/current.json`, `.task/workspace-agents/clean-subagent-runtime-and-quiet-wait/session.json`, `.task/workspace-agents/clean-subagent-runtime-and-quiet-wait/verify.json`, `.task/workspace-agents/clean-subagent-runtime-and-quiet-wait/workpad.md`, `.task/workspace-agents/fix-coderabbit-review-comments-for-pr-1335/current.json`, `.task/workspace-agents/fix-coderabbit-review-comments-for-pr-1335/session.json`, `.task/workspace-agents/fix-coderabbit-review-comments-for-pr-1335/workpad.md`, `.task/workspace-agents/fix-pr-1335-registry-suites/current.json`, `.task/workspace-agents/fix-pr-1335-registry-suites/session.json`, `.task/workspace-agents/fix-pr-1335-registry-suites/workpad.md`, `.task/workspace-agents/fix-pr-1335-workspace-contract-gate/current.json`, `.task/workspace-agents/fix-pr-1335-workspace-contract-gate/session.json`, `.task/workspace-agents/fix-pr-1335-workspace-contract-gate/workpad.md`, `.task/workspace-agents/promote-pr-review-collector-to-github-reviews/current.json`, `.task/workspace-agents/promote-pr-review-collector-to-github-reviews/session.json`, `.task/workspace-agents/promote-pr-review-collector-to-github-reviews/verify.json`, `.task/workspace-agents/promote-pr-review-collector-to-github-reviews/workpad.md`, `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/current.json`, `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/evidence-log.json`, `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/read-log.json`, `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/session.json`, `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/workpad.md`, `.task/workspace-agents/unify-task-intent-and-task-start-tooling/current.json`, `.task/workspace-agents/unify-task-intent-and-task-start-tooling/evidence-log.json`, `.task/workspace-agents/unify-task-intent-and-task-start-tooling/read-log.json`, `.task/workspace-agents/unify-task-intent-and-task-start-tooling/session.json`, `.task/workspace-agents/unify-task-intent-and-task-start-tooling/verify.json`, `.task/workspace-agents/unify-task-intent-and-task-start-tooling/workpad.md`, `package.json`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/hooks/README.md`, `packages/os/hooks/intent.js`, `packages/os/hooks/task/workflow.js`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/subagent/runtime.ts`, `packages/os/scripts/subagent.ts`, `packages/os/scripts/task-start.js`, `packages/os/scripts/wait.js`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tests/workflow-intent.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/STEERING.md`, `packages/workspace/TOOLS.md`, `packages/workspace/hooks/README.md`, `packages/workspace/hooks/intent.js`, `packages/workspace/hooks/task/workflow.js`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/package.json`, `packages/workspace/scripts/github.js`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/pr-review-collector.js`, `packages/workspace/scripts/lib/subagent/runtime.ts`, `packages/workspace/scripts/pr-review.js`, `packages/workspace/scripts/subagent.ts`, `packages/workspace/scripts/task-start.js`, `packages/workspace/scripts/test-selection.js`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/scripts/wait.js`, `packages/workspace/senior-engineer.md`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/test-selection.registry.json`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/github-pr-reviews.test.ts`, `packages/workspace/tests/test-selection.test.js`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tests/tools-search-v2.test.ts`, `packages/workspace/tests/workflow-intent.test.ts`, `packages/workspace/tooling/tool-manifest.json`, `persona.md`
- matched rules: `workspace-facade`, `workspace-task-session`, `workspace-test-selection`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace task session tests`, `workspace test selection tests`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace task session tests` passed, `workspace test selection tests` passed, `workspace audit tests` passed
- failed suites: none

## workspace-owned: files read

- none yet
