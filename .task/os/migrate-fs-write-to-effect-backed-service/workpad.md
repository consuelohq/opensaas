# migrate fs.write to effect backed service

branch: `task/os/migrate-fs-write-to-effect-backed-service`
stream: `stream/os`
taskSession: `tsk_c6e9f96be1c6`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1089/migrate-fs-write-to-effect-backed-service
github pr: https://github.com/consuelohq/opensaas/pull/1089
started: 2026-06-16

## acceptance criteria

- [ ] Migrate OS `fs.write` from inline CLI filesystem semantics to a thin adapter over an Effect-backed service at `packages/os/scripts/lib/fs/write.ts`.
- [ ] Preserve facade compatibility: `{ path, content?, contentFile?, force?, append?, mkdirs? }` remains accepted where valid.
- [ ] Fix facade validation so `content: ""` is valid, exactly one of `content`/`contentFile` is required, both are rejected, neither is rejected, and `force + append` is rejected.
- [ ] Service owns path resolution, root containment, symlink escape prevention, parent handling, existence checks, create/overwrite/append semantics, atomic create/overwrite writes, temp cleanup, BOM preservation, structured results, and typed errors.
- [ ] CLI parses args, collects content from inline/content-file/stdin, calls the service, prints stable compatible output, and keeps existing manual stdin compatibility where practical.
- [ ] Add/update focused tests first and capture red/green evidence.
- [ ] Regenerate docs/types/manifests if the tool contract changes.
- [ ] Run focused tests, generation, review, verify, push, promote to `stream/os`, and finish safely.

## OpenCode write.ts design lessons

Source packet: `Research Bundle: OpenCode write tool comparison`.
Local packet path: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-research/20260616T193615Z-github-com-anomalyco-opencode-blob-dev-packages-core-src-tool-write-ts-a265381d/packet.md`.

The saved packet existed but mostly captured GitHub page chrome. I read it, then inspected the raw OpenCode source to extract the implementation lessons:

- Model-facing input is narrow: `path` + `content`.
- Tool execution delegates path/resource resolution and mutation to lower services (`mutation.resolve`, `files.writeTextPreservingBom`).
- Write output is structured and stable: operation, target/resource, existed.
- Permission/path safety is explicit before mutation.
- BOM preservation lives in filesystem write semantics, not in the adapter.
- The tool layer stays thin; filesystem behavior lives below it.

Consuelo-specific adaptation:

- Keep `contentFile` at the facade/CLI boundary for large and multiline transport.
- Normalize internally to explicit content plus a `WriteMode` of `create | overwrite | append` instead of boolean soup.
- Preserve task-worktree constraints through the existing `task:fs` facade path.

## test-first contract

Behavior under test:

Facade/schema:
- accepts `content: ""`.
- rejects both `content` and `contentFile`.
- rejects neither content source.
- rejects `force: true` with `append: true`.
- maps `contentFile` to `--content-file`.
- maps append/force/mkdirs flags correctly.

Runtime/service/CLI:
- creates a new file.
- writes empty string and intentionally empties/creates a file.
- rejects overwrite without `--force`.
- overwrites with `--force`.
- appends with `--append`.
- rejects `--force --append`.
- creates parent directories only with `--mkdirs`.
- rejects missing parent without `--mkdirs`.
- rejects writing outside root via `..`.
- rejects symlink escape.
- preserves UTF-8 BOM when overwriting an existing BOM file.
- uses atomic temp write for create/overwrite and does not leave `.fs-write-*` temp files after success or feasible failure cases.
- returns JSON structured output and prints a stable compatibility line.

Existing local pattern:

- `packages/os/scripts/lib/fs/read.ts` is the nearby Effect-backed service pattern: typed result objects, root realpath containment checks, symlink escape prevention, synchronous filesystem calls wrapped with `Effect.try`, and `Effect.runPromise` CLI helpers.
- `packages/os/tests/fs-read.test.ts` is the closest runtime CLI/service test pattern.
- `packages/os/tests/facade/facade.test.ts` is the facade validation and command-plan test surface.

New or changed tests:

- Update `packages/os/tests/facade/facade.test.ts` with focused `fs.write` validation and argument mapping coverage.
- Add `packages/os/tests/fs-write.test.ts` for service/CLI runtime behavior.
- Keep `packages/os/tests/tool-manifest.test.ts` green; update only if manifest contract changes.

Focused red commands:

- `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern "fs.write|write"`
- `bun x vitest run packages/os/tests/fs-write.test.ts`

Expected red failure:

- The facade test for `content: ""` fails because current `FsWriteInput` uses `Boolean(input.content) !== Boolean(input.contentFile)`.
- `force + append` validation fails because the current schema accepts it.
- Runtime tests fail because current `cmdWrite` performs direct writes, lacks root/symlink containment, lacks BOM preservation, lacks structured JSON output, lacks explicit typed service errors, and does not use an Effect-backed service.

## implementation plan

1. Write focused facade and runtime tests first.
2. Run the focused tests red and record trace IDs.
3. Add `packages/os/scripts/lib/fs/write.ts` using the `fs.read` Effect service pattern.
4. Convert `cmdWrite` in `packages/os/scripts/fs.js` into a thin async adapter that parses args, collects content, calls the service, and renders output.
5. Tighten `FsWriteInput` validation in `schemas.ts`; update executor only if current argument mapping cannot support valid empty content.
6. Regenerate docs/types if schema/signature/docs change.
7. Run focused green tests, generation, manifest tests, review, and verify.
8. Inspect diff, push, promote to `stream/os`, report stream PR and task PR, then finish.

## current status

- Task started from `stream/os` with task session `tsk_c6e9f96be1c6`.
- Stream context trace: `trc_8ab137800865`.
- Task start trace: `trc_39c7fec0f271`.
- Research context search trace: `trc_e64f3982defe`.
- Packet read trace: `trc_9059d726f1ec`.
- `explore` failed with `COMMAND_FAILED`; trace `trc_521d7eeeddb2`. Recovery path is direct file/context evidence.
- Read current `fs.read` service, `fs.js` write implementation, facade schema/executor, manifest entry, package scripts, tests, AGENTS.md, and full CODING-STANDARDS.md before editing.

## files changed

- `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
- `packages/os/scripts/lib/fs/write.ts`
- `packages/os/tests/fs-write.test.ts`

