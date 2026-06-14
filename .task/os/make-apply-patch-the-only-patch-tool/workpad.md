# make apply_patch the only patch tool

branch: `task/os/make-apply-patch-the-only-patch-tool`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1035/make-apply-patch-the-only-patch-tool
github pr: https://github.com/consuelohq/opensaas/pull/1035
started: 2026-06-14

## acceptance criteria

- [ ] `fs.apply_patch` is the canonical Consuelo patch tool on workspace and OS surfaces.
- [ ] `fs.patch` is removed from workspace and OS manifests, generated docs, generated types, steering, and user-facing docs.
- [ ] `bun run fs -- patch ...` no longer mutates files and fails loudly with guidance to use `bun run fs -- apply-patch ...` / `fs.apply_patch`.
- [ ] `fs.apply_patch` accepts OpenCode/Codex patch syntax with embedded relative paths and supports patchText, patchFile, and stdin transport.
- [ ] `fs.apply_patch` enforces task-worktree path safety and rejects path aliases/conflicts using canonical resolved paths.
- [ ] `fs.apply_patch` applies local filesystem edits atomically enough: writes are staged before destructive deletes, and move source deletion happens only after destination write succeeds.
- [ ] Output remains structured and readable: operations, writes, deletes, touched files, dry-run marker, and patch applied message.
- [ ] Workpad evidence logs touched files for real apply-patch mutations.
- [ ] Tests cover path normalization, conflicts, move behavior, failure rollback, multiline transport, dry-run, stale patch command failure, and generated manifest/docs surfaces.
- [ ] All relevant CodeRabbit comments on the stream PR are addressed.

## test-first contract

Behavior under test:

- The old `fs.patch` tool is gone from public/generated manifests and generated facade types; only `fs.apply_patch` remains as the patch/edit primitive.
- The legacy `patch` CLI command exits non-zero and tells agents to use `apply-patch` instead; it must not mutate files.
- The apply-patch planner canonicalizes paths by resolved worktree path, rejecting equivalent aliases such as `src/a.ts` and `./src/a.ts` when they conflict.
- Apply-patch performs writes before deletes, and failure during writes does not delete existing source files.
- Move, dry-run, patchText, patchFile, and stdin transport remain covered.
- Generated docs/manifests do not contain the stale `fs.patch` tool or malformed markdown table output.

Existing local pattern:

- `packages/workspace/tests/fs-apply-patch.test.ts` uses Vitest with temp directories and direct `bun packages/workspace/scripts/fs.js` subprocess calls.
- Workspace/OS manifests are JSON sources regenerated into docs/types/manifests.

Changed tests before implementation:

- Expand `packages/workspace/tests/fs-apply-patch.test.ts` to assert no `fs.patch` exposure, stale CLI failure, canonical path conflicts, stdin multiline transport, write-failure safety, repo-convention test names, and existing apply_patch behavior.

Focused red command:

- `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`

Expected red failure:

- Current code still exposes `fs.patch` in workspace/OS manifests and generated types/docs, and `bun run fs -- patch` still mutates files.

## plan

1. Update focused tests first and run them red.
2. Remove `fs.patch` from schemas, manifests, generated types/docs, and OS manifests/docs.
3. Replace the implementation of stale `patch` CLI with a hard error that points to `apply-patch`.
4. Harden apply-patch planner around canonical keys and safer write/delete ordering.
5. Regenerate workspace docs/types and OS tool manifests.
6. Run focused green, post suites, docs/JSON checks, review, verify, then push and promote.

## current status

- Task started from `stream/os` after Ko approved the strict one-tool scope.
- Initial file read complete; implementation currently still has working `patch` command and `fs.patch` manifest entries.

## files changed

- `packages/workspace/tests/fs-apply-patch.test.ts`

## key decisions

- `fs.apply_patch` is the only usable patch tool.
- Stale `patch` command remains only as a non-mutating error shim so old invocations fail loudly with the correct replacement.
- Do not use `fs.patch` for this task's editing operations.

## notes for Ko

- This task intentionally reverses the earlier “keep fs.patch” decision.

## validation evidence

- TBD

## issues and recovery

