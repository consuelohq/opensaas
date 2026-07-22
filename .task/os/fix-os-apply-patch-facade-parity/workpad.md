# fix os apply patch facade parity

branch: `task/os/fix-os-apply-patch-facade-parity`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1040/fix-os-apply-patch-facade-parity
github pr: https://github.com/consuelohq/opensaas/pull/1040
started: 2026-06-14

## acceptance criteria

- [ ] `fs.apply_patch` is the only patch tool exposed on both Workspace and OS public/generated tool surfaces.
- [ ] OS facade schema registry defines and registers `FsApplyPatchInput`.
- [ ] OS type signatures include `FsApplyPatchInput`.
- [ ] OS generated client/types expose `fs.apply_patch`.
- [ ] OS manifests expose `fs.apply_patch` and do not expose `fs.patch`.
- [ ] Stale OS CLI command `patch` still hard-fails loudly and points to `apply-patch`.
- [ ] OS `apply-patch` accepts patch syntax through `patchText`, `patchFile`, and CLI/stdin transport where supported.
- [ ] OS task-worktree path safety remains enforced.
- [ ] OS tests cover schema validation, generated surfaces, server/codemode call path, and stale `fs.patch` absence.
- [ ] Workspace side remains stable; no unnecessary Workspace churn.
- [ ] CodeRabbit comments on PR `#1020` are addressed or explicitly proven stale/out-of-scope.
- [ ] Workpad records final files changed, validation, and tooling gaps.

## test-first contract

Behavior under test:

- OS manifest surfaces include `fs.apply_patch` and exclude `fs.patch`.
- The `fs.apply_patch` manifest entry references `FsApplyPatchInput`.
- OS schema registry exposes `FsApplyPatchInput`.
- `FsApplyPatchInput` accepts exactly one of `patchText` or `patchFile`.
- OS generated type/client surfaces include `fs.apply_patch` and omit `fs.patch`.
- A facade call to `fs.apply_patch` should get past schema lookup/validation rather than returning `missing input schema: FsApplyPatchInput`.

Expected red signal:

- Focused OS tests should fail on current stream because `FsApplyPatchInput` is absent from OS schema registry and generated OS client/types are not aligned.

Focused command:

- TBD after reading existing OS test command patterns.

## plan

1. Read OS schema, manifest, generated type/client, facade executor, codemode, server, and focused tests.
2. Add/adjust OS tests first for manifest/schema/generated/facade parity.
3. Run the focused test red.
4. Implement the minimal OS schema/generated surface fix.
5. Regenerate OS manifest/docs/types.
6. Run focused green, generation checks, review, verify, then push/promote into stream PR #1020.

## current status

- Fresh task created from `stream/os` with task session `tsk_726dc49b8659`.
- Initial PR review comments inspected for PR #1020; apply-patch comments are either previously addressed or need current-file verification.
- Workpad initialized before production edits.

## files changed

- `.task/os/fix-os-apply-patch-facade-parity/workpad.md`

## workspace-owned: files changed

- `.task/os/fix-os-apply-patch-facade-parity/workpad.md`

## workspace-owned: activity log

- 2026-06-14 19:13:38 fs.write: `.task/os/fix-os-apply-patch-facade-parity/workpad.md`
- 2026-06-14 20:42:11 fs.write: `.task/os/fix-os-apply-patch-facade-parity/workpad.md`
- 2026-06-14 22:27:31 fs.write: `.task/os/fix-os-apply-patch-facade-parity/workpad.md`
- 2026-06-14 fs.write: initialized workpad acceptance criteria and test-first contract.
- 2026-06-14 task.start: created task branch and PR #1040 from `stream/os`.

## workspace-owned: validation evidence

- 2026-06-14 22:26:15 `checkFiles`: passed — OK
- 2026-06-14 22:27:06 `review.run`: passed — OK
- 2026-06-14 22:27:19 `verify`: passed — OK

## key decisions

- Keep this correction OS-focused unless current-file evidence proves a shared generator/source-of-truth fix is required.
- Treat HTTP method `patch` support as unrelated to the removed filesystem tool `fs.patch`.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The broad explore query containing the exact apply-patch terms was blocked by tool filtering; used narrower exploration and direct file reads instead.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): align apply patch facade parity" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-14 19:13:38 write: `.task/os/fix-os-apply-patch-facade-parity/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`

