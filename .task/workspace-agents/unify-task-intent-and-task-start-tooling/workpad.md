# unify task intent and task start tooling

branch: `task/workspace-agents/unify-task-intent-and-task-start-tooling`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1382/unify-task-intent-and-task-start-tooling
github pr: https://github.com/consuelohq/opensaas/pull/1382
started: 2026-07-09

## acceptance criteria

- [x] Expose one public task workflow entrypoint named `task.start` in both Workspace and OS.
- [x] Make the `task.start` description explicitly say to call it at the beginning of every scoped repo task, before `tools.search` or other task-start discovery.
- [x] Remove public `task.intent` tool/package-script/generated surfaces without deleting reusable internal workflow intent/hook runtime code.
- [x] Make `task.start` create the real branch/worktree/PR/session and return the selected workflow bundle plus post-start hook guidance using that real `taskSession`.
- [x] Preserve supported workflow aliases (`task`, `office`, `design`, `sites`, and OS `media`) through the combined `task.start` input.
- [x] Keep Workspace and OS manifests, schemas, docs, generated types, tests, and steering guidance aligned.
- [x] Validate focused tests, generated surfaces, review, verify, and publish through the workspace-agents stream.

## plan

1. Encode the one-tool public contract in Workspace and OS tests.
2. Run focused tests red against the current split `task.intent`/`task.start` surface.
3. Merge workflow bundle/hook output into the real `task.start` execution path.
4. Remove `task.intent` from public manifests, package scripts, core steering, docs, and generated surfaces while retaining internal runtime modules.
5. Regenerate manifests/docs/types, run focused green tests, review, verify, push, and promote.

## Test-first contract

Behavior under test:

- Core and full public manifests contain `task.start` as the sole public task workflow entrypoint and do not contain `task.intent`.
- The exact `task.start` description tells agents to call it directly before tool search at task start.
- `TaskStartInput` accepts an optional workflow selector and routes it to `--workflow`.
- Internal workflow runtime can bind the selected workflow bundle and post-start hook guidance to the real session/result created by `task.start`.
- Generated docs/types expose only `task.start` for workflow startup.
- Root/package scripts no longer advertise a separate `task-intent` command.

Focused red commands:

```bash
bun --cwd packages/workspace test tests/workflow-intent.test.ts tests/tool-manifest.test.ts
bun --cwd packages/os test tests/workflow-intent.test.ts tests/tool-manifest.test.ts
```

Expected red failure:

- Current manifests retain `task.intent` in core and full surfaces.
- Current `task.start` description only says it creates a branch/worktree/PR.
- Current `task.start` schema has no workflow selector and its JSON result omits workflow bundle/hook guidance.

## current status

- Implementation complete, review clean, full verification publish-valid, ready to push and refresh PR #1382.

## files changed

- Public Workspace and OS task manifests, core configs, generated bundles/types/docs.
- Workspace and OS task-start schemas, runtime scripts, internal workflow hook runtime, steering, and package scripts.
- Workspace and OS manifest/workflow contract tests plus obsolete Workspace facade snapshots.
- Task workpad and publish-valid verification evidence.

## workspace-owned: files changed

- `.task/workspace-agents/unify-task-intent-and-task-start-tooling/workpad.md`

## workspace-owned: activity log

- 2026-07-10 01:58:06 fs.write: `.task/workspace-agents/unify-task-intent-and-task-start-tooling/workpad.md`
- Confirmed the current two-step flow creates an unusable provisional session before the real `task.start` session.
- Started task from `stream/workspace-agents` with task session `tsk_a6d5cfe987c3`.

## workspace-owned: validation evidence

- TDD red: focused Workspace/OS contract tests failed on the split public surface, missing workflow input, weak description, and provisional-session hook behavior.
- Focused green: Workspace manifest/workflow tests — 15 passed.
- Focused green: OS manifest/workflow/media tests — 28 passed.
- OS syntax/typecheck passed; Workspace changed JavaScript file checks passed.
- Generated core/full manifests and workflow bundles contain `task.start` and no public `task.intent`.
- `review.run`: zero issues, zero blocking findings.
- Full `verify`: publish-valid; 125 facade input checks, 12 task-session tests, audit test, and DB guard passed.
- `git diff --check`: passed.

## key decisions

- Keep `hooks/intent.js` as internal workflow bundle/session-dispatch infrastructure.
- Make `task.start` the only public startup tool and bind workflow guidance to its real task session.
- Remove the separate public `task.intent` command rather than merely rewriting its description.

## notes for ko

- The observed provisional-session failure is structural, not just wording: the current intent result cannot be passed to the mutating task start call.

## improvements noticed

- Updated embedded discovery examples so they search for and validate the combined `task.start` contract instead of directing agents toward removed `task.intent` tooling.

## issues and recovery

- Passing the provisional `task.intent` session into `task.start` failed with `TASK_SESSION_NOT_FOUND`; this confirmed the structural need for one real startup boundary.
- Script audits report unrelated existing undocumented root scripts: `docs:deploy`, `media:svg`, and `web:deploy`; no task-start documentation entry is missing.
- OS `check-files` currently invokes a nonexistent `code-call` script; independent OS syntax/typecheck and the full verify gate passed.
- Full facade execution has unrelated branch-baseline drift around session-optional `fs.search`; the verification-selected facade input suite passed 125/125.
- Verification initially found one mechanical pre-existing error-handling rule in the touched OS task-start file; aligned it with the Workspace main-function guard and reran verify successfully.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): unify task start workflow entrypoint" --changed
bun run task:pr
```

- 2026-07-10 01:58:06 write: `.task/workspace-agents/unify-task-intent-and-task-start-tooling/workpad.md`

## workspace-owned: files read

- `package.json`
- `packages/os/hooks/README.md`
- `packages/os/hooks/task/workflow.js`
- `packages/os/manifests/manifest.config.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/task-start.js`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/workflows.json`
- `packages/workspace/STEERING.md`
- `packages/workspace/hooks/README.md`
- `packages/workspace/hooks/task/workflow.js`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/tooling/workflows.json`