- Initial `stream.context` call with millisecond-style timeout was blocked by tool safety; reran with `timeout: 120` and succeeded.

- 2026-06-14 06:45:02 write: `.task/os/make-apply-patch-the-only-patch-tool/workpad.md`

## workspace-owned: files changed

- `packages/workspace/tests/fs-apply-patch.test.ts`

## workspace-owned: activity log

- 2026-06-14 06:45:02 fs.write: `.task/os/make-apply-patch-the-only-patch-tool/workpad.md`
- 2026-06-14 06:45:38 write: `packages/workspace/tests/fs-apply-patch.test.ts`
- 2026-06-14 06:45:38 fs.write: `packages/workspace/tests/fs-apply-patch.test.ts`
- 2026-06-14 06:48:32 fs.write: `.task/os/make-apply-patch-the-only-patch-tool/apply_patch_only_edit.py`
- 2026-06-14 06:57:45 fs.write: `.task/os/make-apply-patch-the-only-patch-tool/remove_os_schema_copy.py`
- 2026-06-14 07:13:59 fs.write: `.task/os/make-apply-patch-the-only-patch-tool/run_focus.sh`
- 2026-06-14 17:29:14 fs.write: `.task/os/make-apply-patch-the-only-patch-tool/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-14 06:45:50 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`: failed exit 1 trace: `trc_ff0ad56dee49`
  - output: rc/old.txt'[39m [36m [2m❯[22m packages/workspace/tests/fs-apply-patch.test.ts:[2m274:10[22m[39m [90m272| [39m [90m273| [39m [34mexpect[39m(result[33m.[39mstatus)[33m.[39mnot[33m.[39m[34mtoBe[39m([34m0[39m)[33m;[39m [90m274| [39m expect(readFileSync(path.join(root, 'src', 'old.txt'), 'utf8')).toBe… [90m | [39m [31m^[39m [90m275| [39m expect(readFileSync(path.join(root, 'blocked', 'new.txt'), 'utf8')).… [90m276| [39m})[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯[22m[39m error: script "task:exec" exited with code 1

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/server_call_test.py`
- `packages/os/tests/workspace-hostname-edge-router.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/server.py`
- `packages/workspace/tests/context-trace.test.js`
- `packages/workspace/tests/server_call_test.py`
- `packages/workspace/tests/task-workpad.test.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: validation evidence

- TBD
- 2026-06-14 06:50:46 `checkFiles`: passed — OK
- 2026-06-14 07:51:40 `review.run`: passed — OK
- 2026-06-14 17:28:51 `verify`: passed — OK

## workspace-owned: TDD green evidence