## workspace-owned: TDD red evidence

  - output: [39m [90m211| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'apply_patch'[39m)[33m;[39m [90m | [39m [31m^[39m [90m212| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'patchText?: string'[39m)[33m;[39m [90m213| [39m [34mexpect[39m(generatedWorkspace)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'fs.patch'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 19:44:06 `bun --cwd packages/os test tests/tool-manifest.test.ts`: failed exit 1 trace: `trc_b005bdf666ce`
  - output: [39m [90m211| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'apply_patch'[39m)[33m;[39m [90m | [39m [31m^[39m [90m212| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'patchText?: string'[39m)[33m;[39m [90m213| [39m [34mexpect[39m(generatedWorkspace)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'fs.patch'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 19:47:11 `bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch`: failed exit 1 trace: `trc_71f07466f920`
  - output: [39m [90m211| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'apply_patch'[39m)[33m;[39m [90m | [39m [31m^[39m [90m212| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'patchText?: string'[39m)[33m;[39m [90m213| [39m [34mexpect[39m(generatedWorkspace)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'fs.patch'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 19:48:13 `bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch`: failed exit 1 trace: `trc_d76d4937e2a5`
  - output: [39m [90m211| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'apply_patch'[39m)[33m;[39m [90m | [39m [31m^[39m [90m212| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'patchText?: string'[39m)[33m;[39m [90m213| [39m [34mexpect[39m(generatedWorkspace)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'fs.patch'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 19:51:06 `bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch`: failed exit 1 trace: `trc_b5cf7de856a6`
  - output: [39m [90m211| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'apply_patch'[39m)[33m;[39m [90m | [39m [31m^[39m [90m212| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'patchText?: string'[39m)[33m;[39m [90m213| [39m [34mexpect[39m(generatedWorkspace)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'fs.patch'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 20:38:40 `bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch`: failed exit 1 trace: `trc_3a7f132949de`
  - output: [39m [90m211| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'apply_patch'[39m)[33m;[39m [90m | [39m [31m^[39m [90m212| [39m [34mexpect[39m(generatedWorkspace)[33m.[39m[34mtoContain[39m([32m'patchText?: string'[39m)[33m;[39m [90m213| [39m [34mexpect[39m(generatedWorkspace)[33m.[39mnot[33m.[39m[34mtoContain[39m([32m'fs.patch'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## red test evidence 2026-06-14

Focused red command:

`bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch`

Result:

- Exit 1 via task.call with `tddPhase: red`.
- 3 targeted tests ran: 1 passed, 2 failed.
- Red failures prove the OS gap:
  - `getInputSchema('FsApplyPatchInput')` returned `null`.
  - `packages/os/src/generated/workspace.d.ts` did not contain `apply_patch` / `patchText`.

Implementation target:

- Add and register `FsApplyPatchInput` in `packages/os/scripts/lib/facade/schemas.ts`.
- Add the OS schema type signature.
- Regenerate OS types and docs/manifests so generated TypeScript surfaces expose `fs.apply_patch`.

- 2026-06-14 20:42:11 append: `.task/os/fix-os-apply-patch-facade-parity/workpad.md`

## workspace-owned: TDD green evidence

- 2026-06-14 21:02:06 `bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch`: passed exit 0 trace: `trc_0d9cbf9bee00`
  - output: → tmux: opensaas-os-fix-os-apply-patch-facade-parity-726dc49b $ vitest run tests/tool-manifest.test.ts -t fs.apply_patch
- 2026-06-14 21:14:20 `bun --cwd packages/os test tests/facade/facade.test.ts -t fs.apply_patch`: failed exit 1 trace: `trc_9853a8ddbfde`
  - output: cessfulRunner[39m()[33m,[39m plans))[33m;[39m [90m163| [39m [90m164| [39m [34mexpect[39m(result[33m.[39mok)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m [90m | [39m [31m^[39m [90m165| [39m [34mexpect[39m(result[33m.[39mcode)[33m.[39m[34mtoBe[39m([32m'OK'[39m)[33m;[39m [90m166| [39m [34mexpect[39m(plans)[33m.[39m[34mtoHaveLength[39m([34m1[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 21:19:51 `bun --cwd packages/os test tests/facade/facade.test.ts -t fs.apply_patch`: passed exit 0 trace: `trc_277e34e72180`
  - output: gents/test","command":"workspace fs.apply_patch '{\"taskSession\":\"tsk_apply_patch_test\",\"dryRun\":true,\"patchText\":\"*** Begin Patch\\n*** End Patch\",\"branch\":\"task/workspace-agents/test\",\"taskWorktree\":\"/[REDACTED_SECRET]\"}'","implementationCommand":"bun run task:fs -- --branch task/workspace-agents/test apply-patch --patch-text *** Begin Patch\n*** End Patch --dry-run","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-14T21:19:51.074Z"}
- 2026-06-14 21:23:18 `bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch`: passed exit 0 trace: `trc_b29cef836ef3`
  - output: → tmux: opensaas-os-fix-os-apply-patch-facade-parity-726dc49b $ vitest run tests/tool-manifest.test.ts -t fs.apply_patch
- 2026-06-14 22:26:28 `bash -lc cd packages/os && bun run test tests/tool-manifest.test.ts -t fs.apply_patch && bun run test tests/facade/facade.test.ts -t fs.apply_patch`: passed exit 0 trace: `trc_3b3333353092`
  - output: gents/test","command":"workspace fs.apply_patch '{\"taskSession\":\"tsk_apply_patch_test\",\"dryRun\":true,\"patchText\":\"*** Begin Patch\\n*** End Patch\",\"branch\":\"task/workspace-agents/test\",\"taskWorktree\":\"/[REDACTED_SECRET]\"}'","implementationCommand":"bun run task:fs -- --branch task/workspace-agents/test apply-patch --patch-text *** Begin Patch\n*** End Patch --dry-run","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-14T22:26:28.232Z"}

## workspace-owned: test selection

- changed files: `.task/os/fix-os-apply-patch-facade-parity/current.json`, `.task/os/fix-os-apply-patch-facade-parity/evidence-log.json`, `.task/os/fix-os-apply-patch-facade-parity/read-log.json`, `.task/os/fix-os-apply-patch-facade-parity/session.json`, `.task/os/fix-os-apply-patch-facade-parity/workpad.md`, `.task/tasks/os/fix-os-apply-patch-facade-parity.json`, `packages/os/TOOLS.md`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/tool-manifest.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation and publish notes 2026-06-14

Files changed:

- `packages/os/scripts/lib/facade/schemas.ts`
  - Added `FsApplyPatchInput`.
  - Registered it in `schemaRegistry`.
  - Added the `schemaTypeSignatures` entry.
  - Preserved `FsHttpInput.method` HTTP `patch` support; this is unrelated to file patch tooling.
- `packages/os/src/generated/workspace.d.ts`
  - Regenerated OS TypeScript surface; `fs.apply_patch` is now exposed with `patchText` / `patchFile` input.
- `packages/os/TOOLS.md`
  - Regenerated docs for the corrected OS tool signature.
- `packages/os/tests/tool-manifest.test.ts`
  - Added manifest/schema/generated-surface parity tests for `fs.apply_patch` and `fs.patch` absence.
- `packages/os/tests/facade/facade.test.ts`
  - Added runtime-facing facade proof that `fs.apply_patch` validates, resolves task-session metadata, builds `apply-patch`, passes `--patch-text`, and passes native `--dry-run`.

Generation:

- `cd packages/os && bun run generate-types` -> passed; generated workspace type stubs.
- `cd packages/os && bun run generate-tool-manifest && bun run generate-docs` -> passed; regenerated manifests/docs.

Validation:

- Red: `bun --cwd packages/os test tests/tool-manifest.test.ts -t fs.apply_patch` failed before implementation because `FsApplyPatchInput` was missing and generated workspace types lacked `apply_patch`.
- Green: `cd packages/os && bun run test tests/tool-manifest.test.ts -t fs.apply_patch && bun run test tests/facade/facade.test.ts -t fs.apply_patch` -> passed.
- `checkFiles` on changed TS/type files -> passed.
- `cd packages/os && bun run typecheck` -> passed (`workspace script syntax checks passed`).
- `review.run --base origin/stream/os --noTests` -> passed with 0 issues.
- `verify --base origin/stream/os` -> passed and wrote publish-valid stamp. Verify auto-selected 0 suites, so explicit focused test evidence above is the behavior proof.

Notes:

- Typed `status` / `git.diff` showed root-main metadata despite task context, so task-scoped `task.call git status --short` and validation commands were used for local task-worktree truth.
- `git status --short` before publish showed only OS/tooling files plus scoped task metadata changed.

- 2026-06-14 22:27:31 append: `.task/os/fix-os-apply-patch-facade-parity/workpad.md`
