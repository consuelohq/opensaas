# wire local steering folder

branch: `task/os/wire-local-steering-folder`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1052/wire-local-steering-folder
github pr: https://github.com/consuelohq/opensaas/pull/1052
started: 2026-06-15

## acceptance criteria

- [ ] Add the repo default steering folder at `packages/os/steering/`.
- [ ] Seed `packages/os/steering/system_prompt.md` from `packages/workspace/STEERING.md`.
- [ ] Seed `packages/os/steering/decision.md` from the existing OS decision guidance.
- [ ] Install/provision downloads exactly those two default markdown files into `$CONSUELO_HOME/steering/`.
- [ ] Preserve user-edited local steering files on reprovision.
- [ ] Runtime `get_steering` reads `$CONSUELO_HOME/steering/system_prompt.md` first and `$CONSUELO_HOME/steering/decision.md` second.
- [ ] Runtime `get_steering` ignores unsupported legacy `steering.md` and no longer recognizes package-root `STEERING.md` as normal steering.
- [ ] Python compatibility wrapper mirrors the same local steering folder behavior.
- [ ] Docs/source references no longer point at `packages/os/STEERING.md` for OS agent context.

## plan

1. Read current OS steering runtime, install provisioning, Python wrapper, docs generator, and focused tests.
2. Add focused tests first for local steering folder runtime and install seeding/preservation.
3. Run the focused tests red.
4. Implement minimal runtime/install/docs/source-file changes.
5. Run focused green tests and targeted static checks.
6. Self-review diff, update workpad, push, promote into stream PR, finish.

## Test-first contract

Behavior under test:

- `getSteering()` loads local `$CONSUELO_HOME/steering/system_prompt.md` and `decision.md` rather than package-root `STEERING.md` or the old root markdown bundle.
- `getSteering()` picks up edits to local steering files on the next call.
- `getSteering()` ignores `steering/steering.md` as an unsupported legacy name.
- `provisionLocalOs()` creates `$CONSUELO_HOME/steering/system_prompt.md` and `$CONSUELO_HOME/steering/decision.md` from bundled defaults and preserves them on reprovision.

Existing local pattern to follow:

- `packages/os/tests/os-get-steering-trace.test.ts` already uses temporary `CONSUELO_HOME` values and imports `executeGetSteering` / `getSteering`-adjacent behavior.
- `packages/os/tests/install-state.test.ts` already provisions a temp home through `runBunEval()` and asserts installed shape/preservation.

New or changed tests:

- Add runtime steering folder tests to `packages/os/tests/os-get-steering-trace.test.ts`.
- Add install seeding/preservation assertions to `packages/os/tests/install-state.test.ts`.

Focused red command:

- `bun --cwd packages/os test tests/os-get-steering-trace.test.ts -t steering`
- `bun --cwd packages/os test tests/install-state.test.ts -t steering`

Expected red failure:

- Runtime test fails because current `getSteering()` reads package-root `STEERING.md` and other root markdown files, not `$CONSUELO_HOME/steering/`.
- Install test fails because current `provisionLocalOs()` does not create `$CONSUELO_HOME/steering/system_prompt.md` or `decision.md`.

## current status

- Task started from `stream/os` with session `tsk_f77a181ee858`.
- Relevant runtime/install/Python/test files read.
- Workpad initialized before production edits.

## files changed

- none yet

## key decisions

- Use exactly two default local steering markdown files for this task: `system_prompt.md` and `decision.md`.
- Keep `get_raw_steering` conceptually separate, but update its file source/labels if root decision moves into `steering/decision.md`.
- Do not add compatibility recognition for legacy `steering.md`.

## notes for ko

- none yet

## validation evidence

- pending

## issues and recovery

- none yet

