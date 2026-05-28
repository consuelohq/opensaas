# add neutral command aliases and worker providers

branch: `task/os/add-neutral-command-aliases-and-worker-providers`
stream: `stream/os`
taskSession: `tsk_7d30e94876d4`
task pr: https://app.graphite.com/github/pr/consuelohq/opensaas/621/add-neutral-command-aliases-and-worker-providers
github pr: https://github.com/consuelohq/opensaas/pull/621
started: 2026-05-28

## acceptance criteria

- [x] Add typed workspace tool `worker.call` with provider-agnostic input/output contract.
- [x] Add provider ids `cdx`, `opc`, and `mini` with stable behavior.
- [x] Implement `cdx` as local Codex CLI provider when safe non-interactive support is available; otherwise return capability-checked `not_configured` or `not_supported`.
- [x] Implement `opc` as OpenCode provider when safe CLI support is available; otherwise return stable `not_configured` or `not_supported`.
- [x] Implement `mini` provider profile with constrained local-helper semantics and stable unavailable status when no configured binary exists.
- [x] Enforce guardrails: instructionPath required, taskSession for edit/ship, ship fail-closed without approval, bounded timeout, bounded cwd, dangerous command/config denial, bounded output.
- [x] Preserve existing typed tools and legacy names; avoid App Server, MCP/A2A, and cloud-session integration.
- [x] Update generated docs/types and applicable steering/docs/skills to prefer neutral tool names where in scope.
- [x] Add focused tests for schema/guardrails/provider unavailable behavior/output audit metadata.
- [x] Run focused tests, docs/types generation if touched, review against `origin/stream/os`, and verify with the known recovery path if needed.
- [ ] Push and promote into the `stream/os` review PR.

## initial assumptions

- Ko explicitly established `stream/os`; task started from `stream`.
- The old names `task.exec` and `mac.exec` stay available as compatibility aliases.
- Scope excludes App Server, cloud sessions, MCP/A2A integration, and product-level remote session decisions.
- Workspace facade tools are the source of truth for repo operations.

## investigation plan

1. Inspect current manifest, schemas, executor, docs/type generation, and facade tests.
2. Check CLI availability/help for `codex`, `codex exec`, `codex app`, and `opencode` using task-scoped command execution.
3. Read the current OS task skill and related docs before mechanical command-name updates.
4. Implement the smallest provider registry/runner shape that fits existing facade conventions.
5. Add focused tests, generate docs/types, run validation, and inspect diff before publish.

## context searched

- `worker.call provider workspace facade codex opencode`: no prior context results.
- `neutral command aliases task.call mac.call stream os`: no prior context results.
- Memory quick pass found existing stream/os workflow guidance and verify recovery notes.

## cli discovery findings

- `codex --help`: installed; exposes `exec`, `app`, `app-server`, `cloud`, and other commands. App Server/cloud commands were not used.
- `codex exec --help`: installed non-interactive command; supports stdin prompt with `-`, `--cd`, `--sandbox`, `--ask-for-approval`, and `--json`.
- `codex app --help`: checked for notes only; no implementation depends on it.
- `opencode --help`: installed; exposes `opencode run`.
- `opencode run --help`: supports `--file`, `--dir`, `--format json`, and `--pure`; `--dangerously-skip-permissions` exists and is intentionally not used.

## files changed

- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/TOOLS.md`
- `packages/workspace/decision.md`
- `.task/os/add-neutral-command-aliases-and-worker-providers/*`
- `.task/tasks/os/add-neutral-command-aliases-and-worker-providers.json`

## validation evidence

- `bun run --cwd packages/workspace generate-types`: passed; regenerated workspace type stubs.
- `bun run --cwd packages/workspace generate-docs`: passed; regenerated `TOOLS.md`.
- `bun run --cwd packages/workspace test tests/facade/facade.test.ts --reporter=dot`: passed, 442 tests. Vitest reported obsolete snapshots but exited 0; snapshot churn was restored.
- `bun packages/workspace/scripts/audit.js --scripts --json`: passed with no missing or undocumented scripts.
- `bun run --cwd packages/workspace review -- --base origin/stream/os --mine --no-tests --json`: passed with no findings.
- `bun packages/workspace/scripts/verify.js --base origin/stream/os --json`: passed full review and db guard checks.
- Verify caveat: stream-local `verify.js` passed but did not write a stamp because this task uses scoped metadata and that stream version only stamps when legacy root `.task/current.json` is present.
- Recovery attempt: root `verify.js --base origin/stream/os --json` found scoped metadata but failed before stamping because the root verify path expects `review --summary-json` and `packages/workspace/scripts/test-selection.js`; the stream worktree review script does not support `--summary-json` and the test-selection script is absent on `stream/os`.
- Publish path: use root `task-push --approved --reason ...` with explicit reason tied to the passing stream-local full verify result and root verify incompatibility, rather than reintroducing legacy root task pointer metadata.

## provider behavior implemented

- `worker.call`: internal typed facade tool with `provider`, `mode`, `policy`, `instructionPath`, optional `cwd`, `taskSession`, `timeoutMs`, `workspaceOnly`, and `approval`.
- `cdx`: functional local Codex CLI runner when `codex exec` advertises safe non-interactive stdin support; otherwise returns `not_configured` or `not_supported`.
- `opc`: functional for read/safe OpenCode CLI runs when `opencode run` advertises `--file` and `--dir`; edit is `not_supported` until permission behavior is validated.
- `mini`: stable provider profile; returns `not_configured` unless a local helper binary is configured, and `not_supported` until a safe command contract exists.
- Guardrails: edit/ship require `taskSession`; ship without approval returns `approval_required`; ship with approval still returns `not_supported`; cwd/instruction paths are bounded; timeout/output are bounded; dangerous instruction patterns fail closed.

## compatibility notes

- No `task.call` or `mac.call` aliases were added; Ko clarified alias work is out of scope for this task.
- Existing typed workspace tools and existing legacy names are unchanged.
- No Codex App Server, cloud session, MCP integration, or A2A integration was added.

- 2026-05-28 20:37:32 write: `.task/os/add-neutral-command-aliases-and-worker-providers/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-28 20:37:32 fs.write: `.task/os/add-neutral-command-aliases-and-worker-providers/workpad.md`
- 2026-05-28 22:31:53 fs.write: `.task/os/add-neutral-command-aliases-and-worker-providers/workpad.md`
- 2026-05-28 22:33:54 fs.write: `.task/os/add-neutral-command-aliases-and-worker-providers/workpad.md`

## scope clarification

Ko confirmed `task.call` and `mac.call` aliases are out of scope for this task. This implementation focuses on `worker.call` and provider profiles only. Existing legacy names remain unchanged.

## tooling issue

The workspace MCP connector returned `Error code: FORBIDDEN; MCP streamable transport probe failed with HTTP 403 from consuelohq.com` twice while appending the workpad. Ko approved using the underlying Bun scripts directly, so repo operations are using the task-scoped Bun scripts from repo root.

- 2026-05-28 22:31:53 append: `.task/os/add-neutral-command-aliases-and-worker-providers/workpad.md`

## edit plan before code changes

- Add `WorkerCallInput` and `WorkerCallOutput` schema/type signatures in `packages/workspace/scripts/lib/facade/schemas.ts`.
- Add an internal `worker.call` manifest entry in `packages/workspace/tooling/tool-manifest.json`.
- Implement `worker.call` in `packages/workspace/scripts/lib/facade/executor.ts` with provider defaults, taskSession guardrails, ship fail-closed behavior, bounded cwd/timeout/output, instruction file reading, CLI help-based capability checks, and audit metadata.
- Add focused facade tests in `packages/workspace/tests/facade/facade.test.ts`.
- Regenerate `packages/workspace/TOOLS.md` and `packages/workspace/src/generated/*` if generation changes them.

## expected validation

- `bun --cwd packages/workspace run generate-types`
- `bun --cwd packages/workspace run generate-docs`
- `bun --cwd packages/workspace run test tests/facade/facade.test.ts`
- `bun --cwd packages/workspace ./scripts/git-diff.js --branch task/os/add-neutral-command-aliases-and-worker-providers --base origin/stream/os --stat --files --hunks` or direct task-worktree diff if the script shape differs.
- review and verify against `origin/stream/os`, using the known `verify.js --no-review` recovery if needed.

- 2026-05-28 22:33:54 append: `.task/os/add-neutral-command-aliases-and-worker-providers/workpad.md`
