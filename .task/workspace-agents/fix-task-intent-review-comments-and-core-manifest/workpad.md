# fix task intent review comments and core manifest

branch: `task/workspace-agents/fix-task-intent-review-comments-and-core-manifest`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1169/fix-task-intent-review-comments-and-core-manifest
github pr: https://github.com/consuelohq/opensaas/pull/1169
started: 2026-06-22

## acceptance criteria

- [x] Fix Codex and CodeRabbit review comments for task.intent lifecycle changes.
- [x] Restore task.intent to Workspace and OS core manifests.
- [x] Keep generated type/docs surfaces aligned.
- [x] Prioritize OS parity: install-state check and OS code.call staged-file guard.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Review comments addressed and validation is publish-valid.

## files changed

- packages/workspace and packages/os manifest configs/generators/core manifests/type stubs/docs.
- Workspace and OS task workflow hook discovery batch snippets.
- Workspace code.call source loader null guard.
- OS code.call runtime staged-file text guard and install-state runtime check.
- Workspace and OS workflow/code-call tests.

## Server Automatically populates this section: files changed

- Exact includeNames now wins over broad prefix/category exclusions unless excludeNames explicitly removes the tool. This keeps task.intent core while task.* remains broadly excluded.
- Post-task-start batch examples now contain executable snippets instead of prose payloads.
- OS has the same binary/content staged-file guard behavior as Workspace.

## Server Automatically populates this section: activity log

- task.intent is now present in both Workspace and OS core manifests.
- Generated d.ts exposes workspace.task.intent / os task namespace intent and removes top-level intent.
- Full docs audit still reports pre-existing unrelated missing-path debt; script audit is clean.

## Server Automatically populates this section: validation evidence

- Docs audit has 2624 pre-existing missing-path findings outside this task. Script audit passed with 61 documented and 61 actual scripts.

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## approved scope

- Fix Codex and CodeRabbit comments on stream PR 1161.
- Ensure task.intent is present in Workspace and OS core manifests.
- Prioritize OS parity and OS runtime health checks.
- Keep changes on top of stream/workspace-agents.

## review findings to address

- Workspace core manifest removed intent without adding task.intent.
- OS core manifest removed intent without adding task.intent.
- Generated type surfaces likely still expose intent instead of task.intent.
- OS install-state runtime intent check still points at scripts/intent.js.
- Post-task-start discovery batch uses prose as code.call source; replace with executable source or a safer guidance shape.
- code.call source loader should fail explicitly when sourcePath is null.
- Rename changed workflow tests to should/when format.
- Add content-based binary guard test coverage.

## Test-first contract

behavior under test:
- task.intent appears in Workspace and OS core manifests.
- generated Workspace and OS client declarations expose task.intent.
- OS doctor/install-state checks task-intent.js.
- lifecycle batch suggestion contains executable code.call snippets.
- source loader rejects unresolved codeFile path before reading.
- binary guard tests cover extension and content heuristics.

focused validation:
- Workspace workflow/code-call/core/facade tests.
- OS workflow/core/facade/install-state-related tests where available.
- manifest/docs/types regeneration plus script audit.

## workspace-owned: validation evidence

- 2026-06-22 19:28:03 `audit`: failed — COMMAND_FAILED
- 2026-06-22 19:28:16 `audit`: passed — OK
- 2026-06-22 19:29:28 `review.run`: passed — OK
- 2026-06-22 19:31:23 `review.run`: passed — OK
- 2026-06-22 19:32:19 `verify`: passed — OK
- 2026-06-22 19:33:06 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-task-intent-review-comments-and-core-manifest.json`, `.task/workspace-agents/fix-task-intent-review-comments-and-core-manifest/current.json`, `.task/workspace-agents/fix-task-intent-review-comments-and-core-manifest/session.json`, `.task/workspace-agents/fix-task-intent-review-comments-and-core-manifest/verify.json`, `.task/workspace-agents/fix-task-intent-review-comments-and-core-manifest/workpad.md`, `packages/os/hooks/task/workflow.js`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/generate-tool-manifest.ts`, `packages/os/scripts/lib/code-call/runtime.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/code-call.test.ts`, `packages/os/tests/workflow-intent.test.ts`, `packages/workspace/hooks/task/workflow.js`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/scripts/generate-tool-manifest.ts`, `packages/workspace/scripts/lib/code-call/source.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/code-call.test.ts`, `packages/workspace/tests/workflow-intent.test.ts`
- matched rules: `workspace-facade`
- selected suites: `workspace facade input contracts`
- run results: `workspace facade input contracts` passed
- failed suites: none

## summary

Fixed PR review findings for task.intent lifecycle rename. Workspace and OS now both include task.intent in core manifests, generated type/docs surfaces are aligned, OS runtime health checks scripts/task-intent.js, lifecycle hook batch guidance uses executable snippets, and staged code.call file guards cover binary/content heuristics in Workspace and OS.

## validation

- PASS: workspace workflow-intent/code-call/code-call-service-architecture focused tests, 34 tests.
- PASS: OS workflow-intent/code-call focused tests, 22 tests.
- PASS: script audit, 61 documented / 61 actual scripts.
- PASS: review.run base=origin/stream/workspace-agents, 0 blocking issues.
- PASS: verify base=origin/stream/workspace-agents, publishValid=true.
