# fix remaining cleanup and workflow bundle review debt

branch: `task/workspace-agent/fix-remaining-cleanup-and-workflow-bundle-review-debt`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2130/fix-remaining-cleanup-and-workflow-bundle-review-debt
github pr: https://github.com/consuelohq/opensaas/pull/2130
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/task-cleanup.js`
- `packages/workspace/manifests/workflow-bundles.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/task-cleanup.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/workflow-intent.test.ts`
- `packages/workspace/tooling/workflows.json`
- `packages/os/tests/task-cleanup-durable-safety.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 05:07:18 fs.write: `.task/workspace-agent/fix-remaining-cleanup-and-workflow-bundle-review-debt/workpad.md`
- 2026-08-16 05:14:22 fs.write: `.task/workspace-agent/fix-remaining-cleanup-and-workflow-bundle-review-debt/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 05:13:58 `review.run`: passed — OK
- 2026-08-16 05:14:27 `review.run`: passed — OK
- 2026-08-16 05:14:53 `verify`: passed — OK

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

## Test-first contract — final review debt

behavior under test:
- OS destructive cleanup, including `--stale-days` combined with `--force`, routes durable active tasks through `evictDurableTaskWorktree` before any worktree/branch removal so unique WIP is archived and durable state cannot point at deleted storage
- the generated `task` workflow bundle treats canonical `session.start` as a task entrypoint in both pre/post subscriptions and its tool set, while retaining `task.start` compatibility

existing local pattern:
- workspace cleanup already pre-evicts durable active worktrees on destructive paths; OS cleanup should mirror that safety contract
- workflow bundle generation derives subscriptions/tool membership from the canonical workflow/manifest sources and must be regenerated rather than hand-editing the artifact

new or changed tests:
- OS task-cleanup force/stale durable eviction regression
- workflow bundle generation/intent regression asserting both `session.start` and `task.start`

focused red command:
- run only task cleanup + workflow intent/manifest tests before production edits

expected red failure:
- OS force/stale cleanup currently removes a durable worktree without invoking eviction/archive
- generated task bundle currently contains only `task.start` subscriptions/tool membership

no-test waiver: not applicable

- 2026-08-16 05:07:18 append: `.task/workspace-agent/fix-remaining-cleanup-and-workflow-bundle-review-debt/workpad.md`

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/build/workflows.mdx`
- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/task-cleanup.js`
- `packages/workspace/hooks/task/workflow.js`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/lib/task-worktree-eviction.js`
- `packages/workspace/scripts/task-cleanup.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/workflow-intent.test.ts`
- `packages/workspace/tooling/workflows.json`

## Final review-debt disposition

- OS and workspace stale-only cleanup keep safe eviction semantics even when `--force` is present
- destructive durable cleanup evicts/archive-protects before removal and only clears durable recovery state after worktree/branch cleanup succeeds
- canonical workflow config now subscribes to both `session.start` and compatibility `task.start`
- workflow bundle generation includes tools referenced by subscriptions, so umbrella `session.start` can be present without a static task-only workflowRole
- generated workflow bundle/types/docs refreshed
- RED: cleanup + workflow intent tests failed exactly on both unresolved CodeRabbit findings
- GREEN: focused pair 10/10; final task-base selector 9/9 suites passed, 0 failures
- selected-test destructive-literal preflight: 15 files, 0 hits

## Documentation review

`packages/documentation/src/content/docs/build/workflows.mdx` already states that `session.start({ kind: "task" })` is canonical, `task.start` is a compatibility alias, and work sessions create metadata/affinity without a task worktree. The final workflow-bundle fix makes the generated artifact match that already-current public claim, so no public prose change is required.

- 2026-08-16 05:14:22 append: `.task/workspace-agent/fix-remaining-cleanup-and-workflow-bundle-review-debt/workpad.md`
