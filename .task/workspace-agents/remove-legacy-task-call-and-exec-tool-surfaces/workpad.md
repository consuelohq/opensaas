# remove legacy task call and exec tool surfaces

branch: `task/workspace-agents/remove-legacy-task-call-and-exec-tool-surfaces`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1296/remove-legacy-task-call-and-exec-tool-surfaces
github pr: https://github.com/consuelohq/opensaas/pull/1296
started: 2026-06-30

## acceptance criteria

- [x] Remove the legacy task command execution tool entries from the workspace manifest source and generated workspace public surfaces.
- [x] Remove stale task command execution references from OS manifest/docs/test surfaces.
- [x] Keep task lifecycle tooling such as task.start/task.intent intact.
- [x] Make code.call the only documented repo-scoped command execution surface.
- [x] Delete the legacy task exec implementation and make check-files self-contained.
- [x] Preserve valid cloud/OS/workspace work by updating generated/docs/test surfaces instead of blindly picking old content.
- [x] Validate workspace and OS manifest/audit behavior.

## test-first contract

Behavior under test:
- Workspace full/core manifests and generated type surfaces no longer expose the removed task command execution tools.
- OS public/full tool manifest tests prove task lifecycle stays available while command execution is on code.call.
- OS script parity audit remains current after deleting the legacy task exec script.
- Trace-home no longer reports raw shell metrics from removed task command surfaces.
- check-files still performs per-file syntax checks without the removed helper.

Existing pattern followed:
- Manifest source drives generated docs/types.
- OS script parity baseline tracks same/changed/os-only/workspace-only state for every script path.
- Facade tests assert tool routing and generated surface behavior.

Focused tests/validation:
- node --check packages/workspace/scripts/check-files.js
- python3 -m py_compile packages/workspace/tests/server_call_test.py
- bun --cwd packages/workspace test tests/tool-manifest.test.ts --reporter=verbose
- bun --cwd packages/workspace test tests/facade/facade.test.ts --reporter=verbose
- bun --cwd packages/workspace test tests/trace-home.test.ts --reporter=verbose
- bun --cwd packages/os test tests/tool-manifest.test.ts tests/audit/script-parity-audit.test.ts --reporter=verbose
- final literal scan over workspace, OS, consuelo docs, and operator script roots

No-test/validation note:
- The Python server test file was syntax-checked instead of rerunning the full unittest after steering was loaded, because that file intentionally contains command-safety fixture literals. Earlier in the task the full unittest passed before this policy issue was noticed; final validation uses py_compile plus the safer TS/Vitest suites.

## plan

1. Remove the manifest entries and generated surfaces for the legacy command tools.
2. Remove/delete the implementation path for the old task exec helper.
3. Rework check-files so it does not depend on the deleted helper.
4. Update docs and steering to route focused execution through code.call.
5. Update tests and snapshots that previously modeled the old aliases.
6. Refresh OS script parity classifications for the current inventory.
7. Run focused validation, final scans, review, verify, and publish.

## current status

- Implementation is complete locally on the task branch.
- Final focused validation passed in trace `trc_679ab393a8b8`.
- Final legacy/bad-doc scan passed in trace `trc_7c94d9f7f241`.
- Next: run review/verify and push/promote the PR.

## files changed

Primary implementation:
- packages/workspace/tooling/tool-manifest.json
- packages/workspace/manifests/manifest.config.json
- packages/workspace/scripts/check-files.js
- packages/workspace/scripts/task-exec.js deleted
- packages/workspace/scripts/trace-home/model.ts
- packages/os/tooling/script-parity-classifications.json

