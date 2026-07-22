# add Effect backed workspace fs read

branch: `task/workspace-agents/add-effect-backed-workspace-fs-read`
stream: `stream/workspace-agents`
taskSession: `tsk_bd5844185b1e`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1075/add-effect-backed-workspace-fs-read
github pr: https://github.com/consuelohq/opensaas/pull/1075
started: 2026-06-16

## acceptance criteria

- [ ] Start from `stream/workspace-agents` because Ko approved replacing the existing workspace-agent `fs.read` stream work.
- [ ] Use the current `stream/os` implementation, including review-comment fixes, as the source of truth.
- [ ] Fully remove the plain JavaScript workspace implementation from PR #1067 / prior stream work so it cannot linger or produce unwanted output.
- [ ] Add `effect` to the correct workspace package dependency boundary and lockfile.
- [ ] Implement workspace `fs.read` as an Effect-backed bounded ingestion primitive with the OS contract: text-page, media, binary, typed errors, pagination, MIME/encoding metadata, hard caps, path/symlink safety, multi-file partial failure, malformed `--files-json` handling, and invalid inverted range handling.
- [ ] Wire workspace CLI/facade/manifest/docs/generated types/snapshots to the Effect-backed implementation.
- [ ] Preserve scope to workspace `fs.read`; do not migrate `fs.search`, `fs.list`, `fs.write`, `fs.apply_patch`, `fs.trash`, or HTTP.
- [ ] Add tests proving the workspace implementation uses Effect and avoids the generator anti-pattern: no `try`, `catch`, or `await` inside `Effect.gen` generator bodies.
- [ ] Validate with focused workspace tests, generated surface checks, checkFiles, review.run, verify, and diff inspection.

## test-first contract

Behavior under test:

- Workspace `fs.read --json` returns the same OS-style `text-page` output for UTF-8 text, with `offset`, `limit`, `content`, `truncated`, and `next` where appropriate.
- Multi-file reads preserve partial success and per-file errors using the OS contract.
- Binary/PDF/invalid UTF-8 and supported images return bounded structured descriptors rather than plain text dumps.
- Directory, missing path, path traversal, symlink escape, malformed `--files-json`, and inverted `to < offset/from` return typed stable errors.
- Human output remains separate from JSON output; JSON has no ANSI/grid decoration.
- Workspace facade maps `offset`/`limit`, `from`/`to`, and `files[]` through `--files-json` correctly.
- The previous `packages/workspace/scripts/lib/fs/read.js` plain-JS implementation is removed and cannot be imported.
- The new implementation imports `effect`, uses `Effect.gen`, and static tests reject `try`, `catch`, or `await` inside Effect generator bodies.

Existing local pattern to follow:

- Workspace currently has a plain-JS bounded read implementation from PR #1067; this task intentionally replaces it.
- OS current `stream/os` fs.read is the implementation source of truth, including CodeRabbit fixes from `task/os/fix-stream-os-review-comments`.
- Workspace CLI/facade/generated surfaces follow `packages/workspace/scripts/fs.js`, `packages/workspace/scripts/lib/facade/*`, `packages/workspace/tooling/tool-manifest.json`, generated `TOOLS.md`, and `src/generated/workspace.d.ts`.

New or changed tests:

- Update `packages/workspace/tests/fs-read.test.ts` to assert OS-style output, malformed `--files-json`, invalid inverted ranges, Effect import/use, absence of old `.js` implementation, and no generator anti-pattern.
- Update `packages/workspace/tests/facade/facade.test.ts` for `fs.read` planning if needed.

Focused red command:

- `bun x vitest run packages/workspace/tests/fs-read.test.ts`

Expected red failure:

- Current workspace stream has a plain-JS `read.js`, no `read.ts`, no Effect import/use, no generator anti-pattern guard target, and likely lacks the latest OS review fixes for malformed `--files-json` and inverted ranges.

## plan

1. Read current workspace stream `fs.read` implementation, package dependency boundary, facade, manifest, docs, generated types, and tests.
2. Read current `origin/stream/os` `fs.read` implementation and review-fix files for the latest contract.
3. Update focused tests first and run red.
4. Remove old workspace plain-JS implementation and add the Effect-backed TS implementation.
5. Wire CLI/facade/manifest/docs/generated surfaces.
6. Run focused green tests, generation/type/static checks, review.run, verify, push, and promote to the stream review PR.

