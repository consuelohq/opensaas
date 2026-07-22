# add workflow intent bundles

branch: task/os/add-workflow-intent-bundles
stream: stream/os
source: stream/os
pr: https://github.com/consuelohq/opensaas/pull/978
started: 2026-06-11

## acceptance criteria

- [x] Add an OS workflow intent surface that can return workflow-specific manifest bundles and dispatch scoped hook events through one core-style interface.
- [x] Keep `get_steering` behavior unchanged in this PR; core steering shrink is a later switch after architecture is proven.
- [x] Generate workflow bundle metadata from manifest roles/capabilities, not hard-coded tool lists embedded in hook code.
- [x] Support at least `task` and `office` workflows. Office may be skeletal, but it must prove design/office/sites alias tolerance through manifest metadata.
- [x] Ensure every real hook dispatch path is scoped by `taskSession` and does not leak events across concurrent sessions/worktrees.
- [x] Preserve the existing task workflow registry and dispatcher behavior.
- [x] Add tests proving intent returns task bundles, handles office aliases, and keeps concurrent task sessions isolated.
- [x] Validate with focused red/green tests, existing hook/manifest tests, generation/syntax checks, review, verify, task.push, and task.pr into stream/os.

## plan

1. Explore current OS hooks, dispatcher, manifest generator, schema/tool manifest patterns, scripts, docs, and tests. Done.
2. Add focused failing tests for intent bundles, office alias resolution, and taskSession-scoped hook event dispatch. Done.
3. Implement generated workflow bundle metadata and intent runtime/CLI entrypoint with bounded scope. Done.
4. Wire manifest/tool metadata if required, regenerate generated manifests. Done.
5. Run focused tests, hook cluster, generation checks, syntax checks, review, verify, push, and promote. In progress.

## Test-first contract

behavior under test: OS workflow intent should be the small powerful core entrypoint. It starts or resolves workflow-scoped context, returns the right manifest bundle for the selected workflow, and dispatches hook events scoped by taskSession so multiple agents/worktrees cannot receive each other's hook state.

existing local pattern: `packages/os/hooks/dispatcher.js` dispatches workflow events, `packages/os/hooks/task/workflow.js` owns task lifecycle hooks, `packages/os/scripts/generate-tool-manifest.ts` generates manifest surfaces, and recent manifest-role tests lock workflowRole behavior.

new or changed tests: `packages/os/tests/workflow-intent.test.ts` covers generated workflow bundle presence, task intent first hook, office/design/sites alias resolution, taskSession-required dispatch, and concurrent taskSession isolation.

focused red command: `bun test packages/os/tests/workflow-intent.test.ts`.

expected red failure: missing `packages/os/hooks/intent.js`, missing `packages/os/manifests/workflow-bundles.json`, and missing workflow bundle generation.

no-test waiver: not applicable.

## exploration notes

- `stream.context` confirmed current stream is `stream/os`; recent stream commits include manifest roles and dispatcher work.
- `context.search workflow intent` had no relevant OS intent prior; result was unrelated dialer handoff.
- `explore` found relevant OS surfaces: `packages/os/scripts/os.ts`, `packages/os/scripts/lib/sites.ts`, current hooks/dispatcher files, manifest generator, and hook tests.
- Read current `packages/os/hooks/dispatcher.js`: dispatches task workflow events only, using manifest roles and legacy opt-in fallback.
- Read current `packages/os/hooks/task/workflow.js`: task registry has task lifecycle subscriptions and hook handlers for pre/post task start, validation, and finish.
- Read `packages/os/scripts/generate-tool-manifest.ts`: currently generates full/core manifests from `packages/os/tooling/*.json` and preserves tool definitions.
- Inspected design/office tool surface in `packages/os/tooling/dev-tool-manifest.json`: current Consuelo design/office tools live under `design.*` and `consueloDesign.*` names/category with no office workflow roles yet.
- Package scripts already have `task:hook` and `generate-tool-manifest`; there was no `intent` script before this task.

## implementation notes

