# fix subagent review flow and canary release readiness

branch: `task/workspace-agent/fix-subagent-review-flow-and-canary-release-readiness`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2059/fix-subagent-review-flow-and-canary-release-readiness
github pr: https://github.com/consuelohq/opensaas/pull/2059
started: 2026-08-16

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

- 2026-08-16 04:47:07 fs.write: `.task/workspace-agent/fix-subagent-review-flow-and-canary-release-readiness/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 04:58:29 `review.run`: passed — OK
- 2026-08-16 04:59:18 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agent): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract — Grok second-cycle hotfix

behavior under test:
- stale `evicting` task-session records recover safely after the eviction lease expires, while fresh eviction remains fail-closed
- recovery state writes are compare/transition guarded so a stale recovery cannot overwrite a concurrent task-session transition
- OS `session.start` input validation matches the workspace discriminated task/work schema
- subagent `waitMs` is bounded by the facade/tool timeout so a wait cannot outlive the request envelope

existing local pattern:
- durable task registry transition helpers and mirrored OS/workspace eviction/recovery modules
- workspace `SessionStartInput` schema is the canonical session-start contract
- facade executor owns tool timeout normalization before subagent runtime invocation

new or changed tests:
- durable task worktree/recovery regression for stale vs fresh `evicting`
- registry transition race regression for recovery CAS semantics
- OS session-start schema parity regression
- subagent/facade regression for `waitMs > timeout`

focused red command:
- run only the affected durable-task, session-schema, and subagent/facade tests before implementation

expected red failure:
- current recovery cannot reclaim stale `evicting` safely / can overwrite changed state
- OS schema accepts or rejects a shape differently from workspace schema
- requested subagent wait remains longer than the effective facade timeout

no-test waiver: not applicable

- 2026-08-16 04:47:07 append: `.task/workspace-agent/fix-subagent-review-flow-and-canary-release-readiness/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/lib/task-session.js`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/task-registry.js`
- `packages/workspace/scripts/lib/task-session.js`
- `packages/workspace/scripts/lib/task-worktree-eviction.js`
- `packages/workspace/tests/durable-task-worktrees.test.ts`
- `packages/workspace/tests/task-worktree-eviction.test.ts`

## Grok second-cycle disposition

- fixed stale `evicting` recovery with a 15-minute lease: fresh eviction remains fail-closed; stale state reconciles from actual worktree existence
- added `updatedAt` compare-and-swap protection to registry transitions and recovery finalization so stale recovery writers cannot overwrite concurrent state
- aligned OS `SessionStartInput` with the strict workspace task/work discriminated union
- bounded subagent attachment `waitMs` by the effective tool/subagent timeout
- focused RED set reproduced all four findings (5 failing assertions); GREEN set passes 42/42
- regenerated OS manifest/types/docs after schema parity change
- tightened focused selector ownership so no unrelated whole-OS package fallback is selected
- final task-base selector: 22/22 focused suites passed, 0 failures
- per Ko's instruction this closes the second review cycle; no third reviewer wait is required once deterministic gates remain green
