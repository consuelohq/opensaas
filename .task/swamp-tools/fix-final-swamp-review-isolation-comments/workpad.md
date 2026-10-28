# fix final swamp review isolation comments

branch: `task/swamp-tools/fix-final-swamp-review-isolation-comments`
stream: `stream/swamp-tools`
pr: https://github.com/consuelohq/opensaas/pull/2539
started: 2026-09-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(swamp-tools): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: runtime-provider execution honors resolved task/work-session isolation, facade-injected batch tracing metadata never leaks into strict provider schemas, and runtime tool scope resolution discovers from the same configured active workspace project as execution.
existing local pattern: `runtime-tool-providers-swamp.test.ts` exercises a real fake Swamp CLI; facade tests cover task-session normalization; `tool-scope-authorization.test.ts` covers runtime scope resolution; batch injects tracing metadata in its child envelope.
new or changed tests: add provider regression for `taskSession`/`taskWorktree` execution repo, batch `parentTraceId` stripping, and scope discovery when process cwd is the installed runtime but active workspace project points at a Swamp repo.
focused red command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts tests/tool-scope-authorization.test.ts`.
expected red failure: provider plan still uses discovery repo instead of task worktree, strict schemas reject batch `parentTraceId`, and scope lookup misses the active project when cwd is outside the Swamp repo.
no-test waiver: not applicable.

## Acceptance criteria

- Session-bound runtime providers execute against the resolved task/work-session project directory when that target is a Swamp repo, without falling back to the shared checkout.
- Internal facade/batch tracing metadata such as `parentTraceId` never becomes provider input.
- `resolveToolScope` uses the active configured workspace project fallback consistently with `executeTool`.
- Preserve all previously fixed review behavior and pass real Swamp compatibility smoke, strict review, canonical verify, then merge and Canary-release.

- 2026-09-22 20:56:55 append: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-22 20:56:55 fs.write: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`
- 2026-09-22 20:59:41 fs.write: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`
- 2026-09-22 21:00:21 fs.write: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`
- 2026-09-22 21:02:47 fs.write: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/workspace-project-cwd.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`
- `packages/os/tests/workspace-project-cwd.test.ts`

- 2026-09-22 20:59:02 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 20:59:02 apply-patch: `packages/os/tests/tool-scope-authorization.test.ts`
- 2026-09-22 20:59:20 apply-patch: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`

## workspace-owned: validation evidence

- 2026-09-22 20:59:25 `checkFiles`: passed — OK
- 2026-09-22 21:00:35 `review.run`: passed — OK
- 2026-09-22 21:01:40 `verify`: failed — COMMAND_FAILED
- 2026-09-22 21:02:28 `verify`: passed — OK

## Red/green evidence

- Focused red: `runtime-tool-providers-swamp` reproduced both new valid defects: batch `parentTraceId` caused strict-schema `VALIDATION_ERROR`, and scoped provider execution still used the discovery repo. Trace `trc_d22912e5980f`.
- The daemon active-project scope regression passed before production edits, proving the Codex scope comment is stale: `readRuntimeToolManifestEntries` already falls back through `resolveActiveWorkspaceProjectCwd()` after the caller/runtime cwd candidate.
- Production fixes: classify `parentTraceId` as facade-only runtime metadata; use resolved `taskWorktree` or `workSessionRoot` as Swamp execution `cwd` and `--repo-dir`, falling back to discovery repo only when no scoped directory exists.
- Focused green: 4 files / 743 tests passed (`runtime-tool-providers-swamp`, tool scope, tools.search v3, facade); trace `trc_65058942466e`.
- `checkFiles` passed production and changed tests; trace `trc_90a803d0fbfe`.

- 2026-09-22 20:59:41 append: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`

## Real-provider validation

- Checksum-verified current Swamp release `20260922.204047.0-sha.4957bcbd` passed the CI-owned compatibility harness after the isolation fixes; trace `trc_29f9341ac4a0`.
- Disposable downloaded binary/checksum removed again; cleanup trace `trc_8337fd436bd2`.

- 2026-09-22 21:00:21 append: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`

## Final verification

- Strict review: 0 blockers / 0 findings; trace `trc_f801b2f79938`.
- Final canonical verify: `passed: true`, `publishValid: true`; trace `trc_40184d0f9274`.
- One earlier verify attempt (`trc_32d57eab890d`) failed in the selected suite under load; the completed rerun on the identical head passed and produced the publish-valid stamp.

- 2026-09-22 21:02:47 append: `.task/swamp-tools/fix-final-swamp-review-isolation-comments/workpad.md`
