# sync documentation with latest main

branch: `task/documentation/sync-documentation-with-latest-main`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1957/sync-documentation-with-latest-main
github pr: https://github.com/consuelohq/opensaas/pull/1957
started: 2026-08-14

## acceptance criteria

- [ ] Bring current `main` commit `1e5140cdcf54d5cb34f5e47dba62f6ed3377ccdd` into the documentation stream without changing the reviewed documentation UI.
- [ ] Preserve all 18 mainline OS/auth files from that commit and all current docs-stream files.
- [ ] Keep `Digital workers` / `built on Consuelo` and the compact CTA layout unchanged.
- [ ] Validate the integrated tree, then merge this task PR into the stream with a real merge commit so `main` remains an ancestor (no squash-history loop).

## plan

1. Confirm the only main-unique commit is the current `stream/os` merge and inspect its file set/conflict risk.
2. Merge `origin/main` into this isolated task worktree. Because the main-unique files are outside `packages/documentation`, expect a clean merge; stop and inspect if any conflict appears.
3. Publish the resulting integrated tree to the task branch, record main ancestry on the task head, verify, then merge PR #1957 into `stream/documentation` with merge semantics rather than squash semantics.
4. Confirm GitHub reports the stream 0 commits behind `main` and PR #1954 is no longer dirty from ancestry divergence.

## Test-first contract

- No-test waiver: this is branch integration only. There is no new product behavior to specify with a red test. Verification will prove the integrated source tree, and the previously green documentation hero/browser tests remain unchanged because the main-only delta is in OS auth files.

## current status

- GitHub comparison immediately before task start showed exactly one commit unique to `main`: `1e5140cdcf54d5cb34f5e47dba62f6ed3377ccdd` (`Stream/os` cloud-first auth canary). Its 18-file delta is OS/task metadata, not documentation. Current stream head at task start: `7a5be593846108c8bda6ca4c0c911ead30364fe1`.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- none yet

## key decisions

- Do not use the standard `task.pr` squash promotion for this final sync: squash would lose the main-parent ancestry and recreate the same GitHub “behind main” loop. Use the typed task/GitHub merge path with a real merge commit after validation.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-14 09:53:18 apply-patch: `.task/documentation/sync-documentation-with-latest-main/workpad.md`