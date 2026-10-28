# Sync stream OS with main for stable release

branch: `task/os/sync-stream-os-with-main-for-stable-release`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2197/sync-stream-os-with-main-for-stable-release
github pr: https://github.com/consuelohq/opensaas/pull/2197
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 04:47:54 fs.write: `.task/os/sync-stream-os-with-main-for-stable-release/workpad.md`
- 2026-08-26 04:49:47 fs.write: `.task/os/sync-stream-os-with-main-for-stable-release/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 04:50:23 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: stream/os reconciles main without source conflicts, generated selection data is rebuilt from both branches, and all launcher/auth/security focused gates remain green
existing local pattern: packages/workspace test-selection generator plus focused OS test suites selected by changed files
new or changed tests: none; this task is integration-only and must not alter product behavior
focused red command: git merge-tree --write-tree origin/main origin/stream/os
expected red failure: content conflict only in packages/workspace/test-selection.registry.json
no-test waiver: not applicable; merge-tree is the red integration contract and regenerated registry plus focused suites are the green proof

## Acceptance criteria

- [ ] Merge origin/main into the stream-based task branch.
- [ ] Resolve only the generated test-selection registry by regeneration.
- [ ] Prove registry, launcher, secrets, nodes, OAuth, and security focused gates.
- [ ] Promote the clean task to stream/os and make PR #2195 mergeable.
- [ ] Preserve one Codex review round; CodeRabbit is requested and currently rate-limited.

- 2026-08-26 04:47:54 append: `.task/os/sync-stream-os-with-main-for-stable-release/workpad.md`

## Merge and validation evidence

- `git merge-tree --write-tree origin/main origin/stream/os` failed only on generated `packages/workspace/test-selection.registry.json` as expected.
- Merged `origin/main`; all source files auto-merged. Regenerated the sole registry conflict from the combined rules and test inventory: 2,663 tests, 2,577 mapped, 86 unmapped, 68 rules.
- Workspace selection registry suite: 47/47 passed.
- Launcher, Secrets, Nodes, owner dashboard, device identity, OAuth, and approval hardening: 175/175 passed across 19 files.
- Security gateway: 29/30 passed; the sole failure is the pre-existing stale assertion for worker ports 9000/9001 while current pooled configuration correctly uses 46321/46322/46323. Ko explicitly approved passing unrelated failures.
- Static review against main before reconciliation found 0 issues across 34 source files.

- 2026-08-26 04:49:47 append: `.task/os/sync-stream-os-with-main-for-stable-release/workpad.md`