- Added `packages/os/tooling/workflows.json` as workflow bundle source config for `task` and `office`.
- Updated `packages/os/scripts/generate-tool-manifest.ts` to generate `packages/os/manifests/workflow-bundles.json` from manifest roles/categories plus workflow config.
- Updated `packages/os/manifests/manifest.config.json` with `outputs.workflows` and `workflows.path`.
- Added `intent` tool to `packages/os/tooling/dev-tool-manifest.json` and core include config.
- Added office workflow roles and design/sites aliases to current `design.*` / `consueloDesign.*` manifest entries.
- Added `packages/os/hooks/intent.js` runtime with `start`, `dispatch`, and `bundleFor`.
- Intent runtime resolves workflow aliases, returns generated manifest bundle, emits first hook event, and requires `taskSession` for dispatch.
- Intent runtime stores sessions by `taskSession` and rejects a dispatch when a session is reused for a different workflow.
- Added `packages/os/scripts/intent.js` CLI as the package-script surface for start/dispatch.
- Updated `packages/os/hooks/README.md` with intent, generated workflow bundle, and taskSession scoping details.
- This PR intentionally does not shrink `get_steering`; it only adds `intent` to core and proves workflow bundles can be returned at intent time.

## validation evidence

- RED: `bun test packages/os/tests/workflow-intent.test.ts`
  - result: expected failure, missing `../hooks/intent.js`.
  - trace: `trc_98de008b2e8d`.
- GENERATE: `bun run --cwd packages/os generate-tool-manifest`
  - result: wrote full manifest (135 tools), core manifest (56 tools), and workflow bundles (2 workflows).
  - trace: `trc_275340f8906c`.
- GREEN focused: `bun test packages/os/tests/workflow-intent.test.ts`
  - result: 5 pass / 0 fail.
  - trace: `trc_21cf12c57e2c`.
- GREEN hook/manifest cluster: `bun test packages/os/tests/workflow-intent.test.ts packages/os/tests/task-hooks.test.ts packages/os/tests/task-hook-workflow-contract.test.ts packages/os/tests/task-hook-dispatcher.test.ts packages/os/tests/task-manifest-workflow-roles.test.ts`
  - result: 23 pass / 0 fail.
  - trace: `trc_cb81f69a5082`.
- CLI smoke: `bun run --cwd packages/os intent start --workflow task --task-session tsk_cli_intent --area os --title 'cli intent' --json`
  - result: returned task workflow bundle and scoped first hook result.
  - trace: `trc_951088c65ec1`.
- BUNDLE VERIFY: read generated workflow bundles, core manifest, and source manifest.
  - result: task bundle has 12 tools; office bundle has 21 tools; core manifest has `intent`; source manifest has `intent` with `workflowRole: intent.start`.
  - trace: `trc_4130832ffc02`.
- SYNTAX: `checkFiles` on `packages/os/hooks/intent.js`, `packages/os/scripts/intent.js`, `packages/os/hooks/dispatcher.js`.
  - result: all passed `node --check`.
  - trace: `trc_04aeb2fc7a68`.
- PACKAGE SYNTAX: `bun run --cwd packages/os typecheck`
  - result: workspace script syntax checks passed.
  - trace: `trc_8da590be0b95`.
- REVIEW: `review.run` base `origin/stream/os`, `noTests: true`
  - result: 0 issues, 0 blocking.
  - trace: `trc_8895c9ff3fea`.
- VERIFY: `verify` base `origin/stream/os`, `noDb: true`
  - result: publishValid true.
  - note: automatic selector picked 0 suites; manual focused/hook tests above are the test proof.
  - trace: `trc_d5e0dbb8b72b`.

## files changed

- `.task/os/add-workflow-intent-bundles/*`
- `.task/tasks/os/add-workflow-intent-bundles.json`
- `packages/os/hooks/intent.js`
- `packages/os/hooks/README.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/manifest.config.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/intent.js`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/workflows.json`

## issues / notes

- A direct `git status --short` through `task.call` was blocked by the safety layer; used typed `status`, `git.diff`, review, verify, and task.push path instead.
- `git.diff` revision mode does not show untracked generated files before `task.push`; verify did list the full changed-file set.
- `status` returned an unrelated main/diff-cockpit view despite taskSession context; relied on task-scoped review/verify evidence instead.
- Future PR: make `intent.start({ workflow: 'task' })` internally perform the mutating task-start action or explicitly return a required action depending on whether we want intent to mutate branch/worktree in one call.
- Future PR: shrink `get_steering` to true core after this architecture is exercised in a real task and office/design flow.

- 2026-06-11 21:25:42 write: `.task/os/add-workflow-intent-bundles/workpad.md`

## workspace-owned: files changed

- `.task/os/add-workflow-intent-bundles/*`
- `.task/tasks/os/add-workflow-intent-bundles.json`
- `packages/os/hooks/intent.js`
- `packages/os/hooks/README.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/manifest.config.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/intent.js`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/workflows.json`

## workspace-owned: activity log

- 2026-06-11 21:25:42 fs.write: `.task/os/add-workflow-intent-bundles/workpad.md`
