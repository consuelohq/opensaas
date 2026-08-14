# investigate code mode call hooks and task start consolidation

branch: `task/os/investigate-code-mode-call-hooks-and-task-start-consolidation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1541/investigate-code-mode-call-hooks-and-task-start-consolidation
github pr: https://github.com/consuelohq/opensaas/pull/1541
started: 2026-07-21

## acceptance criteria

- [x] Fix OS `code.call` mutation telemetry so a second edit to an already dirty or untracked file is still reported in `filesChanged`.
- [x] Preserve Effect-backed code-call architecture and read-mode mutation enforcement.
- [x] Measure real workflows by outer calls, child calls, elapsed time, context returned, and whether the result was sufficient to choose the next action.
- [x] Map the OS-first path for making top-level `call` the Code Mode entrypoint while keeping typed tools as internal capabilities.
- [x] Determine which `batch` semantics, if any, Code Mode lacks before proposing removal of `batch` or `code.run`.
- [x] Audit and reduce OS task-start hook output while keeping the prior public `task.intent` consolidation intact.

## plan

1. Repair the concrete OS `code.call` telemetry defect with test-first coverage.
2. Benchmark the red/green repair workflow by call count and evidence quality.
3. Inspect OS `call`, Code Mode, batch, and hook ownership using compact Code Mode evidence packets.
4. Record an OS-first architecture conclusion; do not remove public surfaces until evidence covers behavior, observability, failure isolation, and migration cost.

## Test-first contract

Behavior under test:

- When a file is already untracked or dirty before `code.call`, changing its contents during the call must include that path in `filesChanged`.
- Read mode must reject that mutation with `mutation_in_read_mode`.

Existing local pattern:

- `packages/os/tests/code-call.test.ts` already tests creation of a new file in read mode and edit-mode changed-file receipts.
- `packages/os/scripts/lib/code-call/snapshot.ts` owns before/after mutation detection and is already Effect-backed.

New test:

- Create an untracked file before execution, overwrite it with same-length content inside read-mode `code.call`, and assert the path is reported and the call fails closed.

Focused red command:

- `bun test tests/code-call-snapshot.test.ts` from `packages/os`.

Expected red failure:

- Current Git snapshot compares only porcelain status markers, so `??` remains `??` and `filesChanged` is empty.

### Task-start output contract

Behavior under test:

- The public OS `task.start` JSON response must retain workflow identity, aliases, tool names/roles, task session, required pre-edit guidance, and recommended tool names.
- It must not serialize full tool definitions or the expanded six-step discovery program.

New test:

- Build the real task workflow result, compact it through a pure task-start output boundary, and assert the compact response is materially smaller while preserving actionable fields.

Focused red command:

- `bun test tests/task-start-output.test.ts` from `packages/os`.

Expected red failure:

- The output compactor does not exist and `task-start.js` currently returns the full 23,586-character workflow object.

## result

### code.call mutation telemetry

The OS snapshot implementation compared only Git porcelain status markers. An untracked file remained `??` before and after a second content edit, so the edit disappeared from `filesChanged`.

Git snapshots now include a content identity for every dirty or untracked path:

- regular files: mode, size, and SHA-256 content digest
- symlinks: target
- missing paths: explicit missing marker
- other path types: mode, size, and modification time

The focused helper and end-to-end runtime contracts pass. A read-mode `code.call` that changes an already-untracked file now fails closed with `detectedMistakeClass: mutation_in_read_mode` and `filesChanged: ["dirty.txt"]`.

Performance is acceptable. On the current task with 12 dirty or untracked paths:

- complete snapshot median: 143.26 ms
- Git status median: 135.87 ms
- content hashing median: 0.30 ms

Git status dominates; content identity adds negligible overhead.

### task.start public output

The real task workflow startup object measured 23,586 characters, approximately 5,897 tokens:

- manifest bundle: 17,328 characters
- hook result: 5,547 characters
- tool definitions: 12
- expanded suggested discovery steps: 6

`task-start.js` now compacts only the public result boundary. The internal workflow runtime still retains the full typed manifest and hook result.

The compact result preserves:

- workflow identity and aliases
- tool names, categories, workflow roles, and capability flags
- task session and worktree context
- required pre-edit guidance
- recommended tool names

It removes full tool definitions, schemas, and embedded scanner programs. The same workflow object is now 3,672 characters, approximately 918 tokens: an 84.3% reduction.

### task intent and hooks

Public `task.intent` was already removed in the July 9 consolidation. `task.start` is the sole public startup tool in OS and Workspace. Internal `workflow.intent.*` events remain reusable hook infrastructure and should not be confused with a second public tool.

The task hook runtime is still plain CommonJS rather than Effect-backed. Post-task-start guidance still prescribes a six-step `batch` containing `explore` and Bun/Python `code.call` probes. This task compacts that guidance at the public boundary but intentionally does not replace the internal policy before the entrypoint design is settled.

### canonical task workflow source

The current OS source is `packages/os/skills/task/SKILL.md`. `packages/workspace/task.md` is the legacy twin. Both document the same lifecycle and the current `{ tool, input, taskSession, timeout }` transport. Transport migration must update the OS skill and generated docs together with the server.

## benchmark rubric

For each real workflow record:

- outer model-visible calls
- internal child calls
- elapsed time
- result size/tokens when available
- successful child operations
- whether the returned packet was sufficient to decide or act
- failure isolation and observability quality

## working benchmark results

| Real workflow | Model-visible outer calls | Typed/runtime child calls | Result |
|---|---:|---:|---|
| Initial architecture map | 1 | 7 | Actionable map; ~19.7 s because two `explore` calls dominated latency |
| Oversized mapping packet | 1 | 7 | Five useful calls succeeded, but one child failure and result truncation failed the outer call |
| Telemetry red contract | 1 | 1 process | Correct red failure: same-status content edit returned `[]` |
| Batch validation workaround | 1 | 2 `code.call` | Passed, but static mutating capability prevented verification calls from running in parallel |
| OS nested runtime proof | 1 | 1 OS `code.call` | Passed; OS Code Mode can invoke OS `code.call` and retain the child trace |
| OS verification workflow | 1 | 5 typed calls | Safety preflight, three parallel tests, and file validation passed in 1.774 s |
| Startup compaction validation | 1 batch | 2 `code.call` | Contract passed and measured 84.3% context reduction |

The benchmark demonstrates that call count alone is insufficient. The useful unit is a tuple of outer calls, child calls, elapsed time, returned context, actionability, and failure isolation.

## OS-first architecture conclusion

OS already contains the closer implementation of the proposed model:

- OS Code Mode can invoke typed tools, including OS `code.call`.
- Only recursive `code.run` is blocked.
- The program can use loops, branching, `Promise.all`, dependent calls, and final-result shaping.
- Typed child traces remain available.

The active MCP transport is still owned by `packages/workspace/server.py`. Its public signature requires `call(tool, input, taskSession, timeout)` before OS execution begins. Workspace Code Mode also blocks both nested `code.run` and nested `code.call`. Therefore the live behavior is a migration constraint, not an OS Code Mode limitation.

The target should be one OS-owned MCP execution entrypoint shaped approximately as:

```ts
os.call({
  code,
  mode,
  taskSession,
  timeout,
  memoryLimit,
  maxOperations,
  maxResultChars,
  traceLevel,
})
```

Inside that program, typed tools remain the capability substrate. `task.start`, FS, GitHub, browser, validation, and authenticated operations should not become raw shell conventions.

Before removing public `batch` and `code.run`, the entrypoint must absorb these contracts:

- fixed sequence and independent fan-out convenience
- policy-aware parallel execution
- fail-fast versus continue/handled-failure behavior
- compact versus full child-operation ledgers
- task-session propagation
- mode and mutation enforcement
- deterministic child tracing

`batch` currently has one notable property that plain public JSON cannot exploit: function-valued later inputs can derive from previous results inside the TypeScript implementation. Code Mode already expresses that more naturally. Its remaining value is convenience and concise fixed fan-out syntax, not unique execution power.

The next migration slice should create the OS-owned MCP server/transport and make Code Mode the `call` contract. Only after clients and docs move to that transport should the public `code.run` and `batch` manifest entries be deprecated.

## Code Mode changes needed before entrypoint promotion

- Child failures handled by the program should not automatically force outer failure. The program return/throw contract should control final success while the ledger still records failed children.
- Add `traceLevel: "summary" | "full" | "none"` or equivalent. Current results return both the shaped value and the full child ledger, which can duplicate context.
- Enforce a combined result budget across returned value, console output, and operation ledger.
- Preserve child trace IDs and compact per-child durations/tokens in summary mode.
- Carry taskSession directly from the MCP entrypoint into the registry.
- Keep recursive top-level Code Mode blocked while allowing nested `code.call`.
- Resolve the Effect dependency split observed when staged code loaded Effect 3.21.3 under a 3.22.0 runtime; 120 warnings produced 36,682 characters and obscured a compact benchmark result.

## files changed

- `packages/os/scripts/lib/code-call/snapshot.ts`
- `packages/os/tests/code-call-snapshot.test.ts`
- `packages/os/scripts/lib/task-start-output.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/task-start-output.test.ts`

## key decisions

- OS is the product and primary implementation target. Workspace is considered only where migration parity is required.
- Keep typed tools as the capability substrate during this investigation.
- Treat top-level Code Mode consolidation as an architecture decision, not a rename.
- Do not copy the Workspace nested `code.call` restriction into OS; OS already proves the desired composition safely.
- Compact public hook output now, but defer the internal `batch` → Code Mode recommendation and Effect-backed hook rewrite to the transport migration slice.

## notes for ko

- The task-start/tool-intent public consolidation is already complete. The remaining hook issue is payload quality and internal guidance design.
- OS Code Mode already invokes OS `code.call`; the active Workspace server is what prevents that pattern through the live MCP tool.
- The direct OS verification benchmark completed five typed child operations in one model-visible call and returned a compact proof packet.

## improvements noticed

- `packages/os/SCRIPTS.md` still describes the older command-runner model for code-call and should be updated after the entrypoint architecture is decided.
- `packages/os/scripts/generate-docs.ts`, `packages/os/decision.md`, and `packages/os/skills/task/SKILL.md` hardcode the `{ tool, input }` transport and must migrate with the OS server.
- Code Mode currently treats any failed child as outer failure even when the program handles it.
- Batch parallelism is based on static manifest capabilities, so `code.call` verification cannot run in parallel through batch.

## issues and recovery

- Live taskless `fs.read` still reproduces ambiguity because PR #1540 has not merged into the running server.
- A Code Mode source-inspection packet exceeded its output budget; the useful child traces remained observable, but the outer result failed.
- The live Workspace Code Mode blocked nested `code.call`; direct execution proved OS Code Mode does not have that restriction.
- A direct OS Code Mode verification attempt omitted taskSession, then another generated invalid nested Bun source. Passing taskSession and using direct Bash commands produced the successful one-call/five-child benchmark.
- A snapshot benchmark emitted 120 Effect version mismatch warnings; the final JSON was recovered from the staged stdout log.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): track repeated code call file mutations" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-21 03:49:08 write: `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-21 03:49:08 fs.write: `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/workpad.md`