Generated/docs/tests:
- packages/workspace/manifests/tool-manifest.json
- packages/workspace/TOOLS.md
- packages/workspace/src/generated/workspace.d.ts
- packages/workspace/SCRIPTS.md
- packages/workspace/STEERING.md
- packages/workspace/task.md
- packages/workspace/senior-engineer.md
- packages/workspace/tests/facade/facade.test.ts
- packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap
- packages/workspace/tests/server_call_test.py
- packages/workspace/tests/tool-manifest.test.ts
- packages/workspace/tests/trace-home.test.ts
- packages/os/tests/tool-manifest.test.ts
- packages/os/tests/audit/script-parity-audit.test.ts
- packages/os/steering/system_prompt.md
- packages/os/dev-steering.md
- packages/consuelo-docs/l/ar/os/** mirrors
- packages/os/docs/review/stream-os-pr-362-review-packet.md

## workspace-owned: files changed

- See git diff for exact current inventory.

## workspace-owned: activity log

- Removed workspace source manifest entries for the legacy task command execution tools.
- Regenerated workspace and OS manifest/docs/type surfaces.
- Replaced docs guidance with task-scoped code.call guidance.
- Removed the old task exec script and rewired check-files to run node --check directly in the selected worktree.
- Updated facade, manifest, server, trace-home, and OS audit tests for the new surface.
- Repaired OS script parity baseline after validation exposed stale script inventory.
- Cleaned malformed doc replacements such as fake CLI invocations for code.call.

## workspace-owned: validation evidence

- Final literal scan: `trc_7c94d9f7f241` returned zero hits for removed legacy markers and malformed replacement phrases.
- Final focused validation: `trc_679ab393a8b8` passed:
  - node --check packages/workspace/scripts/check-files.js
  - python3 -m py_compile packages/workspace/tests/server_call_test.py
  - workspace tool manifest test
  - workspace facade test, 558 tests
  - workspace trace-home test, 11 tests
  - OS tool manifest + script parity audit tests, 16 tests
- 2026-06-30 22:24:55 `review.run`: passed — OK
- 2026-06-30 22:25:10 `verify`: passed — OK

## key decisions

- Kept task.intent/task.start lifecycle tooling. Only the command execution surfaces were removed.
- Used code.call as the single focused execution guidance instead of preserving task.call/task.exec aliases.
- Made check-files self-contained so syntax checking stays available without the deleted helper.
- Updated OS script parity classifications to current inventory rather than weakening the audit test.
- Avoided rerunning broad Python safety fixture tests after steering due command-safety fixture literals; used py_compile and TS/Vitest coverage instead.

## notes for ko

- The PR now covers both workspace and OS surfaces.
- OS parity baseline had unrelated stale inventory; this task brought it back in sync because the audit is part of the affected validation.

## improvements noticed

- The generated/docs pipeline can still produce stale or awkward mirrors when broad text replacement is used. Future work could make docs generation assert no removed tool names in output.

## issues and recovery

- A first OS script parity run failed because the baseline missed newer script files and had one stale path. Fixed by reconciling the baseline against the actual workspace/OS script inventory.
- A broad combined command timed out once; reran the focused validations separately with sufficient timeout.
- A large inline cleanup script was blocked by platform safety checks; recovered with smaller scoped edits that avoided unsafe fixture text in the tool payload.

---

## publish checklist

```bash
bun run task:push -- --message "chore(workspace-agents): remove legacy task command surfaces" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/remove-legacy-task-call-and-exec-tool-surfaces.json`, `.task/workspace-agents/remove-legacy-task-call-and-exec-tool-surfaces/current.json`, `.task/workspace-agents/remove-legacy-task-call-and-exec-tool-surfaces/session.json`, `.task/workspace-agents/remove-legacy-task-call-and-exec-tool-surfaces/workpad.md`, `packages/consuelo-docs/l/ar/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ar/os/agent-context/steering.mdx`, `packages/consuelo-docs/l/ar/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ar/os/tools/scripts.mdx`, `packages/consuelo-docs/l/ar/os/tools/tool-manifest.mdx`, `packages/os/dev-steering.md`, `packages/os/docs/review/stream-os-pr-362-review-packet.md`, `packages/os/steering/system_prompt.md`, `packages/os/tests/audit/script-parity-audit.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/STEERING.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/scripts/check-files.js`, `packages/workspace/scripts/task-exec.js`, `packages/workspace/scripts/task-fs.js`, `packages/workspace/scripts/trace-home/model.ts`, `packages/workspace/senior-engineer.md`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/task.md`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/server_call_test.py`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tests/trace-home.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
