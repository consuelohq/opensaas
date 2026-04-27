# push stream sync results

branch: `task/workspace-agents/push-stream-sync-results`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/212
started: 2026-04-27

## acceptance criteria

- [x] confirm stream:sync resolved metadata-only conflicts locally but did not push the stream branch.
- [x] add push-after-checks behavior to stream:sync.
- [x] expose pushed state in stream:sync json output.
- [x] document that stream:sync pushes after checks pass.
- [ ] verify, push, promote into stream, and retest stream sync from repo root.


## plan

1. read workspace steering/docs and stream-sync.
2. add pushStreamBranch helper gated on passing stream checks.
3. wire both clean-merge and metadata-auto-resolve success paths to push.
4. update SCRIPTS.md and verify with smoke/review.


## files changed

- packages/workspace/SCRIPTS.md
- packages/workspace/scripts/stream-sync.js
- .task/workpad.md


## key decisions

- stream:sync was resolving the PR conflict locally but leaving origin/stream stale; pushing after successful checks is required for GitHub PR mergeability.
- stream:sync should not push when checks fail.


## notes for ko

- 

## improvements noticed

- 

## errors i ran into

- 

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```