- 2026-07-21 03:49:21 apply-patch: `packages/os/tests/code-call-snapshot.test.ts`
- 2026-07-21 03:49:44 apply-patch: `packages/os/scripts/lib/code-call/snapshot.ts`

## workspace-owned: validation evidence

- 2026-07-21 03:49:59 `checkFiles`: passed — OK
- 2026-07-21 03:52:58 apply-patch: `packages/os/tests/task-start-output.test.ts`
- 2026-07-21 03:52:58 apply-patch: `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/workpad.md`
- 2026-07-21 03:53:24 apply-patch: `packages/os/scripts/lib/task-start-output.js`
- 2026-07-21 03:53:24 apply-patch: `packages/os/scripts/task-start.js`
- 2026-07-21 03:53:46 apply-patch: `packages/os/tests/code-call-snapshot.test.ts`
- 2026-07-21 03:55:19 `checkFiles`: passed — OK
- 2026-07-21 03:55:36 `checkFiles`: passed — OK
- 2026-07-21 03:58:33 `checkFiles`: passed — OK
- 2026-07-21 03:58:55 `review.run`: passed — OK
- 2026-07-21 03:59:08 `verify`: passed — OK

## workspace-owned: files read

- none yet

- 2026-07-21 03:58:16 apply-patch: `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/current.json`, `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/evidence-log.json`, `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/explore-state.json`, `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/read-log.json`, `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/session.json`, `.task/os/investigate-code-mode-call-hooks-and-task-start-consolidation/workpad.md`, `.task/tasks/os/investigate-code-mode-call-hooks-and-task-start-consolidation.json`, `packages/os/scripts/lib/code-call/snapshot.ts`, `packages/os/scripts/lib/task-start-output.js`, `packages/os/scripts/task-start.js`, `packages/os/tests/code-call-snapshot.test.ts`, `packages/os/tests/task-start-output.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
