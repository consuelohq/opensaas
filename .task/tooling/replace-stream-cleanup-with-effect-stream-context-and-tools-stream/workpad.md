# replace stream cleanup with effect stream context and tools stream

branch: `task/tooling/replace-stream-cleanup-with-effect-stream-context-and-tools-stream`
stream: `stream/tooling`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1478/replace-stream-cleanup-with-effect-stream-context-and-tools-stream
github pr: https://github.com/consuelohq/opensaas/pull/1478
started: 2026-07-14

## acceptance criteria

- [x] Remove `stream.cleanup` from scripts, package commands, typed manifests, generated surfaces, tool search, docs, snapshots, and tests.
- [x] Add one explicit `stream.create` public tool and make `task.start` direct missing-stream users to it instead of creating streams itself.
- [x] Implement OS-owned Effect stream services with a temporary parity-checked Workspace mirror.
- [x] Make stream instructions optional, exact, untruncated, selected-stream-only, and independent of `areas/`.
- [x] Seed a tiny optional `AGENTS.md` whenever `stream.create` creates a stream, without overwriting existing content.
- [x] Seed only `streams/tools/AGENTS.md` during OS install and preserve user edits across upgrades.
- [x] Add substantive internal `tools`, `media`, and `security` stream instructions.
- [x] Port strict branch-aware workpad scoping from Workspace to OS.
- [x] Make stream inventory branch-first rather than `areas/`-directory-first.
- [ ] Restore the local Media tracking ref, preserve Security without reset, and migrate Tooling to Tools only after dependency checks prove it is safe.
- [ ] Pass focused behavior tests, generated-surface checks, OS/Workspace parity, review, and publish verification.

## plan

1. Inspect current scripts, manifests, generators, installer preservation patterns, stream histories, and newer documentation-stream learnings.
2. Add focused red tests for optional exact instructions, creation seeding, cleanup removal, installer preservation, branch-first inventory, strict workpad scoping, and OS/Workspace parity.
3. Implement the shared Effect stream domain and thin CLI adapters in OS, then mirror the runtime into Workspace.
4. Wire `stream.create`, remove `stream.cleanup`, change `task.start`, update manifests/docs/generated surfaces, and add stream instruction files.
5. Run focused tests and static checks, then execute approved local/remote stream ref migration only after dry-run evidence.
6. Run repository review and verify, push, promote, and report exact branch/PR state.

## Test-first contract

- Behavior under test:
  - missing stream instructions succeed with empty content;
  - present instructions are returned byte-for-byte with no truncation and only for the selected stream;
  - `areas/<area>/AGENTS.md` is ignored;
  - `stream.create` creates the branch and tiny optional instruction file, while refusing overwrite/recreation;
  - `task.start` no longer creates missing streams;
  - installer seeds only Tools and preserves local edits;
  - stream inventory is branch-first and OS workpads use exact stream/task branch matching;
  - `stream.cleanup` is absent from every public surface;
  - OS and Workspace stream runtimes remain equivalent.
- Existing local patterns:
  - Effect service/process/config separation from `scripts/lib/code-call` and `scripts/lib/browser`;
  - preserve-if-missing installer behavior from bundled steering seeding;
  - generated manifest/type/doc workflow rather than hand-editing derived files;
  - strict Workspace stream-workpad matching as the behavior to port into OS.
- New or changed tests:
  - focused stream service tests in both packages or a shared parity suite;
  - installer preservation tests;
  - facade/manifest/tool-search contracts for `stream.create` and cleanup removal;
  - task-start missing-stream routing contract;
  - branch/ref migration verification packet.
- Focused red command:
  - `bun --cwd packages/workspace test tests/stream-service.test.ts tests/stream-lifecycle.test.ts`
  - `bun --cwd packages/os test tests/stream-service.test.ts tests/install-state.test.ts`
- Expected red failure:
  - the Effect stream service and `stream.create` do not exist;
  - current context still consults `areas/` and omits instructions;
  - OS workpad matching is loose;
  - installer has no stream seeding;
  - cleanup remains publicly exposed.

## implementation status