- 2026-06-15 00:53:06 write: `.task/os/wire-local-steering-folder/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-15 00:53:06 fs.write: `.task/os/wire-local-steering-folder/workpad.md`
- 2026-06-15 00:53:21 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-06-15 00:53:37 apply-patch: `packages/os/tests/install-state.test.ts`
- 2026-06-15 00:55:57 fs.write: `.task/os/wire-local-steering-folder/workpad.md`
- 2026-06-15 01:20:53 fs.write: `.task/os/wire-local-steering-folder/workpad.md`

## TDD red evidence

- `bun --cwd packages/os test tests/install-state.test.ts` failed exit 1, trace `trc_d85c82969954`.
  - Meaningful red signal: `creates the approved local home shape` fails because the expected `steering` directory is not created yet.
  - The same full-file run also exposed an unrelated existing Office site artifact assertion failure; this is outside the steering change and will be rechecked after focused implementation.
- `cd packages/os && bun run test tests/os-*steering*.test.ts` failed exit 1, trace `trc_4f346c568951`.
  - It expanded to the runtime steering test file and raw steering test file.
  - Raw steering tests passed.
  - `os-get-steering-trace.test.ts` failed during suite import with existing `bun:sqlite` resolution under the current Vitest command before the new assertions could run.


- 2026-06-15 00:55:57 append: `.task/os/wire-local-steering-folder/workpad.md`

- 2026-06-15 00:56:44 apply-patch: `packages/os/scripts/os.ts`
- 2026-06-15 00:57:05 apply-patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-15 00:57:34 apply-patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-15 00:57:47 apply-patch: `packages/os/scripts/lib/install-state.ts`

## workspace-owned: files read

- `packages/consuelo-docs/os/agent-context/steering.mdx`
- `packages/consuelo-docs/package.json`
- `packages/consuelo-docs/scripts/generate-os-source-docs.ts`
- `packages/os/server.py`
- `packages/os/tests/os_server_steering_test.py`

## workspace-owned: validation evidence

- pending
- 2026-06-15 01:10:28 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-15 01:10:37 `checkFiles`: passed — OK
- 2026-06-15 01:17:10 apply-patch: `packages/consuelo-docs/scripts/generate-os-source-docs.ts`
- 2026-06-15 01:20:05 `checkFiles`: passed — OK

## implementation summary

- Created `packages/os/steering/system_prompt.md` by copying `packages/workspace/STEERING.md`.
- Created `packages/os/steering/decision.md` by copying the existing OS decision guidance.
- Removed `packages/os/STEERING.md`.
- Updated normal TypeScript `get_steering` to read `$CONSUELO_HOME/steering/system_prompt.md` first, `$CONSUELO_HOME/steering/decision.md` second, then other supported local `*.md` files sorted by filename.
- Explicitly ignores legacy `steering.md` in the local steering folder.
- Updated install provisioning to create `$CONSUELO_HOME/steering` and seed exactly `system_prompt.md` and `decision.md` using `seed_steering` actions.
- Preserves user-edited local steering files on reprovision.
- Updated Python compatibility wrapper to mirror local steering folder behavior and guard text.
- Updated OS raw source docs generator to source `packages/os/steering/system_prompt.md` and `packages/os/steering/decision.md`.
- Regenerated OS agent-context docs and removed stale physical `os/tools/default-steering.mdx` pages so legacy slugs are handled through redirects.
- Preserved the static `os/agent-context/test-driven-agent-work` page in generated Agent Context nav.

## validation evidence

- `bun --cwd packages/os test tests/install-state.test.ts -t "creates the approved local home shape"` passed. Trace: `trc_7a69cbe91dd7`.
- `bun test packages/os/tests/os-get-steering-trace.test.ts` passed 4 tests. Trace: `trc_ebd2328d6312`.
- `python3 -m unittest packages/os/tests/os_server_steering_test.py` passed 3 tests. Trace: `trc_bdac53ca1e5f`.
- `bun test packages/os/tests/os-raw-steering.test.ts` passed 2 tests. Trace: `trc_6567dde22c26`.
- `bun run --cwd packages/consuelo-docs generate-os-source-docs` generated 4 raw source docs. Trace: `trc_605d1dfe8274`.
- `bun packages/consuelo-docs/scripts/generate-docs-json.ts` completed. Trace: `trc_6beb52dd1dd5`.
- `bun run --cwd packages/consuelo-docs validate-os-docs` passed. Trace: `trc_db210a933af5`.
- `bun run --cwd packages/consuelo-docs check-os-source-docs` passed. Trace: `trc_81ce724f2b24`.
- `checkFiles` passed for TS runtime/install/tests/docs generator. Trace: `trc_55ee121ca59b`.
- `python3 -m py_compile packages/os/server.py packages/os/tests/os_server_steering_test.py` passed before the docs-only edits. Trace: `trc_c314b2f715cf`.
- `rg -n "sourcePath: 'packages/os/(STEERING|decision)\\.md'|packages/os/STEERING\\.md" packages/consuelo-docs packages/os/scripts packages/os/server.py packages/os/tests || true` returned no matches. Trace: `trc_dc21e024603b`.

## known validation caveat

- Full `bun --cwd packages/os test tests/install-state.test.ts` still includes an unrelated existing Office site artifact assertion failure (`Quarterly Pipeline Brief` not rendered into the local Office page). The steering-specific install test passes and the same unrelated failure was present during red validation before implementation.


- 2026-06-15 01:20:53 append: `.task/os/wire-local-steering-folder/workpad.md`
