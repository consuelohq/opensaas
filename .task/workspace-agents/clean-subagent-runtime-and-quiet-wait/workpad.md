# clean subagent runtime and quiet wait

branch: `task/workspace-agents/clean-subagent-runtime-and-quiet-wait`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1334/clean-subagent-runtime-and-quiet-wait
github pr: https://github.com/consuelohq/opensaas/pull/1334
started: 2026-07-02

## acceptance criteria

- [x] Recover from restart onto a clean task branch based on `stream/workspace-agents`.
- [x] Reapply `worker.call` -> `subagent` without a compatibility alias.
- [x] Keep provider names as `codex`, `pi`, `opencode`, and `grok`.
- [x] Keep policy shape to `read` and `edit` only.
- [x] Preserve `core` default bundle and `media` as an explicit replacement bundle.
- [x] Reapply the final fix: subagent wrapper points at the tmp instruction file and summary is compact trace-style.
- [x] Keep wait chat-visible output to one final structured report.

## plan

1. Start from the current stream branch, not the conflicted PR #1314 task branch.
2. Selectively restore the intended subagent/wait source changes from the pushed recovery commit.
3. Reapply the missing local fix after restart: tmp instruction-file wrapper plus trace-style `summary` object.
4. Regenerate manifests, generated types, and TOOLS docs from the cleaned sources.
5. Run focused syntax/tests/verify, then push and merge the task into the stream.

## current status

- Clean recovery branch created from `stream/workspace-agents`. Source changes restored, final subagent summary/wrapper fix reapplied, and generated artifacts refreshed.

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

- `trc_69e32e4c3052`: selectively restored intended subagent/wait files from commit `99d761d9467dbbb061bc1a75f346fb92626ff521`.
- `trc_7e236a221dd0`: reapplied restart-lost subagent wrapper and summary fix.
- `trc_20c070cfb3eb`: regenerated manifests, generated workspace types, and TOOLS docs.

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Use a clean stream-based task branch rather than trying to merge conflicted PR #1314.
- Keep the subagent chat-visible result compact: trace id, tools called, files read, files edited, and trace events.
- Keep the tmp instruction file as the handoff boundary instead of pasting the raw request into the wrapper prompt.
- 2026-07-02 05:17:29 `verify`: passed — OK

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

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/clean-subagent-runtime-and-quiet-wait.json`, `.task/workspace-agents/clean-subagent-runtime-and-quiet-wait/current.json`, `.task/workspace-agents/clean-subagent-runtime-and-quiet-wait/session.json`, `.task/workspace-agents/clean-subagent-runtime-and-quiet-wait/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/package.json`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/subagent/runtime.ts`, `packages/os/scripts/lib/worker/runtime.ts`, `packages/os/scripts/subagent.ts`, `packages/os/scripts/wait.js`, `packages/os/scripts/worker.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/package.json`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/subagent/runtime.ts`, `packages/workspace/scripts/lib/worker/runtime.ts`, `packages/workspace/scripts/subagent.ts`, `packages/workspace/scripts/wait.js`, `packages/workspace/scripts/worker.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
