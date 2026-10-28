# Make work session startup intuitive

branch: `task/os/make-work-session-startup-intuitive`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2492
started: 2026-09-21

## acceptance criteria

- [x] `session.start({ kind: "work" })` can start an isolated ordinary-filesystem session without the caller inventing a pre-existing path.
- [x] Work-session `title` is accepted and can name the default workspace without colliding with task-session parsing.
- [x] An explicit safe path may be missing; startup creates it before persisting the session.
- [x] Explicit paths that are Consuelo-managed state, a managed repo/worktree, or a parent that would expose them remain denied.
- [x] Rejection messages tell the caller how to recover: choose a narrower ordinary path or omit `path` for the safe default.
- [x] Existing task-session startup semantics are unchanged.
- [x] Generated tool signatures/docs are refreshed and focused tests cover the new contract.

## plan

1. Use trace history plus current implementation/tests to pin the recurring startup failures.
2. Add red tests for optional work path/title, safe default path creation, missing explicit path creation, and protected-root recovery messaging.
3. Implement the narrow session-start/schema changes without weakening work-session filesystem containment.
4. Regenerate/audit workspace tool surfaces.
5. Run focused tests, review, verify, then promote the task into `stream/os`.

## Test-first contract

behavior under test:
- work sessions start with no path by creating an isolated default directory;
- optional work-session titles are accepted;
- missing explicit ordinary directories are created;
- protected/managed roots remain blocked with actionable recovery.

existing local pattern:
- `packages/os/scripts/session-start.ts` owns kind-specific CLI startup;
- `createWorkSession` persists metadata and enforces protected roots;
- `SessionStartInput` is the facade schema;
- `session-start-foundation.test.ts`, `work-session-fs.test.ts`, and `workflow-intent.test.ts` cover the session/facade contract.

new or changed tests:
- extend `packages/os/tests/session-start-foundation.test.ts` for work-session path resolution/creation and recovery errors;
- extend `packages/workspace/tests/workflow-intent.test.ts` for optional work `path` plus optional `title`.

focused red command:
- `bunx vitest run packages/os/tests/session-start-foundation.test.ts packages/workspace/tests/workflow-intent.test.ts`

expected red failure:
- the facade currently rejects work `title` / missing `path`;
- no default-path or safe missing-directory helper exists yet.

no-test waiver: not applicable.

## files changed

- Session startup/runtime: `packages/os/scripts/session-start.ts`, `packages/workspace/scripts/session-start.ts`
- Work-session safety: `packages/os/scripts/lib/work-session.ts`, `packages/os/scripts/lib/work-session-protection.ts`
- Facade contracts: both OS/workspace `scripts/lib/facade/schemas.ts`
- Tool metadata/docs/types: OS task-lifecycle schema + generated manifests/docs/types and workspace manifest/docs/types
- Tests/fixtures: session-start foundation, workflow intent, tool-manifest baseline/expectations

## key decisions

- Do not make broad roots such as the user home directory writable. Current code-call containment treats the session root as a write boundary, so allowing a parent of `.consuelo` or a managed repo would weaken the security model.
- Fix the UX by making `path` optional with a safe isolated default and by creating explicitly requested ordinary directories when they do not yet exist.
- Keep task-session behavior out of this change; trace history shows task startup has separate failure classes (for example missing streams and historical timeouts).
- Missing explicit paths are preflighted against protected roots before `mkdir`; this avoids a create-then-reject hole under `.consuelo` or managed worktrees.
- Automatic work roots live under `~/Library/Application Support/Consuelo Work Sessions/<title>-<id>` and newly created directories use mode `0700`.
- OS docs/types generation currently includes unrelated committed drift from other tool surfaces. I restored that unrelated output and retained only the `session.start` lines for this task; the canonical generated manifest remains deterministic and green.

## notes for ko

- Trace history shows repeated `session.start` failures across multiple days, not a one-off. The live reproduction was: work title rejected by schema -> home path rejected as too broad/protected -> invented safe path rejected because it did not exist.
- The general work-session fix should remove the first and third failure entirely and make the second one self-recovering/actionable without weakening protection.
- After this lands, the normal agent call can simply be `session.start({ kind: "work", title: "..." })`; no path discovery or pre-creation should be necessary.
- Focused/boundary suite is green: 6 files, 68 passed, 1 intentionally skipped. It covers no-path startup, title forwarding, missing-directory creation, protected-root denial, filesystem containment, and manifest drift.

## improvements noticed

- `session.start` trace history mixes task and work failures; a future observability slice by `input.kind` would make failure-rate tracking much clearer.
- The repo-wide `audit` gate currently reports substantial unrelated pre-existing scripts/docs/index drift. This task validated canonical tool-manifest determinism directly with `tool-package-layout.test.ts` instead of absorbing unrelated generated changes.

## errors i ran into

