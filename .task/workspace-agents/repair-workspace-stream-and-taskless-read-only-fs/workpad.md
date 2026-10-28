# repair workspace stream and taskless read-only fs

branch: `task/workspace-agents/repair-workspace-stream-and-taskless-read-only-fs`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1807/repair-workspace-stream-and-taskless-read-only-fs
github pr: https://github.com/consuelohq/opensaas/pull/1807
started: 2026-08-10

## acceptance criteria

- [x] Merge current `main` into the task without rewriting `stream/workspace-agents` history, resolving stale stream conflicts toward current main architecture.
- [x] Preserve the post-#1335 philosopher/CEO `persona.md` expansion already reviewed in PR #1538.
- [x] Preserve and adapt the post-#1335 taskless read-only filesystem fix from PR #1540 to current main architecture.
- [x] Every current `fs.*` tool whose manifest capability is `readOnly: true` is task-session optional when no explicit repository target is supplied. Current inventory is `fs.read`, `fs.search`, and `fs.list`; no additional read-only `fs.*` names exist on current main.
- [x] Unscoped read-only FS calls use the caller/base repository when task selection is missing or ambiguous; explicit task session/branch/PR routing remains strict and fail-closed.
- [x] `fs.write`, `fs.apply_patch`, and `fs.trash` remain task-session required and branch-required.
- [x] Full-file `fs.read` behavior from the July fix remains available after the sync.
- [x] Generated manifests/types/docs are regenerated from current source rather than accepting stale July generated conflict sides.
- [x] Focused Workspace + OS filesystem/facade/manifest tests, review, and publish verification pass or any unrelated repository gate failure is documented with exact evidence.
- [ ] Promote the repaired task into `stream/workspace-agents` so PR #1539 can become mergeable toward `main`.

## plan

1. Record discovery and test-first contract; inspect current-main filesystem registry and the July fix.
2. Add/retain contract tests that derive read-only FS session requirements from manifest capability and cover ambiguous task routing plus explicit-target fail-closed behavior.
3. Sync current `main` into this task branch without rewriting stream history; resolve stale conflicts toward main architecture while preserving persona and FS deltas.
4. Regenerate derived surfaces, run focused tests, then broader review/verify.
5. Push task PR #1807 and promote it into the stream, then verify PR #1539 state.

## discovery

- `stream/workspace-agents` already contains the complete July fix from PR #1540 and the persona expansion from PR #1538.
- PR #1335 was squash-merged to main; much of #1539's visible commit history is duplicate ancestry rather than missing behavior.
- Current main has exactly six `fs.*` tools: read-only `fs.read`, `fs.search`, `fs.list`; mutating `fs.write`, `fs.apply_patch`, `fs.trash`.
- Current main modularized OS filesystem registration under `packages/os/tools/filesystem/*` and regressed `fs.list` to `sessionRequired: true`.
- Current main Workspace/OS facade optional routing falls back only on `WORKTREE_NOT_FOUND`; the July fix also falls back on unscoped `AMBIGUOUS_TASK_SELECTION` while preserving explicit target failures.
- 27 open task PRs target `stream/workspace-agents`, so force-reset/rebase is intentionally avoided.

## Test-first contract

### Behavior under test

- All filesystem tools classified `readOnly: true` are sessionless; all mutating filesystem tools stay task-scoped.
- With multiple active task candidates and no explicit repository target, optional read-only FS routing falls back to the caller/base repo.
- With an explicit branch/PR target, ambiguous routing is surfaced rather than hidden.
- Full-file `fs.read` preserves exact content behavior.

### Existing local pattern

- Reuse the focused Workspace and OS facade contracts from PR #1540, plus manifest/tool-package tests in current main.
- Prefer capability-derived assertions over a hard-coded allowlist so future read-only `fs.*` additions inherit the contract.

### New or changed tests

- Workspace manifest contract: every `fs.*` entry with `capabilities.readOnly === true` has `sessionRequired === false`; every mutating FS entry remains task-scoped.
- OS filesystem schema/manifest contract with the same capability-derived invariant.
- Workspace and OS facade tests for ambiguous task selection fallback and explicit-target fail-closed behavior.
- Existing FS read tests for `full` mode retained/adapted.

### Focused red command

After syncing main but before applying the routing/session fixes, run the focused Workspace + OS manifest/facade FS tests.

### Expected red failure

- Current main should fail because `fs.list` is `readOnly: true` but `sessionRequired: true`.
- Current main should fail taskless ambiguous routing because optional branch resolution only suppresses `WORKTREE_NOT_FOUND`, not `AMBIGUOUS_TASK_SELECTION`.

## current status