- Added a shared Effect stream domain and thin CLI adapters in both OS and Workspace.
- Stream creation is fail-closed: the instruction commit is created first, then the durable branch is created at that commit. A failed instruction commit cannot leave a partially initialized branch.
- Generated manifests, types, workflow bundles, and tool docs contain `stream.create`; they contain no `stream.cleanup` or `--create-stream` surface.
- The installed OS seeds only `streams/tools/AGENTS.md` and preserves user edits.
- Local `stream/media` was restored as a tracking ref for `origin/stream/media` without changing the remote or its three open task PRs.
- `stream/security` was inspected and left untouched. It has active worktrees and open task PRs, so no reset or ref mutation was attempted.
- Tooling-to-Tools retirement is currently blocked by PR #1478, whose base is `stream/tooling`. The task promotion code enforces that `task/tooling/*` promotes to `stream/tooling`; deleting or retargeting the stream before promotion would violate the workflow invariant. Local Tooling has zero unique commits and is 110 commits behind origin, and no other open PR uses Tooling as a base. Retire Tooling only after this task is promoted and no Tooling-base PR remains.

## validation evidence

- Red: `tests/stream-service.test.ts` failed before the Effect service existed and again when branch creation preceded instruction commit creation.
- Green: Workspace focused stream/search/manifest/workpad matrix: 29 tests passed.
- Green: OS installer/search/manifest matrix: 21 tests passed.
- Green: OS parity audit: 1 test passed against the refreshed complete 321-script inventory.
- Green: Workspace full typed-facade suite: 557 tests passed.
- Green: OS typed-facade `stream.create` contract: 5 tests passed.
- Green: both package syntax checks passed.
- Green: changed runtime files passed `checkFiles`; the only initial failure was an explicit-module marker in `inventory.ts`, which was corrected in both mirrors.
- Known unrelated baseline: the full OS facade suite has existing Media example-input validation failures. The targeted `stream.create` facade contract passes.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/stream-lifecycle.js` (deleted)
- `packages/os/scripts/stream-cleanup.js` (deleted)
- `packages/workspace/scripts/lib/stream-lifecycle.js` (deleted)
- `packages/workspace/scripts/lib/stream-workpads.js` (deleted)
- `packages/workspace/scripts/stream-cleanup.js` (deleted)
- `packages/workspace/tests/stream-lifecycle.test.ts` (deleted)

## workspace-owned: files changed

- `packages/os/scripts/lib/stream-lifecycle.js` (deleted)
- `packages/os/scripts/stream-cleanup.js` (deleted)
- `packages/workspace/scripts/lib/stream-lifecycle.js` (deleted)
- `packages/workspace/scripts/lib/stream-workpads.js` (deleted)
- `packages/workspace/scripts/stream-cleanup.js` (deleted)
- `packages/workspace/tests/stream-lifecycle.test.ts` (deleted)

## workspace-owned: activity log

- 2026-07-14 16:32:23 fs.trash: `packages/workspace/scripts/stream-cleanup.js`
- 2026-07-14 16:32:23 fs.trash: `packages/os/scripts/stream-cleanup.js`
- 2026-07-14 16:32:23 fs.trash: `packages/workspace/scripts/lib/stream-lifecycle.js`
- 2026-07-14 16:32:23 fs.trash: `packages/os/scripts/lib/stream-lifecycle.js`
- 2026-07-14 16:32:23 fs.trash: `packages/workspace/scripts/lib/stream-workpads.js`
- 2026-07-14 16:32:24 fs.trash: `packages/workspace/tests/stream-lifecycle.test.ts`

## workspace-owned: validation evidence

- 2026-07-14 16:41:24 `checkFiles`: failed — COMMAND_FAILED
- 2026-07-14 16:41:42 `checkFiles`: passed — OK
- 2026-07-14 16:44:25 `review.run`: passed — OK
- 2026-07-14 16:47:00 `review.run`: passed — OK
- 2026-07-14 16:47:17 `verify`: passed — OK

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
bun run task:push -- --message "type(tooling): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/manifests/manifest.config.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/stream-context.js`
- `packages/os/scripts/stream-list.js`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/tools-search-v2.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/script-parity-classifications.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/lib/github.js`
- `packages/workspace/scripts/lib/stream-workpads.js`
- `packages/workspace/scripts/lib/streams/cli.ts`
- `packages/workspace/scripts/lib/streams/context-runtime.ts`
- `packages/workspace/scripts/lib/streams/create-runtime.ts`
- `packages/workspace/scripts/lib/streams/creation.ts`
- `packages/workspace/scripts/lib/streams/list-runtime.ts`
- `packages/workspace/scripts/lib/streams/types.ts`
- `packages/workspace/scripts/stream-context.js`
- `packages/workspace/scripts/stream-list.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/stream-service.test.ts`
- `packages/workspace/tests/stream-workpads.test.js`
- `packages/workspace/tests/tools-search-v2.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: test selection