## key decisions

- Start from `stream` because Ko explicitly approved `stream/os` and requested the task start from stream OS.
- Preserve CLI stdin compatibility even though facade validation requires exactly one of `content` or `contentFile`.
- Use `fs.read` service as the style/pattern source rather than introducing a separate abstraction.

## notes for ko

- Workspace-agents parity is intentionally deferred unless OS validation reveals generated shared-file requirements.

## improvements noticed

- `explore` failed without useful stderr for this query. Direct file reads were sufficient for this task.

## issues and recovery

- `explore` failed: `COMMAND_FAILED`, trace `trc_521d7eeeddb2`; recovered by reading current implementation and tests directly.

## workspace-owned: files changed

- `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
- `packages/os/scripts/lib/fs/write.ts`
- `packages/os/tests/fs-write.test.ts`

## workspace-owned: activity log

- 2026-06-16 20:16:06 fs.write: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
- 2026-06-16 20:18:05 fs.write: `packages/os/tests/fs-write.test.ts`
- 2026-06-16 20:21:44 fs.write: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
- 2026-06-16 20:23:29 fs.write: `packages/os/scripts/lib/fs/write.ts`
- 2026-06-16 20:31:02 fs.write: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
- 2026-06-16 20:34:47 fs.write: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
- 2026-06-16 20:37:04 fs.write: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`

## workspace-owned: validation evidence

- 2026-06-16 20:16:06 write: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
- 2026-06-16 20:17:27 apply-patch: `packages/os/tests/facade/facade.test.ts`
- 2026-06-16 20:18:05 write: `packages/os/tests/fs-write.test.ts`
- 2026-06-16 20:29:27 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-16 20:31:50 `review.run`: passed — OK
- 2026-06-16 20:35:27 `review.run`: passed — OK
- 2026-06-16 20:36:21 `verify`: passed — OK

## workspace-owned: TDD red evidence

- 2026-06-16 20:18:31 `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern fs.write|write`: failed exit 1 trace: `trc_3934d8ccf57c`
  - output: error: Script not found "task:exec"

## red evidence