- Task started from `stream/workspace-agents`; PR #1807 created.
- Current `origin/main` has been merged into the isolated task branch. All conflicts are resolved toward current-main architecture except the deliberately preserved persona delta; no legacy worker/dev-manifest conflict paths remain in the final tree.
- The complete read-only FS fix is ported across current OS + Workspace architecture: `fs.read`, `fs.search`, and `fs.list` are sessionless and optional-branch; mutators remain session/branch required; unscoped ambiguity falls back to the caller repo; explicit targets remain fail-closed.
- Exact full-file `fs.read` is preserved through CLI implementation, facade schemas, handler command metadata, generated manifests/types/docs, and tests.
- Focused FS policy, facade, exact-read, server transport, OS manifest, syntax, generation, and diff checks are green.
- Remaining work: commit the resolved main sync, run review/publish verification, push PR #1807, promote it into the stream, and re-check PR #1539.

## files changed

- Relative to current `origin/main`, the non-task delta is intentionally limited to `persona.md` plus 26 OS/Workspace filesystem implementation, schema, generated, and regression-test files (27 total). No website/runtime/worker legacy delta remains.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-10 01:30:23 fs.write: `.task/workspace-agents/repair-workspace-stream-and-taskless-read-only-fs/workpad.md`

## workspace-owned: validation evidence

- Discovery batch: `trc_986e07501218`.
- Current-main filesystem inventory: `trc_f44dc21975f8`.
- RED current-main policy check: `trc_a00975f8e2ed` (`fs.list` session-required; ambiguity fallback missing).
- Main merge/conflict capture: `trc_2afc3bd68ddd`; conflict resolution toward main: `trc_f775a40a8d02`.
- Post-resolution current-main delta audit: `trc_a609362b6ecd`.
- Patched source-policy sanity check: `trc_58af645863bb`.
- Regenerated manifests/types/docs: `trc_afeff1e174b2`.
- Focused FS green suite (source invariant, manifests, facade routing, explicit-target fail-closed, full reads): `trc_cf79be0bff86`.
- OS syntax + generated-manifest check + diff check: `trc_bfc6c72f5730`.
- Full OS tool-manifest suite: `trc_3575a836e0f8` (15/15 passed).
- Server transport policy tests: `trc_482b7d0d804e` (2/2 passed).
- Final non-task diff audit against current main: `trc_aa9bc01ca841` (27 files; only OS, Workspace, and `persona.md`; no legacy paths).
- Strict repository review against current main: `trc_46b206301115` (0 blocking issues; static rules, eslint, typecheck, spec compliance passed).
- Full task safety gate against current main: `trc_9759ff6f5036` (`passed: true`, `publishValid: true`, no DB risks).
- Main-sync merge commit: `7f2b95342a`.
- 2026-08-10 01:40:18 `review.run`: passed — OK
- 2026-08-10 01:40:18 `review.run`: passed — OK
- 2026-08-10 01:40:31 `verify`: passed — OK

## key decisions

- Treat current main architecture as authoritative during conflict resolution; carry forward only semantic deltas not already present on main.
- Do not force-push, reset, or rebase the shared stream because many open child PRs target it.
- Read-only FS session policy is capability-derived, not a one-off `fs.list` exception.

## notes for ko

- Current main has exactly three read-only filesystem tools: `fs.read`, `fs.search`, and `fs.list`. This task will fix all three as a class and add a guard so a future read-only FS tool cannot silently become task-session required.

## improvements noticed

- Add a durable manifest invariant tying `capabilities.readOnly` for `fs.*` to task-session policy so generated/source drift is caught in CI.

## issues and recovery

- `fs.read` could not load the senior-engineer workflow before a task existed because of the exact ambiguity bug under repair. After `task.start`, the full skill file was read successfully with the task session.
- `task.call` was advertised by `tools.search` but rejected by the live generated OS manifest with `UNKNOWN_TOOL_SCOPE`; task-scoped `code.call` was used as the execution fallback while preserving the task worktree boundary.
- Broad current-main package-layout/core-equivalence tests expose unrelated repository debt: the OS layout suite still hardcodes 148 tools while current generation produces 154 and contains a stale deployment package path assumption; Workspace's core-equivalence test also references the legacy OS core-manifest location and disagrees over the newer `context` core surface. FS-specific assertions and the full OS tool-manifest suite are green, so these unrelated failures were not widened into this patch.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): repair stream and taskless read-only fs" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.task/workspace-agents/repair-workspace-stream-and-taskless-read-only-fs/workpad.md`
- `package.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/filesystem/handler.test.ts`
- `packages/os/tools/filesystem/handler.ts`
- `packages/os/tools/filesystem/manifest.ts`
- `packages/os/tools/filesystem/schema.ts`
- `packages/os/tools/package.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

- 2026-08-10 01:39:25 apply-patch: `.task/workspace-agents/repair-workspace-stream-and-taskless-read-only-fs/workpad.md`

- 2026-08-10 01:40:44 apply-patch: `.task/workspace-agents/repair-workspace-stream-and-taskless-read-only-fs/workpad.md`