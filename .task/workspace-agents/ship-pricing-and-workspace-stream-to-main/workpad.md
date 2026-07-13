# ship pricing and workspace stream to main

branch: `task/workspace-agents/ship-pricing-and-workspace-stream-to-main`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1432/ship-pricing-and-workspace-stream-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1432
started: 2026-07-12

## acceptance criteria

- [ ] Sync the workspace-agents stream with current `main` without discarding either side of the two guidance conflicts.
- [ ] Preserve main's current engineering/safety doctrine while adopting the unified public `task.start` and subagent guidance from the stream.
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

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-12 23:58:53 fs.write: `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/workpad.md`
- Task started after read-only conflict and review investigation.

## workspace-owned: validation evidence

- Preflight merge simulation identified only `packages/workspace/STEERING.md` and `packages/workspace/senior-engineer.md` as workspace-stream conflicts.
- Preflight showed #1380 was based on main and carried unrelated history relative to the stream.

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

---

## publish checklist

```bash
bun run task:push -- --message "chore(workspace): integrate stream with main" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-12 23:58:53 write: `.task/workspace-agents/ship-pricing-and-workspace-stream-to-main/workpad.md`