- changed files: `.task/tasks/tooling/replace-stream-cleanup-with-effect-stream-context-and-tools-stream.json`, `.task/tooling/replace-stream-cleanup-with-effect-stream-context-and-tools-stream/current.json`, `.task/tooling/replace-stream-cleanup-with-effect-stream-context-and-tools-stream/evidence-log.json`, `.task/tooling/replace-stream-cleanup-with-effect-stream-context-and-tools-stream/read-log.json`, `.task/tooling/replace-stream-cleanup-with-effect-stream-context-and-tools-stream/session.json`, `.task/tooling/replace-stream-cleanup-with-effect-stream-context-and-tools-stream/workpad.md`, `package.json`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/stream-lifecycle.js`, `packages/os/scripts/lib/streams/cli.ts`, `packages/os/scripts/lib/streams/context-runtime.ts`, `packages/os/scripts/lib/streams/create-runtime.ts`, `packages/os/scripts/lib/streams/creation.ts`, `packages/os/scripts/lib/streams/errors.ts`, `packages/os/scripts/lib/streams/instructions.ts`, `packages/os/scripts/lib/streams/inventory.ts`, `packages/os/scripts/lib/streams/list-runtime.ts`, `packages/os/scripts/lib/streams/service.ts`, `packages/os/scripts/lib/streams/types.ts`, `packages/os/scripts/lib/streams/workpads.ts`, `packages/os/scripts/stream-cleanup.js`, `packages/os/scripts/stream-context.js`, `packages/os/scripts/stream-create.js`, `packages/os/scripts/stream-list.js`, `packages/os/scripts/task-start.js`, `packages/os/scripts/tools-search.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/streams/media/AGENTS.md`, `packages/os/streams/security/AGENTS.md`, `packages/os/streams/tools/AGENTS.md`, `packages/os/tests/audit/script-parity-audit.test.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/stream-install-state.test.ts`, `packages/os/tests/tools-search-v2.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/package.json`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/stream-lifecycle.js`, `packages/workspace/scripts/lib/stream-workpads.js`, `packages/workspace/scripts/lib/streams/cli.ts`, `packages/workspace/scripts/lib/streams/context-runtime.ts`, `packages/workspace/scripts/lib/streams/create-runtime.ts`, `packages/workspace/scripts/lib/streams/creation.ts`, `packages/workspace/scripts/lib/streams/errors.ts`, `packages/workspace/scripts/lib/streams/instructions.ts`, `packages/workspace/scripts/lib/streams/inventory.ts`, `packages/workspace/scripts/lib/streams/list-runtime.ts`, `packages/workspace/scripts/lib/streams/service.ts`, `packages/workspace/scripts/lib/streams/types.ts`, `packages/workspace/scripts/lib/streams/workpads.ts`, `packages/workspace/scripts/stream-cleanup.js`, `packages/workspace/scripts/stream-context.js`, `packages/workspace/scripts/stream-create.js`, `packages/workspace/scripts/stream-list.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/streams/media/AGENTS.md`, `packages/workspace/streams/security/AGENTS.md`, `packages/workspace/streams/tools/AGENTS.md`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/stream-lifecycle.test.ts`, `packages/workspace/tests/stream-service.test.ts`, `packages/workspace/tests/stream-workpads.test.js`, `packages/workspace/tests/tools-search-v2.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-task-session`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace task session tests`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace task session tests` passed, `workspace audit tests` passed
- failed suites: none
