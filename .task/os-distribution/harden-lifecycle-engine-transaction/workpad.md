# Harden lifecycle engine transaction

branch: `task/os-distribution/harden-lifecycle-engine-transaction`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1584/harden-lifecycle-engine-transaction
github pr: https://github.com/consuelohq/opensaas/pull/1584
started: 2026-07-23

## acceptance criteria

- [x] Fresh production onboarding leaves `runtime/current` available for atomic symlink activation.
- [x] Install/update/repair hold one owner-safe lifecycle lock across all mutations.
- [x] Signed releases are rejected on channel, platform, architecture, or updater-version mismatch.
- [x] Retained releases are verified with the same manifest identity and exact inventory invariants as downloaded archives.
- [x] Post-activation restart/health failure restores and revalidates the previous release.
- [x] Release staging produces a dependency-complete runtime before activation.
- [x] Declared migrations execute exactly once before activation with containment and durable journaling.
- [x] Preference writes are atomic and invalid CLI positionals fail without invoking the engine.
- [x] Focused lifecycle tests, restart contracts, scoped OS regression review, and publish verification pass.

## plan

1. Read the lifecycle, installer, bundle, service, config, CLI, and behavioral-test paths from the task worktree.
2. Add focused failing tests for each reachable defect before production edits.
3. Implement the narrowest cohesive lifecycle transaction and verification corrections.
4. Run focused tests, then scoped regression/review/verify; inspect the diff and update this workpad.
5. Push the task branch and refresh PR #1584.

## current status

- Implementation complete. Focused tests, scoped regression matrix, strict review, and full publish verification pass. Pushing PR #1584 and collecting independent review evidence.

## Test-first contract

- Behavior under test: production onboarding/activation, owner-safe locking, release suitability and retained-tree verification, rollback after restart/health failure, dependency-complete staging, migration execution, atomic YAML writes, and strict CLI grammar.
- Existing local pattern: extend `packages/os/tests/lifecycle-engine.test.ts` with real filesystem/service fixtures and `lifecycle-restart-contract.test.ts` only where adapter behavior is exercised.
- New or changed tests: one focused behavioral regression per review finding, favoring end-to-end engine calls over source-string assertions.
- Focused red command: `bun --cwd packages/os vitest run tests/lifecycle-engine.test.ts tests/lifecycle-restart-contract.test.ts`.
- Expected red failure: fresh production provisioning cannot activate; mismatched release targets are accepted; manifest inventory tampering is accepted; lock/restart/rollback/migration/dependency/CLI/config contracts are unprotected.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-23 04:15:23 fs.write: `.task/os-distribution/harden-lifecycle-engine-transaction/workpad.md`
- 2026-07-23 04:16:05 fs.write: `.task/os-distribution/harden-lifecycle-engine-transaction/red-phase-instructions.md`
- 2026-07-23 04:21:40 fs.write: `.task/os-distribution/harden-lifecycle-engine-transaction/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 04:33:47 `review.run`: passed — OK
- 2026-07-23 04:34:24 `review.run`: passed — OK
- 2026-07-23 04:35:06 `verify`: failed — COMMAND_FAILED
- 2026-07-23 04:36:39 `review.run`: passed — OK
- 2026-07-23 04:36:51 `verify`: passed — OK

## key decisions

- Treat all nine actionable review findings as one lifecycle-transaction hardening patch because they share activation trust and recovery boundaries.
- Do not mutate a real Consuelo home or restart a real service; all behavior proof uses temporary homes and injected adapters.

## notes for ko

- No real Consuelo installation or service was modified or restarted. The task stops at code/CI evidence.

## improvements noticed

- none yet

## issues and recovery

- Initial `task.start` attempt timed out after creating only a remote branch; a fresh supported task was created as PR #1584.
- Discovery `explore` used a stale repository index and nested `code.call` resolved to main, so those results were discarded. Continuing with task-scoped typed reads and tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/config.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/lock.ts`
- `packages/os/scripts/lib/lifecycle/migrations.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/lifecycle/state.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/senior-engineer.md`

## wait log

- Start: 2026-07-23T04:21:31Z
- Wait reason: the red-phase Codex worker remained active after the wrapper timeout and may still be producing test-only edits.
- Duration: bounded polling every 20 seconds for up to 2 minutes.
- Resume action: check for running `codex exec` processes and inspect the task working-tree diff immediately.
- Expected signal: worker processes exit and lifecycle test files appear in the diff.
- Fallback: terminate only the task-scoped worker processes and split the red phase into smaller bounded passes.

- 2026-07-23 04:21:40 append: `.task/os-distribution/harden-lifecycle-engine-transaction/workpad.md`
