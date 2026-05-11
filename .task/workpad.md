# investigate task session stale metadata reads

branch: `task/workspace-agents/investigate-task-session-stale-metadata-reads`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/371
started: 2026-05-11

## acceptance criteria

- [x] Reproduce the stale task metadata behavior with taskSession-scoped calls.
- [x] Identify whether the bug is in steering, the facade resolver, verify, task.push, or shared metadata fallback.
- [x] Patch the root cause so verify honors taskSession-resolved worktrees.
- [x] Update steering/docs with the durable taskSession rule.
- [x] Validate syntax, direct task-worktree verify behavior, review, and publish.

## plan

1. Use stream context and start a task branch from `stream/workspace-agents`.
2. Search context and explore workspace tooling around taskSession, verify stamps, task.push, and metadata.
3. Reproduce the stale behavior with a taskSession-scoped verify call.
4. Patch the owner script and docs.
5. Validate through direct worktree execution and publish.

## files changed

- `packages/workspace/scripts/verify.js`
- `packages/workspace/STEERING.md`
- `packages/workspace/SCRIPTS.md`

## key decisions

- The facade taskSession resolver is working: it resolves the task branch/worktree and injects `TASK_BRANCH` and `TASK_WORKTREE`.
- `task.push` is mostly safe when a branch/taskSession is present because it selects the active task worktree before checking `.task/verify.json`.
- `verify.js` was the concrete stale-state bug: it resolved `repoRoot` from `process.cwd()` and ignored `TASK_WORKTREE`, so `workspace.call({ tool: "verify", taskSession })` ran against the controller repo root and could read/write root `.task/verify.json`.
- The controller repo root currently has stale/conflicted `.task` metadata from older task/autostash state, which explains the observed wrong verify record.
- The correct fix is logic plus doctrine: scripts that write task-scoped state must honor `TASK_WORKTREE`, and steering should make taskSession-first final validation explicit.

## notes for Ko

- The stale-data issue is broader than one verify stamp pattern. Any workspace script that writes or reads task-scoped state while ignoring `TASK_WORKTREE` can leak root or other-task `.task/*` state.
- The current patch fixes `verify.js`, which was the reproduced failure path.
- `workspace.call({ tool: "verify" })` will still show the old controller-root behavior until this task is merged and the workspace server reloads, because the facade runs the controller repo’s current script version. The patched behavior was proven by running the patched script directly inside the task worktree.

## improvements noticed

- `verify.js` should maybe gain its own focused test fixture for `TASK_WORKTREE` in a follow-up. Current validation is a direct runtime smoke.
- Root `.task/verify.json` is currently conflicted/stale in the controller repo; a separate cleanup may be needed after active tasks are safe.

## errors or blockers

- `explore` worked, but `decideNext` evidence state appears polluted by previous verification events and kept recommending failure inspection with low confidence.
- An attempted inline multiline `fs.patch` was rejected correctly; used `--content-file` instead.
- `fs.list` with pattern `*status*` failed because the underlying `fd` call treated it as a regex. This did not block the investigation.

## validation

- `status` reproduced root stale metadata: root `.task/current.json` points to `task/workspace-agents/fix-task-cleanup-tmux-review-comments`; root `.task/verify.json` has conflict markers from old task/main.
- `workspace.call({ tool: "verify", taskSession, input: { noReview: true, noDb: true, noStamp: true } })` reproduced the bug: facade stderr showed the correct task branch/worktree, but verify output returned `branch: "main"`.
- Read `executor.ts`, `branch-resolver.ts`, `task-push.js`, `verify.js`, `verification.js`, `task-meta.js`, `task-session.js`, `audit.js`, `review.js`, `STEERING.md`, and `SCRIPTS.md`.
- Patched `verify.js` to resolve from `process.env.TASK_WORKTREE` when present and to call `findTaskMeta(repoRoot, { currentBranch: branch })`.
- `checkFiles` for `packages/workspace/scripts/verify.js`: passed.
- `node packages/workspace/scripts/verify.js --base origin/stream/workspace-agents --no-review --no-db --no-stamp --json`: passed and returned the correct task branch plus all three touched non-metadata files.
- `review.run` with base `origin/stream/workspace-agents` and `noTests: true`: passed with no findings.
- `audit { scripts: true }`: passed, 48 documented / 48 actual.
- `git diff --check`: passed.
- Wrote a task-worktree verify stamp with `node packages/workspace/scripts/verify.js --base origin/stream/workspace-agents --no-review --no-db --json`; stamp path is inside the task worktree.

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): scope verify to task worktree" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-11 23:33:33 write: `.task/workpad.md`
- 2026-05-11 23:34:20 patch lines 14-14: `.task/workpad.md`
- 2026-05-11 23:34:36 patch lines 62-62: `.task/workpad.md`