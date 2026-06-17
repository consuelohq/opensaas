# align apply_patch filesystem tool

branch: `task/os/align-apply-patch-filesystem-tool`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1034/align-apply-patch-filesystem-tool
github pr: https://github.com/consuelohq/opensaas/pull/1034
started: 2026-06-14

## acceptance criteria

- [x] Keep `fs.patch` as the line-range replacement primitive; do not collapse it into apply-patch semantics.
- [x] Rename the public apply-patch facade surface from camel-case `fs.applyPatch` to lowercase/snake `fs.apply_patch` while keeping the Bun subcommand `apply-patch`.
- [x] Preserve `patchText` for OpenCode/Codex-aligned inline payloads and `patchFile`/stdin for safe multiline file transport.
- [x] Add the `fs.apply_patch` tool to the OS core manifest so the OS surface matches workspace.
- [x] Update workspace and OS script/docs surfaces so agents know when to use `fs.patch` versus `fs.apply_patch`.
- [x] Add edge coverage for move/rename, dry-run, patch text transport, hunk mismatch, atomic failure, and exact public tool naming.
- [x] Run focused tests, generated docs/types, OS manifest generation/tests, review, and verify.

## test-first contract

Behavior under test:

- `fs.apply_patch` is the public manifest/facade tool name and generated docs/types surface; `fs.applyPatch` should not remain as the public tool spelling.
- The CLI still runs as a Bun script through `bun run fs -- apply-patch` and accepts `--patch-text`, `--patch-file`, or stdin.
- Patches are planned before writes, so a later failed operation does not partially mutate earlier files.
- Move/rename and dry-run behavior are covered.
- `packages/os/manifests/core.manifest.json` contains the same `fs.apply_patch` facade entry as the workspace manifest.

Expected red observed:

- Current stream had `fs.applyPatch` in the manifest/generated docs/types and no OS manifest entry for apply-patch.
- Existing implementation behavior already passed update/add/delete, `patchText`, move, dry-run, unsafe paths, and atomic failure tests.

## plan

1. Read the merged apply-patch implementation, the previous multiline `fs.patch` work, OpenCode docs, workspace docs, and OS manifest shape.
2. Add tests that fail on camel-case naming, missing OS manifest, dry-run/move/atomic behavior, and patchText transport gaps.
3. Rename the facade/tool docs to `fs.apply_patch`, keep CLI `apply-patch`, keep schema `FsApplyPatchInput`, and regenerate docs/types.
4. Add the OS manifest/docs coverage using the same contract.
5. Run focused tests and workspace validation, then publish.

## current status

- Implementation complete. Validation passed. Ready to publish.

## files changed

- `.task/os/align-apply-patch-filesystem-tool/workpad.md`
- `.task/tasks/os/align-apply-patch-filesystem-tool.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/SCRIPTS.md`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/fs-apply-patch.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: files changed

- `.task/os/align-apply-patch-filesystem-tool/workpad.md`
- `.task/tasks/os/align-apply-patch-filesystem-tool.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/SCRIPTS.md`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/fs-apply-patch.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-06-14 01:08 ET: started follow-up task from `stream/os` after PR #1031 had already merged into the stream.
- 2026-06-14 01:09 ET: confirmed #1031 added only workspace files, not OS manifest/docs.
- 2026-06-14 01:10 ET: recorded acceptance criteria and test-first contract before editing.
- 2026-06-14 01:13 ET: red test failed on public naming and OS exposure, as expected.
- 2026-06-14 01:17 ET: renamed workspace public surface to `fs.apply_patch` and added the same entry to OS dev manifest.
- 2026-06-14 01:18 ET: regenerated workspace docs/types and OS manifests.
- 2026-06-14 01:19 ET: updated workspace/OS script docs and steering guidance.
- 2026-06-14 01:21 ET: focused tests and post suites passed.
- 2026-06-14 01:26 ET: review and verify passed.
- 2026-06-14 05:27:15 fs.write: `.task/os/align-apply-patch-filesystem-tool/workpad.md`

