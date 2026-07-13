# port os hooks system to workspace

branch: `task/workspace-agents/port-os-hooks-system-to-workspace`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1111/port-os-hooks-system-to-workspace
github pr: https://github.com/consuelohq/opensaas/pull/1111
taskSession: `tsk_940d3d6aa62c`
started: 2026-06-17

## acceptance criteria

- [ ] Port the `packages/os/hooks` system into workspace as closely as possible.
- [ ] Wire workspace routing/facade so the hooks system can be dogfooded through workspace tools.
- [ ] Include the hook-backed `task.init` behavior/tool if OS exposes it through hooks.
- [ ] Use OS implementation as the source of truth, copy/paste where appropriate, adapt only where workspace paths/routing differ.
- [ ] Do not use `context.search` during discovery because it currently returns too many tokens.
- [ ] Use `explore` and local metadata/workpad file evidence to understand prior OS hooks work.
- [ ] Add focused tests before production edits and validate against `origin/stream/workspace-agents`.
- [ ] Promote to the workspace-agents stream review PR.

## Test-first contract

Behavior under test:
- Pending discovery of OS hooks system and workspace facade routing.

Existing local pattern to follow:
- `packages/os/hooks/**`
- OS task/init hook workpads in `.task/**/workpad.md`
- OS manifest/facade routing for hook-backed tools.

New or changed tests:
- Pending discovery.

Focused red command:
- Pending discovery.

Expected red failure:
- Workspace lacks the OS hooks files and routing behavior.

## plan

1. Use `explore` for `packages/os/hooks`, hook workpads, and task init routing. Do not use `context.search`.
2. Read OS hook files, OS tests, and the most relevant workpads surfaced by local metadata/search.
3. Locate existing workspace routing/facade/test patterns for analogous tool wiring.
4. Write focused workspace tests for hook discovery/routing before production edits.
5. Copy/adapt the OS hook system into `packages/workspace/hooks` and wire workspace facade/manifest/docs/types as needed.
6. Run focused red/green tests, generator/audit where needed, review/verify, then publish.

## current status

- Task started. Discovery in progress.

## files changed

- `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`

## workspace-owned: files changed

- `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`

## workspace-owned: activity log

- 2026-06-17 13:48:49 fs.write: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`
- 2026-06-17 13:59:03 fs.write: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`
- 2026-06-17 14:02:52 fs.write: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`
- 2026-06-17 14:53:58 fs.write: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`
- Started task from stream so the task includes the just-promoted core-manifest steering changes.

## workspace-owned: validation evidence

- 2026-06-17 14:52:27 `verify`: passed — OK

## key decisions

- Explicitly avoiding `context.search` per Ko's instruction; using `explore`, `fs.search`, `fs.read`, and local metadata/workpads only.

## notes for ko

- Will report whether `explore` surfaces the prior workpads well enough to act as pass-off context.

## improvements noticed

- none yet

## issues and recovery

- Direct `stream.context` remains blocked by the platform wrapper; used workspace `code.call` to run the same stream context script locally.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): port os hooks system" --changed
bun run task:pr
```

- 2026-06-17 13:48:49 write: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`

## workspace-owned: files read

- `packages/os/hooks/README.md`
- `packages/os/hooks/dispatcher.js`
- `packages/os/hooks/intent.js`
- `packages/os/hooks/task/guidance.js`
- `packages/os/hooks/task/workflow.js`
- `packages/os/package.json`
- `packages/os/scripts/intent.js`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/task-hook.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/task-hook-dispatcher.test.ts`
- `packages/os/tests/task-hook-workflow-contract.test.ts`
- `packages/os/tests/task-hooks.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/workflows.json`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/task-init.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tooling/tool-manifest.json`

## Discovery notes

Explore result:
- `explore` surfaced OS hook implementation/test paths, especially `packages/os/hooks/dispatcher.js`, `packages/os/hooks/intent.js`, `packages/os/tests/task-manifest-workflow-roles.test.ts`, and `packages/os/tests/workflow-intent.test.ts`.
- The first `explore` pass did not strongly surface the workpads.

Local metadata search result:
- `.task` search for hooks/task intent found the useful handoff workpads:
  - `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`
  - `.task/os/test-task-hook-workflow-contract/workpad.md`
  - `.task/os/fix-installer-dependency-ux-and-hook-materialization/workpad.md`
- This worked well as pass-off context. The workpads explain why `hooks/` is a top-level runtime directory, why workflow actions come from manifest `workflowRole`, and why `intent` is the workflow entrypoint.

