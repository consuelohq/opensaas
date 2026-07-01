# tool execution scheduling and compact outputs

branch: `task/os/tool-execution-scheduling-and-compact-outputs`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1323/tool-execution-scheduling-and-compact-outputs
github pr: https://github.com/consuelohq/opensaas/pull/1323
started: 2026-07-01

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

- none yet

## workspace-owned: validation evidence

- 2026-07-01 17:12:51 `verify`: passed — OK
- 2026-07-01 17:14:23 `verify`: passed — OK
- 2026-07-01 17:14:37 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/hooks/intent.js`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/scripts/fs.js`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/process-tree.ts`
- `packages/os/scripts/lib/verification.js`
- `packages/os/scripts/verify.js`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`

- 2026-07-01 17:11:52 apply-patch: `packages/os/scripts/lib/code-call/output.ts`
- 2026-07-01 17:11:52 apply-patch: `packages/os/tests/code-call.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/tool-execution-scheduling-and-compact-outputs/current.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/evidence-log.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/read-log.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/session.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/workpad.md`, `.task/tasks/os/tool-execution-scheduling-and-compact-outputs.json`, `packages/os/hooks/intent.js`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/lib/code-call/output.ts`, `packages/os/scripts/lib/code-call/process.ts`, `packages/os/scripts/lib/code-call/schema.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/process-tree.ts`, `packages/os/scripts/lib/verify-run-state.js`, `packages/os/scripts/verify.js`, `packages/os/tests/code-call-parity.test.ts`, `packages/os/tests/code-call.test.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/verify-run-state.test.js`, `packages/os/tests/workflow-intent.test.ts`, `packages/os/tooling/dev-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
