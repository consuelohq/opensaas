# install visible root agent instructions

branch: `task/os-distribution/install-visible-root-agent-instructions`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1785/install-visible-root-agent-instructions
github pr: https://github.com/consuelohq/opensaas/pull/1785
started: 2026-08-05

## acceptance criteria

- [x] Fresh installs create visible `~/Consuelo/AGENTS.md` and `~/Consuelo/CLAUDE.md`.
- [x] Both files are generated from one canonical runtime-bundled source and are byte-identical.
- [x] Re-running install reconciliation repairs missing or stale copies without changing unrelated visible content.
- [x] Dry-run reports both writes without touching disk.
- [x] Runtime bundle, installer integration, focused tests, strict review, and full verify pass.

## plan

1. Follow the current stream's visible dialer steering pattern with a dedicated root-agent reconciler.
2. Add a focused red contract for identical root files, stale repair, owner-only modes, and dry-run.
3. Wire the reconciler into managed component provisioning used by local installation/update.
4. Add the canonical source to the signed runtime bundle closure and fixture contracts.
5. Prove full install integration, then run typecheck, strict review, verify, push, and merge task to stream.

## Test-first contract

- Behavior under test: visible `AGENTS.md` and `CLAUDE.md` are always created or repaired from the same bundled bytes.
- Existing pattern: `reconcileVisibleDialerSteering` atomically updates system-owned visible instructions and `provisionManagedComponentIndexes` runs it during installation reconciliation.
- New test: `packages/os/tests/visible-root-agent-instructions.test.ts`.
- Focused red command: `bun test tests/visible-root-agent-instructions.test.ts` from `packages/os`.
- Expected red: the module and root instruction contract do not exist on the stream branch.

## current status

- Stream-native implementation is complete.
- The installer now creates or repairs `~/Consuelo/AGENTS.md` and `~/Consuelo/CLAUDE.md` from one signed runtime-bundle source.
- Focused integration tests, package typecheck, strict review, and full verify all pass.
- No local projects were moved during the path audit.

## files changed

- `packages/os/steering/root-agent-instructions.md`
- `packages/os/scripts/lib/visible-root-agent-instructions.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/visible-root-agent-instructions.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/SCRIPTS.md`
- `packages/workspace/test-selection.registry.json`

## workspace-owned: files changed

- `packages/os/scripts/lib/visible-root-agent-instructions.ts`
- `packages/os/tests/visible-root-agent-instructions.test.ts`

## workspace-owned: activity log

- 2026-08-05 03:09:17 fs.write: `.task/os-distribution/install-visible-root-agent-instructions/workpad.md`
- 2026-08-05 03:11:03 fs.write: `packages/os/tests/visible-root-agent-instructions.test.ts`
- 2026-08-05 03:11:31 fs.write: `.task/os-distribution/install-visible-root-agent-instructions/workpad.md`
- 2026-08-05 03:11:51 fs.write: `packages/os/scripts/lib/visible-root-agent-instructions.ts`

## workspace-owned: validation evidence

- RED: focused test failed because the root instruction reconciler module did not exist.
- GREEN: focused root instruction suite passed, 4 tests and 11 assertions.
- Selected installer, managed-component, runtime-bundle, lifecycle, and distribution suites passed: 121 tests, 651 assertions, 0 failures.
- `bun run typecheck` in `packages/os` passed.
- Generated test selection registry includes the new root instruction suite.
- Strict review passed with 0 task issues and 0 blocking issues.
- Full verify passed and wrote a publish-valid verification stamp.
- 2026-08-05 03:16:01 `review.run`: passed — OK
- 2026-08-05 03:16:02 `review.run`: passed — OK
- 2026-08-05 03:16:31 `verify`: passed — OK

## key decisions

- Start from `stream/os-distribution`, not `main`, to keep the task patch surgical and avoid importing unrelated promoted-main history.
- Treat both root files as system-owned update-clean aliases; one canonical file is the only source of content.

## notes for ko

- Do not drag the entire `~/Dev` tree into `~/Consuelo/Projects` while Consuelo tasks or services are active.
- The installed workspace routes the default project to `/Users/kokayi/Dev/opensaas`, and the source daemon currently runs from that path.
- Active Git worktrees live under `/Users/kokayi/Dev/opensaas-worktrees`; task dependencies also symlink through the primary repo's `packages/os/node_modules`.
- `consuelo-sdk/.git` is linked-worktree metadata, so moving it independently can invalidate its Git paths.
- Standalone repositories can usually be moved while idle, but editors, aliases, scripts, and development servers may retain the old absolute path.
- Safe OS-repo migration: finish active tasks, stop the source daemon and dev servers, update workspace routing, move the primary repo and worktree root together or recreate worktrees, restart, then verify.

## improvements noticed

- none yet

## issues and recovery

- The first task was created from `main` and could not merge cleanly into the divergent stream. Its implementation was preserved on PR #1784, then this replacement task was correctly started with `--start-from stream`.
- The task-scoped batch still did not propagate `taskSession` into inner filesystem calls; recovered with direct task-scoped calls.
- The generated test registry on the stream was stale relative to several existing stream tests; regeneration added those existing entries plus the new root instruction suite rather than hand-editing the generated file.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Restarted this task from `stream/os-distribution` after the first main-based task exposed non-metadata stream conflicts.
- Reusing the already-audited local `~/Consuelo/AGENTS.md` bytes as the canonical requested content.
- Inspecting current stream install/update ownership, release-bundle closure, and visible steering patterns before editing.

- 2026-08-05 03:09:17 append: `.task/os-distribution/install-visible-root-agent-instructions/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/visible-dialer-steering.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/test-selection.registry.json`

## Test-first evidence

- RED: `bun test tests/visible-root-agent-instructions.test.ts` failed because `visible-root-agent-instructions` does not exist on the stream branch.

- 2026-08-05 03:11:31 append: `.task/os-distribution/install-visible-root-agent-instructions/workpad.md`

- 2026-08-05 03:11:51 write: `packages/os/scripts/lib/visible-root-agent-instructions.ts`