## current status

- Task started from `stream/workspace-agents` with task session `tsk_bd5844185b1e`.
- No production files edited yet.

## files changed

- none yet

## key decisions

- `startFrom: stream` because this is a direct replacement of existing unshipped workspace-agent stream work.
- The plain-JS workspace read implementation is intentionally not kept as a compatibility fallback.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial workpad write failed because task.start scaffolded the workpad; recovered with a force write.

- 2026-06-16 04:14:00 write: `.task/workspace-agents/add-effect-backed-workspace-fs-read/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 04:14:00 fs.write: `.task/workspace-agents/add-effect-backed-workspace-fs-read/workpad.md`
- 2026-06-16 04:21:43 fs.write: `.task/workspace-agents/add-effect-backed-workspace-fs-read/workpad.md`
- 2026-06-16 04:31:33 fs.write: `.task/workspace-agents/add-effect-backed-workspace-fs-read/workpad.md`

## workspace-owned: files read

- `packages/workspace/package.json`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/fs-read.test.ts`

## workspace-owned: TDD red evidence

    for (const body of generatorBodies) {
      expect(body).not.toMatch(/\btry\s*\{/);
      expect(body).not.toMatch(/\bcatch\s*\(/);
      expect(body).not.toMatch(/\bawait\b/);
    }
  });
});
EOF`: passed exit 0 trace: `trc_d6408fe6f666`
  - output: (result.json).toMatchObject({ type: 'text-page', path: 'small.txt', mime: 'text/plain', encoding: 'utf8', offset: 1, truncated: false, content: 'one\ntwo\nthree', }); expect(result.json.next).toBeUndefined(); expect(result.stdout).not.toMatch(/\x1b\[/); expect(result.stdout).not.toContain('────'); } finally { rmSync(root, { recursive: true, force: true }); } }); it('should return only the requested page with next for large text files', () => { const root = fixtureRoo... [truncated 7983 chars]
- 2026-06-16 04:19:40 `bash -lc bun x vitest run packages/workspace/tests/fs-read.test.ts`: failed exit 1 trace: `trc_356e773203de`
  - output: n the dedicated workspace read implementation… [90m266| [39m [34mexpect[39m([34mexistsSync[39m(oldReadModule))[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m [90m | [39m [31m^[39m [90m267| [39m [34mexpect[39m([34mexistsSync[39m(readModule))[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m [90m268| [39m [35mconst[39m source [33m=[39m [34mreadFileSync[39m(readModule[33m,[39m [32m'utf8'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/8]⎯[22m[39m error: script "task:exec" exited with code 1

## TDD red evidence

- 2026-06-16 `bun x vitest run packages/workspace/tests/fs-read.test.ts` failed as expected with 8 failures; trace `trc_356e773203de`.
- Red signals covered stale implementation removal, malformed files-json handling, inverted range handling, and multi-file result-shape mismatch.

- 2026-06-16 04:21:43 append: `.task/workspace-agents/add-effect-backed-workspace-fs-read/workpad.md`

## workspace-owned: TDD green evidence

- 2026-06-16 04:23:46 `bash -lc bun x vitest run packages/workspace/tests/fs-read.test.ts`: failed exit 1 trace: `trc_540894264dc2`
  - output: [32m'missing.txt'[39m])[33m;[39m [90m247| [39m [90m248| [39m [34mexpect[39m(result[33m.[39mstatus)[33m.[39m[34mtoBe[39m([34m0[39m)[33m;[39m [90m | [39m [31m^[39m [90m249| [39m [34mexpect[39m(result[33m.[39mjson[33m.[39mresults)[33m.[39m[34mtoHaveLength[39m([34m2[39m)[33m;[39m [90m250| [39m [34mexpect[39m(result[33m.[39mjson[33m.[39mresults[[34m0[39m])[33m.[39m[34mtoMatchObject[39m({ [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/10]⎯[22m[39m error: script "task:exec" exited with code 1
- 2026-06-16 04:25:27 `bash -lc bun x vitest run packages/workspace/tests/fs-read.test.ts`: passed exit 0 trace: `trc_eec553f66eea`
  - output: → tmux: opensaas-workspace-agents-add-effect-backed-workspace-fs-read-bd584418

## workspace-owned: validation evidence

- 2026-06-16 04:28:54 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-16 04:29:03 `checkFiles`: passed — OK
- 2026-06-16 04:30:48 `review.run`: passed — OK
- 2026-06-16 04:31:01 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/add-effect-backed-workspace-fs-read.json`, `.task/workspace-agents/add-effect-backed-workspace-fs-read/current.json`, `.task/workspace-agents/add-effect-backed-workspace-fs-read/evidence-log.json`, `.task/workspace-agents/add-effect-backed-workspace-fs-read/read-log.json`, `.task/workspace-agents/add-effect-backed-workspace-fs-read/session.json`, `.task/workspace-agents/add-effect-backed-workspace-fs-read/workpad.md`, `packages/workspace/TOOLS.md`, `packages/workspace/bun.lock`, `packages/workspace/package-lock.json`, `packages/workspace/package.json`, `packages/workspace/scripts/fs.js`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/fs/read.js`, `packages/workspace/scripts/lib/fs/read.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/fs-read.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## implemented

