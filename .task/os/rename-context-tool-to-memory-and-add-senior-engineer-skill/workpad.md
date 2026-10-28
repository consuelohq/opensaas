# rename context tool to memory and add senior engineer skill

branch: `task/os/rename-context-tool-to-memory-and-add-senior-engineer-skill`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1542/rename-context-tool-to-memory-and-add-senior-engineer-skill
github pr: https://github.com/consuelohq/opensaas/pull/1542
started: 2026-07-21

## acceptance criteria

- [x] `memory` is the canonical OS tool, generated method, manifest entry, CLI script, documentation name, and skill reference; the standalone `context` tool is removed.
- [x] `stream.context`, diff context lines, browser contexts, and ordinary English uses of context remain unchanged.
- [x] Memory operations `search`, `find`, `get`, `list`, `save`, `categories`, and `trace` retain their current input contract under `MemoryInput`.
- [x] Saved memories use the Consuelo runtime SQLite database under `CONSUELO_HOME` and require no Supabase variables or network access.
- [x] Trace lookup continues to read the local trace SQLite database through the renamed tool.
- [x] The OS senior-engineer skill is refreshed from the current `packages/workspace/senior-engineer.md` source and updated to reference canonical `memory` calls.
- [x] `packages/os/skills/skills.json` is regenerated from `skill.json` files and contains the refreshed active senior-engineer skill.
- [x] Focused red/green tests, generated-surface checks, review, and verify pass.
- [x] Code Mode behavior and public contracts are not changed by this task.

## plan

1. Add focused red contracts for local SQLite memory behavior, manifest/schema rename, generated surface, and senior-engineer skill synchronization.
2. Replace the Supabase-backed `context.js` runtime with `memory.js` backed by the Consuelo runtime database while retaining trace lookup.
3. Rename the canonical schema and manifest entry, then regenerate manifests, types, and docs.
4. Refresh OS skill bodies and fixtures that call the tool, regenerate `skills.json`, and verify registry consistency.
5. Run focused tests, review, verify, inspect the diff, and publish PR #1542 without Code Mode changes.

## Test-first contract

### Behavior under test

- With a temporary `CONSUELO_HOME` and no Supabase environment, `memory save` persists a record into the runtime `consuelo.db`.
- A later process can `search`, `find`, `get`, `list`, and enumerate `categories` from the same database.
- `memory trace --db <trace-db>` retains local trace filtering behavior.
- The OS facade exposes `memory` with `MemoryInput`, plans `scripts/memory.js`, and no longer exposes the standalone `context` tool.
- Generated manifests, TypeScript client declarations, and docs contain `memory` and omit standalone `workspace.context`.
- The OS senior-engineer skill matches the latest Workspace source after the intentional `context` tool-reference rename.
- Running `generate-skills-registry` deterministically includes the senior-engineer `skill.json` entry.

### Focused red commands

- `bun test tests/memory.test.ts`
- `bun test tests/facade/facade.test.ts --test-name-pattern "canonical memory"`
- `bun test tests/tool-manifest.test.ts tests/skills-registry.test.ts tests/senior-engineer-skill.test.ts`

### Expected red state

- `scripts/memory.js` and `MemoryInput` do not exist.
- The manifest and generated client still expose `context`.
- The current OS senior-engineer body is 30,852 characters versus 43,308 characters in the Workspace source and differs by 1,232 unified-diff lines.

## result

### Backend truth

The remembered saved-memory SQLite migration had not landed. Before this task:

- OS `scripts/context.js` was Supabase-only: 19 Supabase references, zero SQLite references, and a hard failure without Supabase configuration.
- Workspace `context.js` was also Supabase-backed for saved memories; its SQLite path was only trace inspection.
- The SQLite work already present in OS covered semantic indexing and runtime state, not saved project memory.

`scripts/memory.js` now stores memories in the existing Consuelo runtime database resolved by `scripts/lib/runtime-state.ts`:

```text
$CONSUELO_HOME/node/db/consuelo.db
```

The `memories` table owns title, category, content, created/updated timestamps, and lookup indexes. No Supabase environment or network access is required. This task does not import historical Supabase rows automatically.

### Canonical OS surface

