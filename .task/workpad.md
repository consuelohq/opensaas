# fix context save json output

branch: `task/workspace-agents/fix-context-save-json-output`
stream: `stream/workspace-agents`
task pr: https://github.com/consuelohq/opensaas/pull/368
started: 2026-05-11

## acceptance criteria

- [x] Fix `context.save` facade parse errors by making the underlying context CLI emit JSON when `--json` is passed.
- [x] Check other context subcommands behind manifest `jsonFlag` and fix similar human-output paths.
- [x] Preserve human-readable CLI output when `--json` is absent.
- [x] Validate `context.save`, `context.get`, and `context.categories` through the typed facade.
- [x] Run focused facade tests, script audit, review, verify, push, and promote.

## implementation plan

1. Read standards, script docs, context CLI, manifest, and facade tests.
2. Patch `packages/workspace/scripts/context.js` so save/get/categories honor `args.json`.
3. Validate with direct CLI/facade smoke tests and focused test suite.
4. Publish through task workflow.

## files changed

- `packages/workspace/scripts/context.js`

## key decisions

- The root cause was the context CLI accepting `--json` globally while `save`, `get`, and `categories` still printed human text.
- The manifest already appends `--json` for context tools, so the CLI now produces machine-readable stdout for those subcommands.
- `context.save --json` returns saved row metadata and content length. It does not echo the full saved content back to stdout.
- Human-readable output remains unchanged when `--json` is absent.

## notes for Ko

- The restart was needed because the workspace server loads the tool manifest at process start.
- After merging a new workspace tool to `main`, the server must restart before the MCP facade exposes the new tool name.
- The visible MCP surface reports two tools because the app exposes `get_steering` and `call`; all typed workspace tools live behind `workspace.call`.

## improvements noticed

- `context.save` could previously succeed while the facade reported `PARSE_ERROR`, which was confusing because the side effect already happened.

## errors or blockers

- `explore` failed with exit code 1 during this task. Continued with targeted reads of the context CLI, manifest, and facade tests.
- One Python patch attempt reported `target block not found`; the desired safe metadata output was already present after inspecting the file.

## validation

- Read `AGENTS.md`, `CODING-STANDARDS.md`, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/context.js`, the context manifest section, and facade test patterns.
- `node --check packages/workspace/scripts/context.js`: passed.
- `bun packages/workspace/scripts/context.js categories --json | python3 -m json.tool`: passed.
- Direct `context.js save ... --json | python3 -m json.tool`: passed.
- Direct `context.js get ... --json | python3 -m json.tool`: passed.
- `bun packages/workspace/scripts/tool-runner.ts context.save ... | python3 -m json.tool`: passed with `ok: true`; output contains metadata and no saved content echo.
- `bun packages/workspace/scripts/tool-runner.ts context.get ... | python3 -m json.tool`: passed parse.
- `bun packages/workspace/scripts/tool-runner.ts context.categories '{}' | python3 -m json.tool`: passed.
- `workspace checkFiles` for `packages/workspace/scripts/context.js`: passed.
- `cd packages/workspace && bun run test tests/facade/facade.test.ts`: passed, 439 tests. Vitest still reports existing obsolete snapshots from the facade test suite.
- `workspace audit { scripts: true }`: passed, 48 documented / 48 actual.
- `git diff --check`: passed.
- `verify`: explicitly waived by Ko for this publish because the verify path timed out and `.task/verify.json` showed stale data from another task. Do not treat verify as passed for this task.

## follow-up debt

- Fix stale task metadata reads in the verify path; `.task/verify.json` can reflect another task/worktree even while the active taskSession points elsewhere. Similar stale data issues may exist in other workspace tools that fall back to shared root `.task` state instead of taskSession-resolved worktrees.

- 2026-05-11 22:56:44 write: `.task/workpad.md`
- Resolved metadata-only merge conflicts while bringing `origin/stream/workspace-agents` into the task branch. Conflicts were limited to `.task/evidence-log.json` and `.task/workpad.md`; preserved this task metadata side.