## workspace-owned: validation evidence

- 2026-06-14 05:13:16 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`: failed exit 1 trace `trc_e49288a372d4`.
  - Expected red: missing `fs.apply_patch` in workspace and OS manifests.
- 2026-06-14 05:18:25 `bun run generate-types`: passed trace `trc_fd19705e8bb7`.
- 2026-06-14 05:18:33 `bun run generate-docs`: passed trace `trc_199cae18f7d2`.
- 2026-06-14 05:18:51 `cd packages/os && bun run generate-tool-manifest`: passed trace `trc_77320147a1c6`.
- 2026-06-14 05:21:39 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`: passed 7 tests trace `trc_8b5fecf66a57`.
- 2026-06-14 05:21:53 `bun x vitest run packages/os/tests/tool-manifest.test.ts packages/workspace/tests/facade/facade.test.ts`: passed 567 tests trace `trc_9989d616bc86`.
- 2026-06-14 05:25:01 `checkFiles`: failed because it attempted `node --check` on Markdown; replaced by targeted JSON and suite validation.
- 2026-06-14 05:25:46 JSON manifest parse check: passed trace `trc_e5e35868d8e5`.
- 2026-06-14 05:26:11 `review.run --mine --no-tests`: passed trace `trc_c7fa339d893a`.
- 2026-06-14 05:26:28 `verify --no-stamp`: passed trace `trc_c62828aed54c`.
- 2026-06-14 05:28:04 `verify`: passed — OK

## key decisions

- Keep both primitives: `fs.patch` for explicit line-range replacement, `fs.apply_patch` for marker/hunk patchsets with embedded paths.
- Align public naming with OpenCode/Codex expectations: `apply_patch`, not `applyPatch`; the Bun subcommand remains `apply-patch` because CLI subcommands are hyphenated.
- Treat multiline failures as transport issues solved by `patchFile`/stdin/content files, while anchored hunk semantics solve line drift and multi-file patch application.
- Avoid a broad parser/runtime refactor in this task because the existing implementation passed the new behavioral edge tests; extract it later only if the implementation grows.

## notes for ko

- The merged PR #1031 was directionally right but misnamed the public facade and missed OS exposure.
- The old `fs.patch` should stay. It is the safer direct line-range replacement primitive and has the multiline `contentFile` fix.
- `fs.apply_patch` is the new higher-level patchset primitive for OpenCode/Codex-style markers, multi-file patching, move/delete/add/update, and anchored hunks.

## improvements noticed

- The apply-patch parser currently lives inside `packages/workspace/scripts/fs.js`. A clean follow-up would extract parser/planner/runtime to `packages/workspace/scripts/lib/fs/apply-patch.js` after this naming/OS alignment lands.

## issues and recovery

- Initial focused red run used the wrong timeout unit and timed out at 120ms; reran with 120000ms and got the intended red result.
- Attempted multiline `fs.patch --content` against docs failed by design; this confirmed the multiline guard and was recovered with file-based/scripted editing.
- `checkFiles` tried to syntax-check Markdown with `node --check`; recovered with JSON parse validation and focused/registry/review/verify suites.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): align apply_patch filesystem tool" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-14 05:27:15 write: `.task/os/align-apply-patch-filesystem-tool/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/align-apply-patch-filesystem-tool/current.json`, `.task/os/align-apply-patch-filesystem-tool/evidence-log.json`, `.task/os/align-apply-patch-filesystem-tool/read-log.json`, `.task/os/align-apply-patch-filesystem-tool/session.json`, `.task/os/align-apply-patch-filesystem-tool/workpad.md`, `.task/tasks/os/align-apply-patch-filesystem-tool.json`, `packages/os/SCRIPTS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/STEERING.md`, `packages/workspace/TOOLS.md`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/fs-apply-patch.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