- `memory` replaces the standalone `context` tool in full and core manifests.
- `MemoryInput` replaces `ContextInput` and retains `search`, `find`, `get`, `list`, `save`, `categories`, and `trace`.
- `scripts/context.js` is deleted; `scripts/memory.js` is the package/runtime script.
- The generated TypeScript client exposes `memory(input)`.
- Active skill and steering examples use `tool: "memory"` plus `input.operation`; invalid pseudo-subtools such as `memory.search` and `memory.save` are rejected by a registry-wide test.
- `stream.context`, browser contexts, diff context lines, and ordinary conceptual uses of context remain unchanged.

### Adjacent workflows

- `tmp save` now invokes `memory.js` and persists to the same Consuelo database.
- Research ingest now exposes `memoryTitle`, `memoryCategory`, and `noMemorySave`; CLI flags are `--memory-title`, `--memory-category`, and `--no-memory-save`.
- Research ingest emits `memorySave`, writes `memory-bundle.md`, and autosaves through the `memory` package script.
- The previously advertised-but-unimplemented OS trace operation is now implemented under `memory trace` using the local trace SQLite database.

### Senior engineer and skill registry

- OS already had an active `senior-engineer` skill and `skill.json`; no new directory was needed.
- Its body was stale: 30,852 characters versus 43,308 characters in the current Workspace source, with 1,232 unified-diff lines.
- The Workspace source fixture was refreshed and the OS skill rebuilt through the existing approved-replacement migration system.
- All active OS skills are checked for invalid `memory.*` pseudo-tool references.
- The registry generator discovers skill directories containing `skill.json`, sorts them, and writes `skills.json`.
- Discovery is automatic when the generator runs; invoking the generator is not wired into build/install hooks. This task ran `bun run generate-skills-registry` explicitly and produced 12 skills.

### Final surface audit

Outside migration fixtures and explicit negative assertions:

- retired `context.*` tool operations: 0
- `memory.*` pseudo-subtools: 0
- old `scripts/context.js` runtime references: 0
- old Context input schema names: 0
- old research-ingest context fields/flags/artifacts: 0
- standalone `context` in full/core manifests: false
- `memory` in core manifest: true
- senior-engineer in generated registry: true

## benchmark evidence

| Workflow | Outer calls | Internal calls/processes | Result |
|---|---:|---:|---|
| Initial OS discovery batch | 1 | 6 | Exposed live taskless-FS ambiguity; non-FS children still returned evidence |
| Task-scoped architecture map | 1 | 4 | Mapped runtime, manifests, skill registry, and sources; final packet exceeded output budget |
| Python backend/skill analysis | 1 | 1 program | Compared storage and 43 KB skill bodies without context-window expansion |
| Initial focused red packet | 1 | 3 test processes | 687 ms; missing runtime, manifest rename, and stale skill failed as expected |
| Generator packet | 1 | 4 processes | 481 ms; manifests, types, docs, and 12-skill registry regenerated |
| Adjacent red runtime test | 1 | 1 process | 827 ms; unknown memory flags and deleted context.js path failed as expected |
| Adjacent green + migration | 1 | 1 process | 565 ms; 10 tests passed |
| Owned validation packet | 1 | 3 processes | 754 ms; 105 focused tests passed |
| Runtime + facade proof | 1 | 2 processes | 1,002 ms; five runtime tests and four canonical facade tests passed |
| Changed code validation | 1 | 2 typed child calls | 20 changed JS/TS files passed; 16 changed JSON files parsed separately |
| Final review | 1 | review pipeline | static rules, ESLint, typecheck, and spec compliance passed with zero issues |
| Final verify | 1 | review + DB guard | publish-valid stamp written; zero owned, related, or DB findings |

The useful benchmark unit remains outer model calls plus internal operations, returned evidence quality, attribution, and failure isolation. `batch` was not reliable for the red packet because its nested `code.call` lost the task worktree and stopped after the first failure; one task-scoped program ran all three test processes correctly.

## files changed

- Runtime and schemas: `scripts/memory.js`, deleted `scripts/context.js`, `scripts/lib/facade/schemas.ts`, package scripts, research-ingest, tmp, tool search, stream context.
- Manifests and generated surfaces: dev/full/core/workflow manifests, generated TypeScript, generated docs, manifest config.
- Skills: refreshed senior-engineer source fixture and OS skill; task, handoff, research-ingest, teach, and skill-creator approved replacements; regenerated `skills.json`.
- Tests: memory runtime and adjacent workflows, canonical facade rename, manifest/registry/migration guards, telemetry names, and media separation boundaries.
- Documentation/steering: OS scripts reference, development steering, and system prompt examples.

