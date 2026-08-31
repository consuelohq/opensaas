# fix current stream docs section mapping and OS workpad path

branch: `task/workspace-agents/fix-current-stream-docs-section-mapping-and-os-workpad-path`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1862/fix-current-stream-docs-section-mapping-and-os-workpad-path
github pr: https://github.com/consuelohq/opensaas/pull/1862
started: 2026-08-12

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

- 2026-08-12 00:50:52 fs.write: `.task/workspace-agents/fix-current-stream-docs-section-mapping-and-os-workpad-path/workpad.md`
- 2026-08-12 00:53:06 fs.write: `.task/workspace-agents/fix-current-stream-docs-section-mapping-and-os-workpad-path/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 00:53:30 `review.run`: passed — OK
- 2026-08-12 00:53:41 `verify`: passed — OK

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

- Behavior under test: (1) every preserved/reachable build detail route, including `/build/approvals/` and `/build/shared-memory-and-context/`, remains assigned to an intentional promoted docs section so breadcrumbs/sidebar context do not fall back globally; (2) canonical OS task.start creates the same scoped workpad path that task.pr/readiness helpers resolve and instructs users to maintain that path.
- Existing local pattern: docs navigation registry drives `sectionForTargetSlug`; workspace task lifecycle already uses scoped workpads, while canonical OS task.start still writes `.task/workpad.md` and canonical task-workpad resolves `.task/<area>/<slug>/workpad.md`.
- New or changed tests: add preserved-build-route section mapping assertions; add canonical OS task-start/workpad path parity assertion against `getTaskWorkpadPath`/resolver semantics.
- Focused red command: documentation navigation tests plus OS task workpad/start contract tests.
- Expected red failure: retained build routes are unassigned; OS task.start source points at `.task/workpad.md` while the readiness helper resolves the scoped path.
- No-test waiver: none.

- 2026-08-12 00:50:52 append: `.task/workspace-agents/fix-current-stream-docs-section-mapping-and-os-workpad-path/workpad.md`

- 2026-08-12 00:51:47 apply-patch: `packages/documentation/tests/navigation-memory.test.ts`
- 2026-08-12 00:51:47 apply-patch: `packages/os/tests/task-hook-dispatcher.test.ts`
- 2026-08-12 00:52:24 apply-patch: `packages/documentation/src/lib/docs-navigation.ts`
- 2026-08-12 00:52:24 apply-patch: `packages/os/scripts/task-start.js`
- 2026-08-12 00:52:52 apply-patch: `packages/documentation/tests/navigation-memory.test.ts`
## Current-head Codex evidence

- Docs P2 comment 3762811004 reproduced: preserved `/build/shared-memory-and-context/` had no promoted section breadcrumb. Fixed by assigning shared memory to Memory and retained build approvals to Secure; focused navigation test now proves both breadcrumb section labels.
- OS P2 comment 3762810998 reproduced: canonical task.start wrote `.task/workpad.md` while task.pr readiness resolves the scoped task workpad path. Fixed task.start to use `getTaskWorkpadPathFromMeta(worktreePath, taskMeta)` and create its parent directory.
- Red: docs navigation 1 intended failure; OS task-hook contract 1 intended failure.
- Green: docs navigation 9/9; OS task-hook dispatcher 5/5.

- 2026-08-12 00:53:06 append: `.task/workspace-agents/fix-current-stream-docs-section-mapping-and-os-workpad-path/workpad.md`