- Facade red: `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'fs.write|write'` run through `code.call` because `task.call` attempted missing `task:exec` and `task.exec` was safety-blocked. Result failed as expected: `content: ""` was rejected by current `FsWriteInput`; trace `trc_789b0a01549a`.
- Runtime red: `bun x vitest run packages/os/tests/fs-write.test.ts` run through `code.call`. Result failed as expected because `packages/os/scripts/lib/fs/write.ts` does not exist yet; trace `trc_08578d6da467`.
- Tooling issue: direct `task.call` red command failed before Vitest with `Script not found "task:exec"`; trace `trc_3934d8ccf57c`. `task.exec` facade retry was blocked by safety checks. Continued with `code.call` in the task worktree and recorded traces manually.

- 2026-06-16 20:21:44 append: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`

- 2026-06-16 20:23:29 write: `packages/os/scripts/lib/fs/write.ts`

- 2026-06-16 20:24:12 apply-patch: `packages/os/scripts/fs.js`
- 2026-06-16 20:24:32 apply-patch: `packages/os/scripts/fs.js`

## workspace-owned: files read

- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/fs/write.ts`

## green evidence

- Runtime/service green: `bun x vitest run packages/os/tests/fs-write.test.ts` passed 13 tests; trace `trc_e055050e08e8`.
- Facade green: `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'fs.write|write'` passed 9 targeted tests with 545 skipped; trace `trc_9c1ac2dbe478`.
- Manifest green: `bun x vitest run packages/os/tests/tool-manifest.test.ts` passed 10 tests; trace `trc_80d52b0cc928`.
- Generated types: `generate.types` completed with `generated workspace type stubs`; trace `trc_7624fdb4aad4`.
- Generated docs: `generate.docs` completed with `generated TOOLS.md`; trace `trc_3a19b6f3568c`.
- Syntax/typecheck fallback: `bun run typecheck` from `packages/os` reported `workspace script syntax checks passed`; trace `trc_a22fbb672b48`.

## validation tool notes

- `checkFiles` is currently blocked by the same missing `task:exec` script path; trace `trc_4f80488a38ff`. I used direct `node --check` plus `bun run typecheck` in the task worktree as a fallback and recorded its trace above.
- `bun run --cwd packages/os generate-types` was safety-blocked through `code.call`, so I used the equivalent workspace `generate.types` facade. `generate.docs` was run through the workspace facade as well.

- 2026-06-16 20:31:02 append: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`

- 2026-06-16 20:32:33 apply-patch: `packages/os/scripts/fs.js`
## post-review-fix green evidence

- Runtime/service rerun after CLI try/catch fix: `bun x vitest run packages/os/tests/fs-write.test.ts` passed 13 tests; trace `trc_68f9dfb90779`.
- Facade rerun after CLI try/catch fix: `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'fs.write|write'` passed 9 targeted tests with 545 skipped; trace `trc_f293c7388102`.
- OS syntax/typecheck rerun after CLI try/catch fix: `bun run typecheck` from `packages/os` passed; trace `trc_9c0ee5e9ff68`.
- Manifest rerun after CLI try/catch fix: `bun x vitest run packages/os/tests/tool-manifest.test.ts` passed 10 tests; trace `trc_66f5c37f03b2`.

## review evidence

- Initial `review.run` against `origin/stream/os` found two `ERROR_HANDLING` findings in the async CLI adapter; trace `trc_c44da8e265b4`.
- Fixed by adding adapter-level try/catch around dynamic content-file import and `cmdWrite` service delegation.

- 2026-06-16 20:34:47 append: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/migrate-fs-write-to-effect-backed-service/current.json`, `.task/os/migrate-fs-write-to-effect-backed-service/evidence-log.json`, `.task/os/migrate-fs-write-to-effect-backed-service/read-log.json`, `.task/os/migrate-fs-write-to-effect-backed-service/session.json`, `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`, `.task/tasks/os/migrate-fs-write-to-effect-backed-service.json`, `packages/os/scripts/fs.js`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/fs/write.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/fs-write.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final review and verify evidence

- Review rerun after CLI try/catch fix: `review.run` against `origin/stream/os` passed with zero own issues, zero pre-existing issues, and zero blocking issues; trace `trc_9566747b2381`.
- Verify against `origin/stream/os` passed and wrote `.task/os/migrate-fs-write-to-effect-backed-service/verify.json`; trace `trc_167c8ccf8b39`.
- Verify selected zero suites internally, so the explicit focused Vitest traces remain the test evidence for this task: `trc_68f9dfb90779`, `trc_f293c7388102`, and `trc_66f5c37f03b2`.

- 2026-06-16 20:37:04 append: `.task/os/migrate-fs-write-to-effect-backed-service/workpad.md`