## workspace-owned: files changed

- See `git.diff`; 55 files include source, generated artifacts, migration fixtures, tests, and task evidence.

## workspace-owned: activity log

- 2026-07-21 06:04:02 fs.write: `packages/os/scripts/memory.js`

## workspace-owned: validation evidence

- Five memory runtime/adjacent tests passed, including cross-process SQLite persistence without Supabase and explicit trace DB lookup.
- Four canonical facade tests passed; standalone `context` returns `NOT_FOUND`.
- 38 manifest, registry, senior-engineer, migration, and tool-search tests passed.
- 63 trace-site and media-boundary tests passed.
- Final canonical surface audit reported zero stale product-facing names or pseudo-subtools.
- `review.run` passed static rules, ESLint, typecheck, and spec compliance with zero findings.
- `verify` passed and wrote a publish-valid task stamp.
- 2026-07-21 06:16:04 `checkFiles`: failed — COMMAND_FAILED
- 2026-07-21 06:16:57 `checkFiles`: passed — OK
- 2026-07-21 06:17:32 `review.run`: passed — OK
- 2026-07-21 06:18:46 `review.run`: passed — OK
- 2026-07-21 06:18:57 `verify`: failed — COMMAND_FAILED
- 2026-07-21 06:20:08 `checkFiles`: passed — OK
- 2026-07-21 06:20:28 `review.run`: passed — OK
- 2026-07-21 06:20:39 `verify`: passed — OK
- 2026-07-21 06:21:14 `verify`: passed — OK

## key decisions

- Remove the standalone `context` facade name rather than keeping a permanent alias; historical trace data remains readable as data.
- Keep `trace` under `memory` for contract continuity in this task. Splitting observability into a separate tool would be a separate architecture change.
- Use the existing Consuelo runtime database path instead of adding another SQLite file.
- Treat the Workspace senior-engineer document as the current content source for this migration, while making the OS skill the product-facing registered resource.

## notes for ko

- The remembered general memory migration had not landed. Other SQLite migrations did: semantic indexing and OS runtime state. Saved context memories remained Supabase-only.
- Adding a `skill.json` makes a skill discoverable by the generator, but `skills.json` is refreshed only when `bun run generate-skills-registry` is executed.

## improvements noticed

- The live taskless FS ambiguity remains until its separate fix is deployed.
- `batch` does not reliably propagate the task worktree into nested `code.call` in the currently active runtime.
- GitHub `pr.list` drops search arguments in the current typed wrapper.
- The monolithic script-parity inventory baseline has 62 unrelated drifts, making it unsuitable for isolated changes; this task added a narrow memory classification contract.
- `checkFiles` currently sends Markdown and JSON through Node syntax checking. Mixed-file validation produced false failures; code files and JSON were validated with type-appropriate paths instead.

## issues and recovery

- A pre-task OS batch exposed the still-running taskless FS ambiguity; task-scoped reads are working normally.
- Typed GitHub `pr.list` accepted search arguments but dropped them from the executed command, so historical PR-name search was not trustworthy.
- Two broad Code Mode evidence packets exceeded result budgets. Python returned the most useful compact backend and skill-drift analysis in one call.
- A broad 769-test run passed 726 tests but exposed 42 environment/snapshot-heavy facade failures and the pre-existing 62-file script-parity baseline drift. It also wrote 256 facade snapshots; the snapshot noise was reverted immediately and owned tests were rerun separately.
- Initial verify surfaced four mechanical error-boundary findings in touched `tmp.js` and `stream-context.js`; they were repaired, focused behavior remained green, and the final verify passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/memory.js`
- `packages/os/scripts/tmp.js`
- `packages/os/tooling/script-parity-classifications.json`

- 2026-07-21 06:20:53 apply-patch: `.task/os/rename-context-tool-to-memory-and-add-senior-engineer-skill/workpad.md`

- 2026-07-21 06:21:08 apply-patch: `.task/os/rename-context-tool-to-memory-and-add-senior-engineer-skill/workpad.md`
