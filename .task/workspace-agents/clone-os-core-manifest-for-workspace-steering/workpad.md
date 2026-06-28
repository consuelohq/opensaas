# clone os core manifest for workspace steering

branch: `task/workspace-agents/clone-os-core-manifest-for-workspace-steering`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1109/clone-os-core-manifest-for-workspace-steering
github pr: https://github.com/consuelohq/opensaas/pull/1109
taskSession: `tsk_0ce4d6f10abe`
started: 2026-06-17

## acceptance criteria

- [ ] Clone the OS core-manifest pattern into `packages/workspace`.
- [ ] Workspace core selection is as close as possible to OS, while gracefully omitting tools workspace does not have.
- [ ] The generated workspace core manifest is called `core-manifest.json`.
- [ ] `get_steering` includes the core manifest instead of the full manifest.
- [ ] Do not alter OS behavior.
- [ ] Publish a reviewable PR through the workspace task flow.

## Test-first contract

Behavior under test:
- Workspace can generate a full manifest and a `core-manifest.json` from its existing `tooling/tool-manifest.json`.
- The workspace core manifest includes available OS-core-equivalent families: `context.*`, `fs.*`, `stream.*`, `task.*`, plus available singleton core tools.
- The workspace core manifest omits unavailable OS-only tools rather than failing.
- Workspace steering includes the generated core manifest and no longer embeds the full workspace manifest.

Existing local pattern to follow:
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/manifests/manifest.config.json`
- `packages/os/tests/tool-manifest.test.ts`
- Current workspace steering implementation and generated tool docs/types patterns.

New or changed tests:
- Add or update workspace manifest generator tests for full/core output.
- Add or update workspace steering tests proving steering uses `core-manifest.json` rather than the full manifest.

Focused red command:
- Pending after locating existing workspace tests.

Expected red failure:
- Workspace lacks a manifest config/core-manifest output and steering still depends on the full manifest.

## plan

1. Read current workspace steering implementation, package scripts, manifest/docs generation, and OS generator pattern.
2. Add focused failing tests for workspace core-manifest generation and steering payload.
3. Implement workspace manifest generator/config and generate `core-manifest.json`.
4. Update `get_steering` to include core manifest instead of the full manifest.
5. Run focused tests, generation, diff review, review/verify, then publish/promote PR.

## current status

- Task started. Discovery in progress.

## files changed

- `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/tests/tool-manifest.test.ts`

## workspace-owned: files changed

- `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/tests/tool-manifest.test.ts`

## workspace-owned: activity log

- 2026-06-17 05:46:30 fs.write: `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`
- 2026-06-17 05:48:15 fs.write: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-06-17 05:49:22 fs.write: `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`
- 2026-06-17 05:50:07 fs.write: `packages/workspace/manifests/manifest.config.json`
- 2026-06-17 05:51:32 fs.write: `packages/workspace/manifests/manifest.config.json`
- 2026-06-17 05:59:05 fs.write: `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`
- Initial workpad update after task start.

## workspace-owned: validation evidence

- 2026-06-17 05:57:57 `review.run`: passed — OK
- 2026-06-17 05:58:16 `verify`: passed — OK
- 2026-06-17 05:58:38 `verify`: passed — OK

## key decisions

- Start from `stream/workspace-agents` because this is a direct follow-up to current workspace-agent stream work and must reuse latest OS/workspace manifest parity changes.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Direct `stream.context` facade call was blocked by the OpenAI wrapper, so equivalent read-only stream context was run through `code.call`.
- Initial workpad write failed because task.start already created the file; recovered by reading and overwriting with the intended scoped content.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-17 05:46:30 write: `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`

## workspace-owned: files read

- `packages/os/manifests/manifest.config.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/generate-types.ts`
- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## Red run evidence

Commands:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts`
- `python -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_read_steering_includes_core_manifest_instead_of_full_manifest`

Results:
- Red as expected. Workspace has no `packages/workspace/scripts/generate-tool-manifest.ts`, so the new manifest generator test fails at import.
- Red as expected. `_read_steering()` still appends `# tool manifest` from the full manifest and does not read `CORE_MANIFEST_FILE`.

Trace IDs:
- `trc_6ecb2d64849f`
- `trc_2be6b0b62ddc`

- 2026-06-17 05:49:22 append: `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`

- 2026-06-17 05:50:07 write: `packages/workspace/manifests/manifest.config.json`

- 2026-06-17 05:51:32 write: `packages/workspace/manifests/manifest.config.json`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/clone-os-core-manifest-for-workspace-steering.json`, `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/current.json`, `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/evidence-log.json`, `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/read-log.json`, `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/session.json`, `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/verify.json`, `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`, `packages/workspace/STEERING.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/package.json`, `packages/workspace/scripts/generate-tool-manifest.ts`, `packages/workspace/server.py`, `packages/workspace/tests/server_call_test.py`, `packages/workspace/tests/tool-manifest.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Final implementation notes

Implemented:
- Added a workspace manifest generator adapted from OS.
- Added workspace manifest config and generated `core-manifest.json`.
- Core contains 51 tools: OS core minus unavailable workspace `intent`; legacy `task.call` and `task.exec` are excluded.
- Updated steering bootstrap to append `# core manifest` from `packages/workspace/manifests/core-manifest.json` instead of the full manifest.
- Added tests for generator behavior and steering behavior.

Green validation:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts` passed. Trace `trc_92713fe69b03`.
- Focused steering unittest passed. Trace `trc_523d7f3f151f`.
- Full `server_call_test` passed, 41 tests. Trace `trc_f4f27bea2eb2`.
- Repo-root Vitest for manifest + tools search passed, 10 tests. Trace `trc_22a051dd0861`.
- Python compile for `server.py` passed. Trace `trc_d8f8912395c4`.
- Manifest generation passed. Trace `trc_26398685744b`.
- `review.run` passed. Trace `trc_d7cfc0147c30`.
- `verify --base origin/stream/workspace-agents` passed with `publishValid: true`. Trace `trc_9aa03ec4e7cd`.

## current status

- Ready to push task branch and promote into the workspace-agents stream review PR.

- 2026-06-17 05:59:05 append: `.task/workspace-agents/clone-os-core-manifest-for-workspace-steering/workpad.md`
