# make task push sync repository aware

branch: `task/workspace-agents/make-task-push-sync-repository-aware`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1851/make-task-push-sync-repository-aware
github pr: https://github.com/consuelohq/opensaas/pull/1851
started: 2026-08-11

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

- 2026-08-11 23:49:48 fs.write: `.task/workspace-agents/make-task-push-sync-repository-aware/workpad.md`
- 2026-08-11 23:52:39 fs.write: `.task/workspace-agents/make-task-push-sync-repository-aware/workpad.md`

## workspace-owned: validation evidence

- 2026-08-11 23:53:43 `review.run`: passed — OK
- 2026-08-11 23:53:56 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

- Behavior under test: task.push must preflight and post-sync against the repository selected by `--repo`, not assume local `origin`, while keeping GitHub credentials out of command argv/output.
- Existing local pattern: `assertApiPushBaseIsSynced` and `synchronizeApiPushedTaskBranch` in mirrored OS/workspace git helpers; task-push already resolves `args.repo` and a GitHub token before mutation.
- New or changed tests: model local origin and selected repository as two distinct bare remotes sharing the initial head; assert preflight accepts the selected repo, publish synchronization fetches the selected repo's new commit, advances local refs, and does not depend on origin advancing. Add a source contract that task-push passes selected repo/auth into both synchronization phases.
- Focused red command: OS/workspace task-push-local-sync suites.
- Expected red failure: helpers hard-code `origin`, so alternate-repository post-sync cannot materialize or validate the selected repository head.
- No-test waiver: none.

- 2026-08-11 23:49:48 append: `.task/workspace-agents/make-task-push-sync-repository-aware/workpad.md`

- 2026-08-11 23:50:47 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:50:47 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:50:53 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:50:54 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:51:48 apply-patch: `packages/os/scripts/lib/git.js`
- 2026-08-11 23:51:48 apply-patch: `packages/workspace/scripts/lib/git.js`
- 2026-08-11 23:51:48 apply-patch: `packages/os/scripts/task-push.js`
- 2026-08-11 23:51:48 apply-patch: `packages/workspace/scripts/task-push.js`
- 2026-08-11 23:52:23 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:52:23 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
## Codex repository-aware sync evidence

- Exact P2: `task.push --repo <other-repo>` mutated the selected GitHub repository but pre/post synchronization still fetched local `origin`, so a successful alternate-repository publish could not be reconciled locally.
- Red: OS and workspace local-sync suites each had exactly 2 failures / 7 passes: selected-repository synchronization and the task-push wiring contract.
- Fix: task-push resolves a Git sync target from `args.repo`. If local origin is that GitHub repository, it keeps normal `origin` tracking. Otherwise it fetches the selected repository over HTTPS into `refs/consuelo/task-push/<branch>` with GitHub auth supplied through Git config environment, not the URL or argv. Preflight and post-push synchronization both use that same target.
- Security contract: alternate repository fetch URL is credential-free; token-derived auth is confined to child Git environment and terminal prompting is disabled.
- Green: OS task-push-local-sync 10/10; workspace task-push-local-sync 10/10. The two-remote regression proves selected repo can advance while origin remains unchanged.

- 2026-08-11 23:52:39 append: `.task/workspace-agents/make-task-push-sync-repository-aware/workpad.md`
