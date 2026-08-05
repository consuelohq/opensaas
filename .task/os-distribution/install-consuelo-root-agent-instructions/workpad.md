# install Consuelo root agent instructions

branch: `task/os-distribution/install-consuelo-root-agent-instructions`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1784/install-consuelo-root-agent-instructions
github pr: https://github.com/consuelohq/opensaas/pull/1784
started: 2026-08-05

## acceptance criteria

- [x] Fresh installs create visible `~/Consuelo/AGENTS.md` and `~/Consuelo/CLAUDE.md`.
- [x] Both files are generated from one canonical template and remain byte-identical.
- [x] Install/update reconciliation repairs stale or missing copies without touching user-owned `Steering/system.md`.
- [x] Release-driven reconciliation delivers the same files to existing users.
- [x] Focused tests, package validation, strict review, and full verify pass.

## plan

1. Extend the existing managed visible-user-content reconciler, which already runs on install and release update.
2. Add a focused red contract for identical root agent files, update repair, and file permissions.
3. Implement one canonical root-agent template and refresh both destinations from the same bytes.
4. Add full-install coverage, update the installer docs, then run focused tests, review, verify, and publish.

## Test-first contract

- Behavior under test: install and update create/repair root `AGENTS.md` and `CLAUDE.md` with identical canonical Consuelo OS bootstrap instructions.
- Existing local pattern: `reconcileManagedUserContent` classifies runtime-owned catalogs/examples as `update-clean` and reconciles them on both install and release activation.
- New or changed tests: `packages/os/tests/managed-user-content.test.ts` and the full install contract in `packages/os/tests/install-state.test.ts`.
- Focused red command: `bun test packages/os/tests/managed-user-content.test.ts` from `packages/os`.
- Expected red: the fresh-install contract fails because neither root file exists and the exported root instruction contract is absent.

## current status

- Implementation complete and verified.
- Fresh installs and release activation now create or repair `~/Consuelo/AGENTS.md` and `~/Consuelo/CLAUDE.md` from the same bundled canonical bytes.
- The existing user-owned `~/Consuelo/Steering/system.md` remains preserve-custom.
- No local projects were moved; the path migration audit is recorded below for Ko.

## files changed

- `packages/os/steering/root-agent-instructions.md`
- `packages/os/scripts/lib/managed-user-content.ts`
- `packages/os/scripts/lib/managed-user-content-release.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/managed-user-content.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/SCRIPTS.md`

## workspace-owned: files changed

- `packages/os/steering/root-agent-instructions.md`

## workspace-owned: activity log

- 2026-08-05 02:44:30 fs.write: `.task/os-distribution/install-consuelo-root-agent-instructions/workpad.md`
- 2026-08-05 02:50:31 fs.write: `.task/os-distribution/install-consuelo-root-agent-instructions/workpad.md`
- 2026-08-05 02:51:39 fs.write: `packages/os/steering/root-agent-instructions.md`

## workspace-owned: validation evidence

- Focused managed-user-content suite: 28 passed, 0 failed.
- Full install-state suite from `packages/os`: 25 passed, 0 failed.
- Lifecycle and runtime-bundle contract selection: 111 passed, 0 failed.
- `bun run typecheck` in `packages/os`: passed.
- Strict `review.run`: 0 issues from this task, 0 blocking issues.
- Full `verify`: passed; publish-valid stamp written.
- 2026-08-05 03:00:19 `review.run`: passed — OK
- 2026-08-05 03:00:19 `review.run`: passed — OK
- 2026-08-05 03:00:19 `review.run`: passed — OK
- 2026-08-05 03:00:19 `review.run`: passed — OK
- 2026-08-05 03:00:19 `review.run`: passed — OK
- 2026-08-05 03:00:19 `review.run`: passed — OK
- 2026-08-05 03:00:20 `review.run`: passed — OK
- 2026-08-05 03:01:16 `review.run`: passed — OK
- 2026-08-05 03:01:42 `verify`: passed — OK

## key decisions

- Treat root agent instructions as `update-clean`: they describe the installed OS/tool contract and must not drift, while `Steering/system.md` remains `preserve-custom`.
- Use one template invocation for both files so equality is structural rather than maintained by duplicate literals.

## notes for ko

- Do not drag the entire `~/Dev` tree into `~/Consuelo/Projects` while the OS and task worktrees are active.
- `~/.consuelo/workspaces/workspace_internal/shared/workspace.yaml` currently routes the default project and this node to `/Users/kokayi/Dev/opensaas`.
- The source-managed daemon and current task/worktree dependencies also resolve through `/Users/kokayi/Dev/opensaas`.
- `opensaas-worktrees` contains active linked worktrees, and `consuelo-sdk/.git` is a linked-worktree metadata file; moving those independently can invalidate Git paths.
- Standalone repositories can generally be moved while idle, but editors, aliases, scripts, and running development servers may retain their old absolute paths.
- Safe migration order for the OS repos: finish active tasks, stop the source daemon, update workspace routing, move the primary repo and worktree root together or recreate worktrees, restart, then verify.

## improvements noticed

- none yet

## issues and recovery

- A task-scoped batch did not propagate `taskSession` to an inner `fs.write`; recovered with direct task-scoped calls and kept all repo work inside the task worktree.
- The first focused assertion used wording that did not exactly match the copied local instructions; corrected the expectation without changing the canonical source.
- A combined test invocation ran `install-state.test.ts` from the repo root, but that suite intentionally resolves eval imports relative to `packages/os`; reran it from the package cwd.
- The full-install test exposed two stale assertions about the already-installed dialer steering file; aligned them with the real created/preserved lifecycle.
- The install action envelope records ownership in its message rather than an `ownership` field; corrected the integration assertion to test the public mapped action shape.
- The OS facade returned transient 502 responses during review. After the service recovered, strict review and full verify both passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Inspecting the installed `~/Consuelo/AGENTS.md` and `CLAUDE.md` as the exact desired source content.
- Tracing visible managed-user-content reconciliation and release/runtime bundle ownership.
- Auditing whether moving projects from `~/Dev` would break Consuelo workspace routing or Git worktrees.

- 2026-08-05 02:44:30 append: `.task/os-distribution/install-consuelo-root-agent-instructions/workpad.md`

## workspace-owned: files read

- `packages/os/AGENTS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/managed-user-content-release.ts`
- `packages/os/scripts/lib/managed-user-content.ts`
- `packages/os/scripts/lib/visible-dialer-steering.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/managed-components.test.ts`
- `packages/os/tests/managed-user-content.test.ts`
- `packages/os/tests/visible-dialer-steering.test.ts`
- `packages/workspace/senior-engineer.md`

## Test-first evidence

- RED: `bun test packages/os/tests/managed-user-content.test.ts` failed as expected because `rootAgentInstructionsTemplate` and the root-file contract do not exist yet.

- 2026-08-05 02:50:31 append: `.task/os-distribution/install-consuelo-root-agent-instructions/workpad.md`

- 2026-08-05 02:51:39 write: `packages/os/steering/root-agent-instructions.md`
