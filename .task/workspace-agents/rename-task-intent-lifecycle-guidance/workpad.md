
## final summary

- Renamed workflow lifecycle entrypoint to task.intent and task-intent.
- Made stream context preflight advisory only.
- Added post-start batch discovery guidance with workpad update, explore, Bun probes, and Python probes.
- Added code.call text-file guard for staged code and stdin files.
- Regenerated manifests and tool docs.

## validation

- PASS workspace workflow/code-call tests.
- PASS OS workflow-intent tests.
- PASS script audit.
- PASS review.run.
- PASS verify publish gate.

## workspace-owned: validation evidence

- 2026-06-19 06:46:04 `verify`: passed — OK
- 2026-06-19 06:47:57 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/rename-task-intent-lifecycle-guidance.json`, `.task/workspace-agents/rename-task-intent-lifecycle-guidance/current.json`, `.task/workspace-agents/rename-task-intent-lifecycle-guidance/session.json`, `.task/workspace-agents/rename-task-intent-lifecycle-guidance/verify.json`, `.task/workspace-agents/rename-task-intent-lifecycle-guidance/workpad.md`, `package.json`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/hooks/task/workflow.js`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/package.json`, `packages/os/scripts/intent.js`, `packages/os/scripts/task-intent.js`, `packages/os/tests/workflow-intent.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/hooks/task/workflow.js`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/package.json`, `packages/workspace/scripts/intent.js`, `packages/workspace/scripts/lib/code-call/file-source-guard.ts`, `packages/workspace/scripts/lib/code-call/source.ts`, `packages/workspace/scripts/task-intent.js`, `packages/workspace/senior-engineer.md`, `packages/workspace/tests/code-call-service-architecture.test.ts`, `packages/workspace/tests/code-call.test.ts`, `packages/workspace/tests/workflow-intent.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
