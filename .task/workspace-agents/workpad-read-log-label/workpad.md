# workpad read log label

branch: `task/workspace-agents/workpad-read-log-label`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1149/workpad-read-log-label
github pr: https://github.com/consuelohq/opensaas/pull/1149
started: 2026-06-19

## acceptance criteria

- [x] Rename server-managed workpad sections from `workspace-owned: ...` to `Server Automatically populates this section: ...` so agents know not to edit them.
- [x] Preserve legacy `workspace-owned:` section reads for existing workpads, but write the new canonical heading on the next server update.
- [x] Keep files-read ordering chronological by session insertion order instead of alphabetical sorting.
- [x] Add every successful `task:fs read` target to the server-managed activity log in order, while still filtering internal `.task/` evidence files.
- [x] Account for `code.call` read paths by extracting deterministic file references from `codeFile`, `stdinFile`, and structured stdout packets, and sync them into files-read/activity evidence.
- [x] Preserve batch behavior: child `fs.read` and `code.call` executions should populate the same ordered workpad sections.
- [ ] Update focused workpad/code-call tests plus task-start template/docs, then run review, verify, push, and PR promotion.

## plan

1. Read workpad helper, task fs, task start, code.call CLI/runtime, trace-watch code.call row logic, and focused tests.
2. Add red coverage for canonical section headings, legacy migration, ordered read activity, and code.call read extraction.
3. Implement small helper changes in `task-workpad.js`, task start template, and code.call post-processing.
4. Update docs for the new server-managed section label and read activity behavior.
5. Run focused tests, trace smoke where useful, review, verify, push, and PR promotion.

## current status

- Implementation complete. Workpad helpers now use `Server Automatically populates this section: ...` for server-managed headings while reading/migrating legacy `workspace-owned:` sections, files-read order is first-seen session order, read events append `fs.read` activity rows, and task-scoped `code.call` syncs deterministic read paths from `codeFile`, `stdinFile`, structured stdout JSON, and structured command packets.

## Test-first contract

Behavior under test:

- Newly created workpads use `Server Automatically populates this section: ...` for server-managed files changed, activity log, and validation evidence sections.
- `syncFilesRead()` migrates legacy `workspace-owned: files read` into the new canonical section without losing existing entries.
- `syncFilesRead()` preserves first-read order and appends read rows to the server-managed activity log in that same order.
- Internal `.task/` evidence files stay filtered from files-read/activity rows.
- `code.call` with a task session records deterministic read paths from `codeFile`, `stdinFile`, and structured stdout JSON into the workpad.
- Existing TDD, validation, test-selection, files-changed, and readiness behavior remains intact.

Focused red command:

```bash
bun --cwd packages/workspace test tests/task-workpad.test.js tests/task-workpad.test.ts tests/code-call.test.ts
```

Expected red failure:

- Current tests still expect `workspace-owned:` headings, `syncFilesRead()` sorts paths, read activity is not appended, and code.call has no read-path post-processing.

## files changed

- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/code-call.ts`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/task-workpad.test.js`
- `packages/workspace/tests/task-workpad.test.ts`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/SCRIPTS.md`
- `.task/workspace-agents/workpad-read-log-label/workpad.md`

## Server Automatically populates this section: files changed

- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/code-call.ts`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/task-workpad.test.js`
- `packages/workspace/tests/task-workpad.test.ts`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/SCRIPTS.md`
- `.task/workspace-agents/workpad-read-log-label/workpad.md`

## Server Automatically populates this section: activity log

- Added canonical server-managed workpad headings and legacy section migration in `task-workpad.js`.
- Changed `syncFilesRead()` to preserve first-read order and append read activity rows.
- Wired task-scoped `code.call` to record deterministic read evidence after execution without changing the command result envelope.
- Updated new task workpad template and workpad readiness docs for the direct server-managed label.

## Server Automatically populates this section: validation evidence

- Red focused contract run failed before implementation as expected: current helpers still wrote `workspace-owned:` sections, sorted read paths, did not append read activity, and lacked code.call read extraction.
- `bun --cwd packages/workspace test tests/task-workpad.test.js tests/task-workpad.test.ts`: passed, 15 tests.
- `bun --cwd packages/workspace test tests/task-workpad.test.js tests/task-workpad.test.ts tests/code-call.test.ts`: passed, 37 tests.
- `git diff --check`: passed.
- Static destructive/secret-style scan over touched source/test/doc files: passed with zero findings.
- `bun --cwd packages/workspace test`: failed in unrelated broader suite path-sensitive facade/test-selection tests; focused contract tests for this change passed.

## key decisions

- Keep `workspace-owned:` parsing as compatibility only; newly written sections use `Server Automatically populates this section: ...`.
- Do not infer arbitrary prose paths from raw code.call output; only collect `codeFile`, `stdinFile`, structured JSON path fields, `files`/`paths` arrays, and read-shaped command arrays.
- Preserve internal `.task/` filtering for files-read/activity rows so workpad evidence files do not pollute the session read list.

## notes for ko

- Root cause: read evidence was synced separately from activity evidence, `syncFilesRead()` sorted paths alphabetically, and code.call had no post-execution read-evidence hook.
- The broader `bun --cwd packages/workspace test` suite currently has unrelated path-sensitive facade/test-selection failures; focused workpad/code.call coverage for this change is green.

## improvements noticed

- Existing tests expected an outdated code.call docs phrase while `TOOLS.md` already contained the newer manifest description; updated the assertion to match the current manifest-generated description.
- The first code.call read-evidence test used bare `stdin.txt`, which the safe path extractor intentionally rejected. Switched the fixture to `fixtures/stdin.txt` so the test exercises deterministic repo-relative reads without widening path extraction.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Server Automatically populates this section: files read

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/code-call.ts`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/lib/code-call/files.ts`
- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/tests/task-workpad.test.js`
- `packages/workspace/tests/task-workpad.test.ts`
- `scripts/operator/trace-watch.ts`

- 2026-06-19 04:50:55 apply-patch: `.task/workspace-agents/workpad-read-log-label/workpad.md`

## workspace-owned: files read

- none yet

- 2026-06-19 04:54:08 apply-patch: `.task/workspace-agents/workpad-read-log-label/workpad.md`

- 2026-06-19 04:55:12 apply-patch: `.task/workspace-agents/workpad-read-log-label/workpad.md`

## workspace-owned: validation evidence

- 2026-06-19 04:57:37 `review.run`: passed — OK
- 2026-06-19 04:58:18 `verify`: passed — OK
- 2026-06-19 05:00:23 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/workpad-read-log-label.json`, `.task/workspace-agents/workpad-read-log-label/current.json`, `.task/workspace-agents/workpad-read-log-label/evidence-log.json`, `.task/workspace-agents/workpad-read-log-label/read-log.json`, `.task/workspace-agents/workpad-read-log-label/session.json`, `.task/workspace-agents/workpad-read-log-label/workpad.md`, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/code-call.ts`, `packages/workspace/scripts/lib/task-workpad.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/tests/code-call.test.ts`, `packages/workspace/tests/task-workpad.test.js`, `packages/workspace/tests/task-workpad.test.ts`
- matched rules: `workspace-task-session`, `workspace-audit-docs`
- selected suites: `workspace task session tests`, `workspace audit tests`
- run results: `workspace task session tests` passed, `workspace audit tests` passed
- failed suites: none