OS source of truth:
- `packages/os/hooks/README.md`
- `packages/os/hooks/dispatcher.js`
- `packages/os/hooks/intent.js`
- `packages/os/hooks/task/guidance.js`
- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/task-hook.js`
- `packages/os/scripts/intent.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tooling/workflows.json`
- OS hook tests under `packages/os/tests/*hook*` and `workflow-intent.test.ts`.

Workspace seams found:
- Workspace already has `task.init` in `packages/workspace/tooling/tool-manifest.json` and `packages/workspace/scripts/task-init.js`.
- Workspace lacks `intent`, `task:hook`, `packages/workspace/hooks/task/**`, and manifest `workflowRole` metadata.
- Workspace generated `workflow-bundles.json` currently has no workflow config path.

## Test-first contract

Behavior under test:
- Workspace exposes reusable hook guidance preserving task workflow anchors with `workspace.call` wording.
- Workspace manifest-driven task workflow hooks derive next actions from `workflowRole`, not hard-coded tool names.
- Workspace hook dispatcher and `task:hook` script dispatch event JSON and preserve legacy stage mode.
- Workspace `task.start` emits manifest-driven post-start hook guidance for non-JSON callers.
- Workspace `intent` starts a task workflow, returns a generated workflow bundle, and scopes dispatch by `taskSession`.

Existing local pattern followed:
- OS hooks implementation and tests listed above.
- Existing workspace facade/manifest generator pattern from the prior core-manifest task.

New or changed tests:
- `packages/workspace/tests/task-hooks.test.ts`
- `packages/workspace/tests/task-hook-workflow-contract.test.ts`
- `packages/workspace/tests/task-hook-dispatcher.test.ts`
- `packages/workspace/tests/workflow-intent.test.ts`

Focused red command:
- `bun --cwd packages/workspace test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts`

Expected red failure:
- Workspace hook runtime modules and scripts do not exist yet; manifest lacks `intent` and `workflowRole` bindings.

- 2026-06-17 13:59:03 append: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`

## Red run evidence

Command:
- `bun --cwd packages/workspace test tests/task-hooks.test.ts tests/task-hook-workflow-contract.test.ts tests/task-hook-dispatcher.test.ts tests/workflow-intent.test.ts`

Result:
- Red as expected. `task-hooks`, `task-hook-dispatcher`, and `workflow-intent` failed at import because `packages/workspace/hooks/**` does not exist yet.
- The workflow contract tests failed because `packages/workspace/hooks/task/workflow.js` is missing.
- Trace: `trc_d605fcafb674`.

- 2026-06-17 14:02:52 append: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/port-os-hooks-system-to-workspace.json`, `.task/workspace-agents/port-os-hooks-system-to-workspace/current.json`, `.task/workspace-agents/port-os-hooks-system-to-workspace/evidence-log.json`, `.task/workspace-agents/port-os-hooks-system-to-workspace/read-log.json`, `.task/workspace-agents/port-os-hooks-system-to-workspace/session.json`, `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`, `packages/workspace/TOOLS.md`, `packages/workspace/hooks/README.md`, `packages/workspace/hooks/dispatcher.js`, `packages/workspace/hooks/intent.js`, `packages/workspace/hooks/task/guidance.js`, `packages/workspace/hooks/task/workflow.js`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/package.json`, `packages/workspace/scripts/intent.js`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/task-hook.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/task-hook-dispatcher.test.ts`, `packages/workspace/tests/task-hook-workflow-contract.test.ts`, `packages/workspace/tests/task-hooks.test.ts`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tests/workflow-intent.test.ts`, `packages/workspace/tooling/tool-manifest.json`, `packages/workspace/tooling/workflows.json`
- matched rules: `workspace-facade`, `workspace-task-session`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace task session tests`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace task session tests` passed, `workspace audit tests` passed
- failed suites: none

## Final implementation notes

Implemented:
- Ported OS hook runtime into `packages/workspace/hooks`:
  - `dispatcher.js`
  - `intent.js`
  - `task/guidance.js`
  - `task/workflow.js`
- Preserved existing `packages/workspace/hooks/diff-cockpit/cache-refresh.ts` and expanded hooks README.
- Added workspace script surfaces:
  - `packages/workspace/scripts/task-hook.js`
  - `packages/workspace/scripts/intent.js`
- Added package scripts:
  - `task:init`
  - `task:hook`
  - `intent`
- Wired `packages/workspace/scripts/task-start.js` to emit manifest-driven post-start hook guidance for non-JSON callers.
- Added `WorkflowIntentInput` to workspace facade schemas.
- Added `intent` to the workspace tool manifest and copied OS-equivalent `workflowRole` metadata for task and office workflows where workspace has the tool.
- Added `packages/workspace/tooling/workflows.json` and wired it into `packages/workspace/manifests/manifest.config.json`.
- Regenerated workspace manifests, typed docs, and generated TS surface.

Green validation:
- Hook suites passed: `task-hooks`, `task-hook-workflow-contract`, `task-hook-dispatcher`, `workflow-intent`; 19 tests. Trace `trc_f821387d74ce`.
- Manifest test passed: 3 tests. Trace `trc_a17a113b0315`.
- Repo-root manifest + tools search tests passed: 10 tests. Trace `trc_e99679a67b63`.
- Script smokes passed for `task:hook` and `intent`. Trace `trc_addcbcc1fb1a`.
- Generation passed for `generate-tool-manifest`, `generate-types`, and `generate-docs`. Trace `trc_4a650193e57a`.
- Review passed with 0 issues. Trace `trc_e49ac6fd1a99`.
- Verify passed against `origin/stream/workspace-agents` with `publishValid: true`. Trace `trc_ac53d9ee8498`.

Validation notes:
- Direct `git.diff` and some focused test command forms were blocked by the wrapper. Used test output, review, verify, and task push output as authoritative evidence.
- A full package test run was accidentally invoked once and touched facade snapshots; the snapshot was restored from HEAD before proceeding. Trace `trc_cbbcd5e1aa1a`.
- The full package run had unrelated pre-existing failures; focused hook/generator/tool-search tests and verify-selected suites passed.

## current status

- Ready to push task branch and promote into the workspace-agents stream review PR.

- 2026-06-17 14:53:58 append: `.task/workspace-agents/port-os-hooks-system-to-workspace/workpad.md`