- Replaced the prior plain-JS workspace read service with `packages/workspace/scripts/lib/fs/read.ts` copied from current `origin/stream/os` after the CodeRabbit review fixes.
- Deleted `packages/workspace/scripts/lib/fs/read.js` so the non-Effect implementation cannot be imported or produce output.
- Updated `packages/workspace/scripts/fs.js` to use the OS async `fs.read` command path with dynamic `./lib/fs/read.ts` import, OS-style `--files-json` parsing, malformed JSON stderr handling, inverted range handling, and top-level typed errors.
- Added `effect@^3.21.3` to `packages/workspace/package.json` and updated `packages/workspace/bun.lock` plus `packages/workspace/package-lock.json`.
- Updated workspace facade normalization to send multi-file reads through `filesJson` / `--files-json`.
- Updated workspace schema signatures, tool manifest examples/arguments, generated `TOOLS.md`, and generated `src/generated/workspace.d.ts`.
- Updated workspace tests to use the OS output contract and assert no stale `read.js` exists.

## validation evidence

Passed:
- Red: `bun x vitest run packages/workspace/tests/fs-read.test.ts` failed as expected with 8 failures before implementation; trace `trc_356e773203de`.
- Green: `bun x vitest run packages/workspace/tests/fs-read.test.ts` passed, 12 tests; trace `trc_eec553f66eea`.
- Focused facade: `bun x vitest run packages/workspace/tests/facade/facade.test.ts -t 'fs read|fs.read'` passed, 3 tests; trace `trc_b629b919e5b3`.
- Generation: `cd packages/workspace && bun run generate-types && bun run generate-docs` passed; trace `trc_eef9d1e8012c`.
- Combined focused validation: fs-read suite, focused facade, and workspace audit passed; trace `trc_cfe11ba69978`.
- `checkFiles` passed on code/test/generated TS/JS files; trace `trc_36fc922b0498`.
- JSON manifest/package parsing passed for `package.json`, `package-lock.json`, and `tool-manifest.json`; trace `trc_98cc12f217cc`.
- Stale implementation search found no `ReadFs`, `readResources`, `lib/fs/read.js`, `scripts/lib/fs/read.js`, or `require('./lib/fs/read')` references under `packages/workspace`; trace `trc_2e62f3322699`.
- `review.run --no-tests` passed with 0 issues; trace `trc_22c7f2884cf7`.
- `verify --base origin/stream/workspace-agents` passed and wrote a publish-valid stamp; trace `trc_11a5a7e098bd`.

Notes:
- Initial dependency install resolved Bun lockfile, then npm package-lock generation hit an existing tree-sitter peer conflict. Recovered with `npm_config_legacy_peer_deps=true npm install --package-lock-only --ignore-scripts`; trace `trc_4b562b311949`.
- A first `checkFiles` run included JSON and failed because the checker uses `node --check`; reran on executable/TS files only and parsed JSON separately.

- 2026-06-16 04:31:33 append: `.task/workspace-agents/add-effect-backed-workspace-fs-read/workpad.md`