- An initial `fs.search` used an unescaped `(`; retried with the literal symbol name.
- `code.run` cannot currently invoke the `memory` tool even though direct facade calls can; used direct `memory trace` instead.
- Initial generated OS docs/types surfaced unrelated pre-existing generator drift; restored those two outputs to HEAD and applied only the intended `session.start` generated contract lines.
- Updating the canonical tool description intentionally invalidated the characterized tool baseline; refreshed the single `session.start` fixture entry, then the manifest/layout tests returned green.

## validation

- RED: focused session/workflow tests failed before implementation because work `title` / path omission were rejected and no safe default path creator existed.
- Static: `checkFiles` passed for all touched TypeScript source/test files.
- GREEN: `bunx vitest run packages/os/tests/session-start-foundation.test.ts packages/os/tests/work-session-fs.test.ts packages/os/tests/work-session-code-call.test.ts packages/os/tests/tool-manifest.test.ts packages/os/tests/tool-package-layout.test.ts packages/workspace/tests/workflow-intent.test.ts` — 68 passed, 1 skipped.
- Canonical manifest generator: 162 full tools, 15 core tools, 3 workflow bundles; tool-package drift test passed.
- Repo-wide audit remains red on unrelated pre-existing script/docs/index drift; no task-scoped regression was found.
- Full selected test matrix: passed all selected suites after fixing the CLI UUID binding and workspace compatibility expectations (`trc_8727c0379cc2`).
- Full publish gate: `verify` passed with `publishValid: true`, no review blockers, and no DB risks/findings (`trc_766c2ff3bccb`).
- Review noted one non-blocking public-docs opportunity for `packages/documentation/src/content/docs/reference/tools.mdx`; the task intentionally keeps scope on the internal OS/workspace contract.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): make work session startup intuitive" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-21 02:29:21 write: `.task/os/make-work-session-startup-intuitive/workpad.md`

## workspace-owned: files changed

- `packages/workspace/scripts/generate-docs.ts`

## workspace-owned: activity log

- 2026-09-21 02:29:21 fs.write: `.task/os/make-work-session-startup-intuitive/workpad.md`
- 2026-09-21 02:39:18 fs.write: `packages/workspace/scripts/generate-docs.ts`

## workspace-owned: files read

- `packages/os/TOOLS.md`
- `packages/os/package.json`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/task-lifecycle/handler.ts`
- `packages/os/tools/task-lifecycle/manifest.ts`
- `packages/os/tools/task-lifecycle/schema.ts`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/session-start.ts`
- `packages/workspace/tests/session-start-compatibility.test.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tests/workflow-intent.test.ts`

## workspace-owned: validation evidence

- 2026-09-21 02:32:45 `checkFiles`: passed — OK
- 2026-09-21 02:32:57 `audit`: failed — COMMAND_FAILED
- 2026-09-21 02:34:04 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-09-21 02:34:04 apply-patch: `packages/os/tests/session-start-foundation.test.ts`
- 2026-09-21 02:34:41 apply-patch: `packages/os/scripts/session-start.ts`
- 2026-09-21 02:34:41 apply-patch: `packages/workspace/scripts/session-start.ts`
- 2026-09-21 02:38:52 apply-patch: `packages/os/tools/task-lifecycle/schema.ts`
- 2026-09-21 02:38:52 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-09-21 02:38:52 apply-patch: `packages/os/scripts/session-start.ts`
- 2026-09-21 02:38:52 apply-patch: `packages/os/tests/session-start-foundation.test.ts`
- 2026-09-21 02:39:18 write: `packages/workspace/scripts/generate-docs.ts`
- 2026-09-21 02:39:33 `checkFiles`: passed — OK
- 2026-09-21 02:39:56 apply-patch: `packages/os/tests/fixtures/tool-package-baseline.json`
- 2026-09-21 02:40:50 apply-patch: `packages/os/TOOLS.md`
- 2026-09-21 02:40:50 apply-patch: `packages/os/src/generated/workspace.d.ts`
- 2026-09-21 02:41:20 apply-patch: `.task/os/make-work-session-startup-intuitive/workpad.md`
- 2026-09-21 02:42:01 `review.run`: passed — OK
- 2026-09-21 02:42:55 `verify`: failed — COMMAND_FAILED
- 2026-09-21 02:44:23 apply-patch: `packages/os/scripts/session-start.ts`
- 2026-09-21 02:44:23 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-09-21 02:44:23 apply-patch: `packages/workspace/tests/session-start-compatibility.test.ts`
- 2026-09-21 02:44:28 `checkFiles`: passed — OK
- 2026-09-21 02:45:17 apply-patch: `packages/os/scripts/session-start.ts`
- 2026-09-21 02:45:34 apply-patch: `packages/workspace/tests/session-start-compatibility.test.ts`
- 2026-09-21 02:47:36 `verify`: passed — OK
- 2026-09-21 02:47:45 apply-patch: `.task/os/make-work-session-startup-intuitive/workpad.md`
- 2026-09-21 02:48:27 `verify`: passed — OK