- 2026-06-14 07:02:11 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`: failed exit 1 trace: `trc_ee50fcfc4cb6`
  - output: tain[39m([32m'workspace.fs.patch'[39m)[33m;[39m [90m 74| [39m [34mexpect[39m(generatedTools)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'| null>>'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 75| [39m [34mexpect[39m(workspaceScripts)[33m.[39m[34mtoContain[39m([32m'**apply_patch**'[39m)[33m;[39m [90m 76| [39m [34mexpect[39m(workspaceScripts)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'**patch**'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1
- 2026-06-14 07:12:56 `bash -lc FILE=$(python3 -c "from pathlib import Path; print(next(Path('packages/workspace/tests').glob('fs-apply-*test.ts')))" ); bun x vitest run "$FILE"`: failed exit 1 trace: `trc_b8f8856534cd`
  - output: tain[39m([32m'workspace.fs.patch'[39m)[33m;[39m [90m 74| [39m [34mexpect[39m(generatedTools)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'| null>>'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 75| [39m [34mexpect[39m(workspaceScripts)[33m.[39m[34mtoContain[39m([32m'**apply_patch**'[39m)[33m;[39m [90m 76| [39m [34mexpect[39m(workspaceScripts)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'**patch**'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1
- 2026-06-14 07:13:59 write: `.task/os/make-apply-patch-the-only-patch-tool/run_focus.sh`
- 2026-06-14 07:14:09 `bash .task/os/make-apply-patch-the-only-patch-tool/run_focus.sh`: failed exit 1 trace: `trc_79c23abaa868`
  - output: tain[39m([32m'workspace.fs.patch'[39m)[33m;[39m [90m 74| [39m [34mexpect[39m(generatedTools)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'| null>>'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 75| [39m [34mexpect[39m(workspaceScripts)[33m.[39m[34mtoContain[39m([32m'**apply_patch**'[39m)[33m;[39m [90m 76| [39m [34mexpect[39m(workspaceScripts)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'**patch**'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1
- 2026-06-14 07:14:54 `bash -lc bash .task/os/make-*/run_focus.sh`: failed exit 1 trace: `trc_799b5f5b8f03`
  - output: tain[39m([32m'workspace.fs.patch'[39m)[33m;[39m [90m 74| [39m [34mexpect[39m(generatedTools)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'| null>>'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 75| [39m [34mexpect[39m(workspaceScripts)[33m.[39m[34mtoContain[39m([32m'**apply_patch**'[39m)[33m;[39m [90m 76| [39m [34mexpect[39m(workspaceScripts)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'**patch**'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1
- 2026-06-14 07:20:39 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`: failed exit 1 trace: `trc_e2f3bbd55397`
  - output: tain[39m([32m'workspace.fs.patch'[39m)[33m;[39m [90m 74| [39m [34mexpect[39m(generatedTools)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'| null>>'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 75| [39m [34mexpect[39m(workspaceScripts)[33m.[39m[34mtoContain[39m([32m'**apply_patch**'[39m)[33m;[39m [90m 76| [39m [34mexpect[39m(workspaceScripts)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'**patch**'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1

## workspace-owned: test selection

- changed files: `.task/os/make-apply-patch-the-only-patch-tool/current.json`, `.task/os/make-apply-patch-the-only-patch-tool/evidence-log.json`, `.task/os/make-apply-patch-the-only-patch-tool/read-log.json`, `.task/os/make-apply-patch-the-only-patch-tool/session.json`, `.task/os/make-apply-patch-the-only-patch-tool/workpad.md`, `.task/tasks/os/make-apply-patch-the-only-patch-tool.json`, `packages/consuelo-docs/l/ar/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ar/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ar/os/concepts/portal.mdx`, `packages/consuelo-docs/l/ar/os/glossary.mdx`, `packages/consuelo-docs/l/ar/os/how-it-works.mdx`, `packages/consuelo-docs/l/ar/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/ar/os/skills/sites.mdx`, `packages/consuelo-docs/l/ar/os/skills/task.mdx`, `packages/consuelo-docs/l/ar/os/skills/teach.mdx`, `packages/consuelo-docs/l/ar/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/ar/os/tools/scripts.mdx`, `packages/consuelo-docs/l/ar/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/cs/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/cs/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/cs/os/concepts/portal.mdx`, `packages/consuelo-docs/l/cs/os/glossary.mdx`, `packages/consuelo-docs/l/cs/os/how-it-works.mdx`, `packages/consuelo-docs/l/cs/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/cs/os/skills/sites.mdx`, `packages/consuelo-docs/l/cs/os/skills/task.mdx`, `packages/consuelo-docs/l/cs/os/skills/teach.mdx`, `packages/consuelo-docs/l/cs/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/cs/os/tools/scripts.mdx`, `packages/consuelo-docs/l/cs/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/de/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/de/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/de/os/concepts/portal.mdx`, `packages/consuelo-docs/l/de/os/glossary.mdx`, `packages/consuelo-docs/l/de/os/how-it-works.mdx`, `packages/consuelo-docs/l/de/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/de/os/skills/sites.mdx`, `packages/consuelo-docs/l/de/os/skills/task.mdx`, `packages/consuelo-docs/l/de/os/skills/teach.mdx`, `packages/consuelo-docs/l/de/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/de/os/tools/scripts.mdx`, `packages/consuelo-docs/l/de/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/es/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/es/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/es/os/concepts/portal.mdx`, `packages/consuelo-docs/l/es/os/glossary.mdx`, `packages/consuelo-docs/l/es/os/how-it-works.mdx`, `packages/consuelo-docs/l/es/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/es/os/skills/sites.mdx`, `packages/consuelo-docs/l/es/os/skills/task.mdx`, `packages/consuelo-docs/l/es/os/skills/teach.mdx`, `packages/consuelo-docs/l/es/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/es/os/tools/scripts.mdx`, `packages/consuelo-docs/l/es/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/fr/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/fr/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/fr/os/concepts/portal.mdx`, `packages/consuelo-docs/l/fr/os/glossary.mdx`, `packages/consuelo-docs/l/fr/os/how-it-works.mdx`, `packages/consuelo-docs/l/fr/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/fr/os/skills/sites.mdx`, `packages/consuelo-docs/l/fr/os/skills/task.mdx`, `packages/consuelo-docs/l/fr/os/skills/teach.mdx`, `packages/consuelo-docs/l/fr/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/fr/os/tools/scripts.mdx`, `packages/consuelo-docs/l/fr/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/it/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/it/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/it/os/concepts/portal.mdx`, `packages/consuelo-docs/l/it/os/glossary.mdx`, `packages/consuelo-docs/l/it/os/how-it-works.mdx`, `packages/consuelo-docs/l/it/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/it/os/skills/sites.mdx`, `packages/consuelo-docs/l/it/os/skills/task.mdx`, `packages/consuelo-docs/l/it/os/skills/teach.mdx`, `packages/consuelo-docs/l/it/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/it/os/tools/scripts.mdx`, `packages/consuelo-docs/l/it/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ja/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ja/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ja/os/concepts/portal.mdx`, `packages/consuelo-docs/l/ja/os/glossary.mdx`, `packages/consuelo-docs/l/ja/os/how-it-works.mdx`, `packages/consuelo-docs/l/ja/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/ja/os/skills/sites.mdx`, `packages/consuelo-docs/l/ja/os/skills/task.mdx`, `packages/consuelo-docs/l/ja/os/skills/teach.mdx`, `packages/consuelo-docs/l/ja/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/ja/os/tools/scripts.mdx`, `packages/consuelo-docs/l/ja/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ko/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ko/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ko/os/concepts/portal.mdx`, `packages/consuelo-docs/l/ko/os/glossary.mdx`, `packages/consuelo-docs/l/ko/os/how-it-works.mdx`, `packages/consuelo-docs/l/ko/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/ko/os/skills/sites.mdx`, `packages/consuelo-docs/l/ko/os/skills/task.mdx`, `packages/consuelo-docs/l/ko/os/skills/teach.mdx`, `packages/consuelo-docs/l/ko/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/ko/os/tools/scripts.mdx`, `packages/consuelo-docs/l/ko/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/pt/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/pt/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/pt/os/concepts/portal.mdx`, `packages/consuelo-docs/l/pt/os/glossary.mdx`, `packages/consuelo-docs/l/pt/os/how-it-works.mdx`, `packages/consuelo-docs/l/pt/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/pt/os/skills/sites.mdx`, `packages/consuelo-docs/l/pt/os/skills/task.mdx`, `packages/consuelo-docs/l/pt/os/skills/teach.mdx`, `packages/consuelo-docs/l/pt/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/pt/os/tools/scripts.mdx`, `packages/consuelo-docs/l/pt/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ro/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ro/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ro/os/concepts/portal.mdx`, `packages/consuelo-docs/l/ro/os/glossary.mdx`, `packages/consuelo-docs/l/ro/os/how-it-works.mdx`, `packages/consuelo-docs/l/ro/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/ro/os/skills/sites.mdx`, `packages/consuelo-docs/l/ro/os/skills/task.mdx`, `packages/consuelo-docs/l/ro/os/skills/teach.mdx`, `packages/consuelo-docs/l/ro/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/ro/os/tools/scripts.mdx`, `packages/consuelo-docs/l/ro/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/ru/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/ru/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/ru/os/concepts/portal.mdx`, `packages/consuelo-docs/l/ru/os/glossary.mdx`, `packages/consuelo-docs/l/ru/os/how-it-works.mdx`, `packages/consuelo-docs/l/ru/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/ru/os/skills/sites.mdx`, `packages/consuelo-docs/l/ru/os/skills/task.mdx`, `packages/consuelo-docs/l/ru/os/skills/teach.mdx`, `packages/consuelo-docs/l/ru/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/ru/os/tools/scripts.mdx`, `packages/consuelo-docs/l/ru/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/tr/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/tr/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/tr/os/concepts/portal.mdx`, `packages/consuelo-docs/l/tr/os/glossary.mdx`, `packages/consuelo-docs/l/tr/os/how-it-works.mdx`, `packages/consuelo-docs/l/tr/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/tr/os/skills/sites.mdx`, `packages/consuelo-docs/l/tr/os/skills/task.mdx`, `packages/consuelo-docs/l/tr/os/skills/teach.mdx`, `packages/consuelo-docs/l/tr/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/tr/os/tools/scripts.mdx`, `packages/consuelo-docs/l/tr/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/l/zh/os/agent-context/scripts.mdx`, `packages/consuelo-docs/l/zh/os/agent-context/tools.mdx`, `packages/consuelo-docs/l/zh/os/concepts/portal.mdx`, `packages/consuelo-docs/l/zh/os/glossary.mdx`, `packages/consuelo-docs/l/zh/os/how-it-works.mdx`, `packages/consuelo-docs/l/zh/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/l/zh/os/skills/sites.mdx`, `packages/consuelo-docs/l/zh/os/skills/task.mdx`, `packages/consuelo-docs/l/zh/os/skills/teach.mdx`, `packages/consuelo-docs/l/zh/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/l/zh/os/tools/scripts.mdx`, `packages/consuelo-docs/l/zh/os/tools/tool-manifest.mdx`, `packages/consuelo-docs/navigation/base-structure.json`, `packages/consuelo-docs/os/agent-context/scripts.mdx`, `packages/consuelo-docs/os/agent-context/tools.mdx`, `packages/consuelo-docs/os/skills/senior-engineer.mdx`, `packages/consuelo-docs/os/skills/sites.mdx`, `packages/consuelo-docs/os/skills/task.mdx`, `packages/consuelo-docs/os/skills/teach.mdx`, `packages/consuelo-docs/os/tools/filesystem-tools.mdx`, `packages/consuelo-docs/os/tools/scripts.mdx`, `packages/consuelo-docs/os/tools/tool-manifest.mdx`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/dev-steering.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/scripts/fs.js`, `packages/os/scripts/generate-docs.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/tools-search.ts`, `packages/os/skills/senior-engineer/SKILL.md`, `packages/os/skills/task/SKILL.md`, `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`, `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`, `packages/os/tests/server_call_test.py`, `packages/os/tests/workspace-hostname-edge-router.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/STEERING.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/fs.js`, `packages/workspace/scripts/generate-docs.ts`, `packages/workspace/scripts/lib/codemode/tools/index.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/server.py`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/context-trace.test.js`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/fs-apply-patch.test.ts`, `packages/workspace/tests/server_call_test.py`, `packages/workspace/tests/task-workpad.test.ts`, `packages/workspace/tests/tools-search-v2.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## final publish notes

- Acceptance criteria satisfied: `fs.apply_patch` is the canonical workspace/OS patch tool, `fs.patch` is removed from public/generated surfaces, and stale CLI `patch` use hard-fails without mutation.
- Static/generated docs were aligned, including Consuelo docs localized/generated OS pages.
- CodeRabbit/review issues resolved, including codemode nested tool error handling.
- Focused behavior validation completed earlier: apply-patch suite green, manifest/facade generation checks green, OS local stale-command smoke green, OS local apply-patch smoke green, Consuelo docs checks green.
- `review.run` equivalent command passed against `origin/stream/os` on 2026-06-14 after fixing the codemode catch typing issue.
- `verify` passed against `origin/stream/os` on 2026-06-14 and wrote `.task/os/make-apply-patch-the-only-patch-tool/verify.json` with `publishValid: true`.
- Tooling gap: the direct `review.run` workspace call was safety-blocked, so review was run as the smallest scoped fallback command inside the task worktree. Direct `verify`, `fs.read`, and later publish operations used task-scoped workspace calls.

- 2026-06-14 17:29:14 append: `.task/os/make-apply-patch-the-only-patch-tool/workpad.md`
