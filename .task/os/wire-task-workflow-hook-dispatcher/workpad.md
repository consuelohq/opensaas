# wire task workflow hook dispatcher

branch: task/os/wire-task-workflow-hook-dispatcher
stream: stream/os
source: stream/os
pr: https://github.com/consuelohq/opensaas/pull/971
started: 2026-06-11

## acceptance criteria

- [x] Add a reusable OS hook dispatcher that loads the manifest, creates task workflow registries, and dispatches event objects.
- [x] Wire task hook CLI/script behavior through the dispatcher for workflow events, while keeping old stage-based scaffold compatibility.
- [x] Wire `task-start` output through the dispatcher so post-start guidance comes from the manifest-driven workflow registry.
- [x] Preserve event scoping: no task guidance for unrelated/general events.
- [x] Preserve manifest-derived tool contracts and tool-search fallback.
- [x] Validate with focused red/green tests, old compatibility tests, syntax/static checks, review, verify, and publish to stream/os.

## plan

1. Read current hook workflow, task hook script, task-start script, manifest shape, and tests. Done.
2. Add focused failing tests for dispatcher wiring and task-start integration. Done.
3. Implement dispatcher plus script integration with minimum blast radius. Done.
4. Run focused green tests and compatibility tests. Done.
5. Review diff, run review/verify, push, promote into stream/os. In progress.

## Test-first contract

behavior under test: OS task scripts should consume the manifest-driven hook workflow registry through a reusable dispatcher. `task-hook` should support workflow event payloads without breaking old stage names. `task-start` should emit post-start guidance from the dispatcher after a successful start.

existing local pattern: `packages/os/tests/task-hook-workflow-contract.test.ts` tests the registry; `packages/os/tests/task-hooks.test.ts` tests the legacy scaffold; scripts live under `packages/os/scripts`.

new or changed tests: `packages/os/tests/task-hook-dispatcher.test.ts` covers dispatcher actual-manifest resolution, null guidance for unrelated events, renderer output, `task-hook --event-json`, legacy stage compatibility, and `task-start` source integration.

focused red command: `bun test packages/os/tests/task-hook-dispatcher.test.ts`.

expected red failure: missing `packages/os/hooks/dispatcher.js` module.

no-test waiver: not applicable.

## research notes

- stream.context shows current `stream/os` and recent hook/embedding/operator work in the stream.
- Read `packages/os/hooks/task/workflow.js`, `packages/os/hooks/task/guidance.js`, `packages/os/scripts/task-hook.js`, `packages/os/scripts/task-start.js`, package scripts, and manifest entries for the task workflow tools.
- Actual OS manifest currently does not expose `workflowRole` on the core entries, so dispatcher enriches current manifest entries by canonical tool name before passing them to the workflow registry.
- The old scaffold remains a compatibility layer; new event mode uses dispatcher.

## implementation notes

- Added `packages/os/hooks/dispatcher.js`.
- Dispatcher loads `packages/os/tooling/dev-tool-manifest.json` by default, normalizes workflow roles for known task workflow tools, creates the task workflow registry, and dispatches only task events to it.
- Added `renderHookResult()` for concise agent-readable event guidance.
- Updated `packages/os/scripts/task-hook.js` to support `--event-json <path>` and optional `--manifest <path>` while preserving legacy stage mode.
- Updated `packages/os/scripts/task-start.js` non-JSON post-start guidance to emit `tool.postInvoke` / `task.start` through `dispatchHookEvent()` and render the manifest-driven hook result.
- Did not remove the old `guidance.js` scaffold.

## validation evidence

- RED: `bun test packages/os/tests/task-hook-dispatcher.test.ts`
  - result: expected failure, missing `../hooks/dispatcher.js`.
  - trace: `trc_6cefd334e5eb`.
- GREEN focused: `bun test packages/os/tests/task-hook-dispatcher.test.ts`
  - result: 5 pass / 0 fail.
  - trace: `trc_e88b3af2c303`.
- GREEN hook cluster: `bun test packages/os/tests/task-hooks.test.ts packages/os/tests/task-hook-workflow-contract.test.ts packages/os/tests/task-hook-dispatcher.test.ts`
  - result: 14 pass / 0 fail.
  - trace: `trc_9faed4504710`.
- SYNTAX: `checkFiles` on `packages/os/hooks/dispatcher.js`, `packages/os/scripts/task-hook.js`, `packages/os/scripts/task-start.js`
  - result: passed `node --check` for all three.
  - trace: `trc_a060d8d056a9`.
- DIFF/STATUS: `git.diff` against `origin/stream/os` returns zero before push because new files are untracked; `git status --short` confirms modified `task-hook.js` / `task-start.js` plus new dispatcher/test/task metadata.
  - trace: `trc_541c607bfb5f`.
- REVIEW: `review.run` base `origin/stream/os`, `noTests: true`
  - result: 0 issues in my changes.
  - note: 1 pre-existing `ERROR_HANDLING` warning in `packages/os/scripts/task-start.js` line 267.
  - trace: `trc_66b82cb75a9d`.
- VERIFY: `verify` base `origin/stream/os`, `noDb: true`
  - result: publishValid true.
  - note: automatic selector picked 0 suites; manual hook test cluster above is the test proof.
  - trace: `trc_3e47a112e0fa`.

## files changed

- `.task/os/wire-task-workflow-hook-dispatcher/*`
- `.task/tasks/os/wire-task-workflow-hook-dispatcher.json`
- `packages/os/hooks/dispatcher.js`
- `packages/os/scripts/task-hook.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/task-hook-dispatcher.test.ts`

## issues / notes

- The dispatcher uses a small canonical-name-to-workflowRole compatibility map because current manifests do not yet contain `workflowRole`. Future manifest generation should emit those roles directly so the map can shrink or become validation-only.
- `task-start.js` still has a pre-existing review warning for broad async error handling. This change did not introduce it and review marked it pre-existing.

- 2026-06-11 18:40:17 write: `.task/os/wire-task-workflow-hook-dispatcher/workpad.md`

## workspace-owned: files changed

- `.task/os/wire-task-workflow-hook-dispatcher/*`
- `.task/tasks/os/wire-task-workflow-hook-dispatcher.json`
- `packages/os/hooks/dispatcher.js`
- `packages/os/scripts/task-hook.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/task-hook-dispatcher.test.ts`

## workspace-owned: activity log

- 2026-06-11 18:40:17 fs.write: `.task/os/wire-task-workflow-hook-dispatcher/workpad.md`
