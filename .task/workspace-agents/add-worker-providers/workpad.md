# add worker providers

branch: `task/workspace-agents/add-worker-providers`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/630/add-worker-providers
github pr: https://github.com/consuelohq/opensaas/pull/630
started: 2026-05-28

## acceptance criteria

- [x] Transplant worker-provider implementation from accidental `stream/os` commit `21ac2b88bebe1fa6f9ecfff57f9d77282379bab5` onto `stream/workspace-agents`.
- [x] Preserve existing `stream/workspace-agents` neutral alias work and facade recovery changes.
- [x] Keep this task scoped to `worker.call` and provider ids `cdx`, `opc`, and `mini`.
- [x] Do not add App Server, cloud sessions, MCP, or A2A integration.
- [x] Validate facade tests, generated docs/types, and review/verify against `origin/stream/workspace-agents`.
- [ ] Push and promote into the `stream/workspace-agents` review PR.

## plan

1. Cherry-pick commit `21ac2b88bebe1fa6f9ecfff57f9d77282379bab5` into this task worktree.
2. Resolve conflicts by keeping current `stream/workspace-agents` alias/facade changes and layering only the worker-provider implementation.
3. Regenerate workspace docs/types if manifest/schema changed.
4. Run focused facade tests plus review/verify against `origin/stream/workspace-agents`.
5. Push/promote through the workspace task scripts.

## current status

- Worker-provider implementation transplanted onto `stream/workspace-agents` via cherry-pick of `21ac2b88bebe1fa6f9ecfff57f9d77282379bab5`.
- Cherry-pick conflicts were limited to `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, and `packages/workspace/tests/facade/facade.test.ts`.
- The accidental `stream/os` task metadata from the original commit was removed during conflict resolution.

## files changed

- `packages/workspace/TOOLS.md`
- `packages/workspace/decision.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`


## workspace-owned: files changed

- `packages/workspace/TOOLS.md`
- `packages/workspace/decision.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: activity log

- `bun run --cwd packages/workspace generate-types`: passed.
- `bun run --cwd packages/workspace generate-docs`: passed.
- `bun run --cwd packages/workspace test tests/facade/facade.test.ts --reporter=dot`: failed due existing package-cwd test path assumption constructing `packages/workspace/packages/workspace/scripts/fs.js`.
- `bun x vitest run packages/workspace/tests/facade/facade.test.ts --reporter=dot`: passed, 550 tests.
- `bun packages/workspace/scripts/audit.js --scripts --json`: passed, documented 56 / actual 56.
- `bun run --cwd packages/workspace review -- --base origin/stream/workspace-agents --mine --no-tests --json`: passed with no findings.
- `bun packages/workspace/scripts/verify.js --base origin/stream/workspace-agents --json`: passed full publish-valid gate and wrote `.task/workspace-agents/add-worker-providers/verify.json`.

## workspace-owned: validation evidence

- `worker.call`: typed internal facade tool with `provider`, `mode`, `policy`, `instructionPath`, optional `cwd`, `taskSession`, `timeoutMs`, `workspaceOnly`, and `approval`.
- `cdx`: uses local `codex exec` when CLI help advertises non-interactive stdin support; otherwise returns `not_configured` or `not_supported`.
- `opc`: uses `opencode run --file --dir` for read/safe flows when available; edit remains `not_supported`.
- `mini`: stable profile returning `not_configured` without a configured local helper binary and `not_supported` until a safe command contract exists.
- Guardrails include taskSession required for edit/ship, ship approval fail-closed, bounded timeout/cwd/instructionPath/output, and dangerous instruction denial.

## key decisions

- The original worker-provider implementation was accidentally promoted to `stream/os`. This task moves it to the correct `stream/workspace-agents` stream.
- Package-cwd facade test invocation failed on two pre-existing path-sensitive tests; the same suite passed from the task worktree root, and verify's registry-selected tests passed.

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
