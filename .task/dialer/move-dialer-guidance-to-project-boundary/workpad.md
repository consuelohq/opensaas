# move dialer guidance to project boundary

branch: `task/dialer/move-dialer-guidance-to-project-boundary`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2441/move-dialer-guidance-to-project-boundary
github pr: https://github.com/consuelohq/opensaas/pull/2441
started: 2026-09-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/streams/dialer` (deleted)

## workspace-owned: files changed

- `packages/os/streams/dialer` (deleted)

## workspace-owned: activity log

- 2026-09-10 02:32:09 fs.write: `.task/dialer/move-dialer-guidance-to-project-boundary/workpad.md`
- 2026-09-10 02:34:39 fs.trash: `packages/os/streams/dialer`
- 2026-09-10 02:37:29 fs.write: `.task/dialer/move-dialer-guidance-to-project-boundary/workpad.md`
- 2026-09-10 02:38:53 fs.write: `.task/dialer/move-dialer-guidance-to-project-boundary/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 02:37:53 `review.run`: passed — OK
- 2026-09-10 02:38:48 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- [ ] `areas/dialer/AGENTS.md` is the durable repository-local Dialer development/product guidance boundary.
- [ ] Preserve the useful unique product/architecture guidance currently in `packages/os/streams/dialer/AGENTS.md` by consolidating it into the area runbook without creating a second canonical copy.
- [ ] Remove Dialer-specific `AGENTS.md` from `packages/os/streams` and keep `packages/workspace/streams/dialer/AGENTS.md` absent.
- [ ] Dialer guidance is not shipped as an OS runtime input and is never synchronized into global `~/Consuelo/Steering`.
- [ ] Dialer stream/task context resolves repository-local project guidance rather than an OS-distribution copy.
- [ ] Do not break other stream instruction areas; prefer a narrow project-aware resolution rule over a blind global migration if other areas still depend on OS stream files.
- [ ] Focused contracts prove context resolution, runtime-bundle exclusion, and global-steering exclusion before publish.

## Plan

1. Read the current Dialer area runbook, OS stream guidance, stream-context resolver, distribution inputs, and focused tests from this stream-based task worktree.
2. Add focused RED assertions for `areas/dialer/AGENTS.md` resolution and absence of a shipped OS Dialer stream file.
3. Consolidate unique guidance into the area runbook, migrate the resolver on the narrowest safe boundary, and remove the OS stream copy/runtime requirement.
4. Run focused GREEN and inspect cross-area behavior so other stream contexts are not orphaned.
5. Update test selection only if needed to keep validation focused; run strict review and full verify.
6. Publish into `stream/dialer`, refresh its review surface, and close the task worktree.

## Test-first contract

behavior under test: Dialer guidance is project/repository context, not global user steering and not OS runtime content. `stream.context` for Dialer resolves `areas/dialer/AGENTS.md`; customer runtime bundles do not carry `streams/dialer/AGENTS.md`.
existing local pattern: the repository already has `areas/dialer/AGENTS.md` as the Dialer development/validation/release runbook, while a complementary product-model document is duplicated into OS stream runtime context. The prior cleanup moved resolution toward `packages/os/streams`, which is the ownership error this task corrects.
new or changed tests: change the stream instruction contract to expect the area runbook for Dialer; replace the OS Dialer-stream presence/identity contract with absence/runtime-exclusion coverage; keep install/update assertions that visible global Steering never receives Dialer guidance.
focused red command: run the preflighted stream-instruction and runtime-bundle contracts after changing expectations but before resolver/storage changes.
expected red failure: current Dialer resolver still points at an OS/workspace stream path and runtime distribution still requires/ships `streams/dialer/AGENTS.md`.
no-test waiver: not applicable; this changes context resolution and distribution ownership with deterministic focused coverage.

- 2026-09-10 02:32:09 append: `.task/dialer/move-dialer-guidance-to-project-boundary/workpad.md`

## workspace-owned: files read

- `areas/dialer/AGENTS.md`
- `packages/os/scripts/lib/streams/instructions.ts`
- `packages/os/streams/dialer/AGENTS.md`
- `packages/os/tests/dialer-stream-instructions.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/scripts/lib/stream-instructions.js`
- `packages/workspace/scripts/lib/stream-instructions.test.ts`
- `packages/workspace/scripts/stream-context.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/dialer-validation-runbook.test.ts`
- `packages/workspace/tests/test-selection.test.js`

- 2026-09-10 02:37:05 apply-patch: `packages/workspace/tests/test-selection.test.js`
## implementation status

- `areas/dialer/AGENTS.md` is now the Dialer repository-local guidance boundary. The prior OS stream guidance body is preserved there exactly apart from heading demotion needed to nest it under `## Product, embedded GoHighLevel, and RD contract`.
- All seven RD coordination files moved from `packages/os/streams/dialer/rd/` to `areas/dialer/rd/`. Byte comparison against `origin/stream/dialer` confirms every file is preserved except three intentional ownership/path wording substitutions.
- `packages/os/streams/dialer/` is removed entirely. The deprecated Workspace Dialer stream copy remains absent.
- Workspace stream instruction resolution now prefers `areas/<area>/AGENTS.md` when present, with the previous `packages/os/streams/<area>/AGENTS.md` path retained as fallback. The `media` contract proves fallback behavior remains intact.
- Direct `stream-context.js` execution in this task resolves Dialer instructions to `areas/dialer/AGENTS.md` and includes both the product model and RD coordination markers.
- Runtime distribution no longer requires `streams/dialer/AGENTS.md`; any `streams/dialer/**` path is classified source-only while product-owned `streams/tools/AGENTS.md` remains runtime.
- Release/lifecycle fixtures no longer model Dialer project guidance as customer runtime content.
- Test selection now maps the moved Dialer area/RD paths and the affected release/lifecycle fixture tests to focused critical suites; the broad `@consuelo/os package test` is no longer selected.

## validation evidence

- RED: exactly 3 intended failures before implementation: old stream-context path, existing OS Dialer copy, and runtime classification.
- GREEN core packet: 4 files / 31 tests passed, including the real customer runtime-bundle closure.
- Release/lifecycle packet: 3 files / 88 tests passed.
- Test-selection registry regenerated: 2670 tests, 2586 mapped, 84 unmapped, 73 rules.
- Full test-selection contract: 57/57 passed.
- Full task selection is pass-level and has no broad OS package fallback.
- Content preservation: prior 12,406-byte stream guidance body is present in the area runbook after deterministic heading demotion; all seven RD files compare exactly after the intentional path/ownership substitutions.
- Source search across `areas/dialer`, production workspace scripts, and OS scripts finds no remaining `packages/os/streams/dialer` reference.

- 2026-09-10 02:37:29 append: `.task/dialer/move-dialer-guidance-to-project-boundary/workpad.md`

## final validation

- Strict review against `origin/stream/dialer`: 0 task issues, 0 blockers, 0 documentation opportunities.
- Full `verify`: passed in full mode and publish-valid; review passed, DB guard passed, selected validation passed.
- Final verification stamp: `.task/dialer/move-dialer-guidance-to-project-boundary/verify.json`.
- The task is ready to merge into `stream/dialer`; this should update the stream review surface rather than merging unrelated stream work to main automatically.

- 2026-09-10 02:38:53 append: `.task/dialer/move-dialer-guidance-to-project-boundary/workpad.md`
