# rename worker to subagent and quiet wait

branch: `task/workspace-agents/rename-worker-to-subagent-and-quiet-wait`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1314/rename-worker-to-subagent-and-quiet-wait
github pr: https://github.com/consuelohq/opensaas/pull/1314
started: 2026-07-01

## acceptance criteria

- [x] Replace `worker.call` with a single `subagent` facade tool, no compatibility alias.
- [x] Use real provider names: `codex`, `pi`, `opencode`, `grok`.
- [x] Limit policy to `read` and `edit`.
- [x] Limit steering bundles to `core` and `media`, with `media` replacing core only when explicitly set.
- [x] Return compact trace-style subagent summaries with trace id, files read, files edited, and tools called.
- [x] Make wait quiet: no per-second countdown, one final structured report.

## plan

1. Inspect the existing worker runtime, facade schema, manifest entries, wait tool, generated docs/types, and current tests.
2. Rename the worker runtime and CLI to subagent in workspace and OS.
3. Tighten subagent inputs to provider/model/bundle/policy/instructionPath/outputFormat with read/edit policy only.
4. Add Grok CLI-backed subagent execution and compact trace-style summary output.
5. Update wait to return a quiet JSON report for duration waits and PR/deploy waits.
6. Regenerate manifests/types/docs and validate focused tests.

## current status

- Implemented and validated focused workspace subagent and wait changes. PR publish still needs final push/update.

## files changed

- `packages/workspace/scripts/lib/subagent/runtime.ts`
- `packages/workspace/scripts/subagent.ts`
- `packages/workspace/scripts/wait.js`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/TOOLS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/subagent.ts`
- `packages/os/scripts/wait.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/TOOLS.md`
- `packages/os/src/generated/workspace.d.ts`

## workspace-owned: files changed

- Removed `worker.call` from the workspace/os generated surfaces and moved the runtime to `subagent`.
- Added `grok` as a provider alongside `codex`, `pi`, and `opencode`.
- Wait duration calls now emit one final JSON report rather than a token-heavy countdown.
- Wait PR checks path added via `--pr <number>` with quiet polling.

## workspace-owned: activity log

- `trc_890393fbdffd`: `bun --check` for workspace/os subagent runtime, facade schemas/executor, and wait scripts passed.
- `trc_34763aef281d`: workspace subagent facade tests passed, 8 tests; workspace wait tests passed, 2 tests.
- `trc_ad91fd169308`: manual 1s wait smoke for workspace and OS returned single final JSON reports with no countdown.

## workspace-owned: validation evidence

- 2026-07-01: No backward compatibility alias for `worker.call`; the new tool name is only `subagent`.
- 2026-07-01: `media` steering replaces `core` steering instead of layering on top.
- 2026-07-01: Subagent result summary is trace-style and compact, not an operator-next-step wrapper.
- 2026-07-01 04:54:19 `verify`: failed — COMMAND_FAILED
- 2026-07-01 04:55:01 `verify`: failed — COMMAND_FAILED
- 2026-07-01 04:59:25 `verify`: passed — OK
- 2026-07-01 05:03:26 `verify`: failed — COMMAND_FAILED
- 2026-07-01 05:05:34 `verify`: failed — COMMAND_FAILED
- 2026-07-01 05:07:51 `verify`: passed — OK
- 2026-07-01 05:07:51 `verify`: passed — OK
- 2026-07-01 05:07:51 `verify`: passed — OK
- 2026-07-01 05:08:05 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- Need a later pass to decide whether subagent instructions should pass only the tmp path or also embed the file contents for providers that cannot read local files directly. Current runtime still reads and includes the instruction content while preserving the instructionPath in the wrapper prompt.

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

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/rename-worker-to-subagent-and-quiet-wait.json`, `.task/workspace-agents/rename-worker-to-subagent-and-quiet-wait/current.json`, `.task/workspace-agents/rename-worker-to-subagent-and-quiet-wait/reviews/1314.md`, `.task/workspace-agents/rename-worker-to-subagent-and-quiet-wait/session.json`, `.task/workspace-agents/rename-worker-to-subagent-and-quiet-wait/verify.json`, `.task/workspace-agents/rename-worker-to-subagent-and-quiet-wait/workpad.md`, `packages/os/TOOLS.md`, `packages/os/decision.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/package.json`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/subagent/runtime.ts`, `packages/os/scripts/lib/worker/runtime.ts`, `packages/os/scripts/subagent.ts`, `packages/os/scripts/wait.js`, `packages/os/scripts/worker.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/steering/system_prompt.md`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/STEERING.md`, `packages/workspace/TOOLS.md`, `packages/workspace/decision.md`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/package.json`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/subagent/runtime.ts`, `packages/workspace/scripts/lib/worker/runtime.ts`, `packages/workspace/scripts/subagent.ts`, `packages/workspace/scripts/wait.js`, `packages/workspace/scripts/worker.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
