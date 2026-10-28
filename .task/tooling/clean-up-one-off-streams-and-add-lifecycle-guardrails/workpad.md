# clean up one-off streams and add lifecycle guardrails

branch: `task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails`
stream: `stream/tooling`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1390/clean-up-one-off-streams-and-add-lifecycle-guardrails
github pr: https://github.com/consuelohq/opensaas/pull/1390
started: 2026-07-10

## acceptance criteria

- [x] Remove safe local `stream/*` refs that are fully backed by `origin`, have no unique local commits, and are not checked out in any worktree.
- [x] Preserve diverged or local-only streams and report why they were not removed.
- [x] Add `stream.cleanup` with preview-by-default and explicit apply behavior in workspace and OS.
- [x] Make `task.start` refuse to create a missing remote stream unless the caller explicitly passes `--create-stream`.
- [x] Keep existing remote streams and active task/PR history untouched.
- [x] Update typed manifests, generated docs/types, and operator guidance.
- [x] Prove classification, cleanup safety, explicit stream creation, workspace/OS parity, and real local cleanup.

## plan

1. Add failing lifecycle tests around cleanup classification and missing-stream creation policy.
2. Implement a shared stream lifecycle module and thin cleanup CLI in workspace and OS.
3. Wire `--create-stream` into `task.start` and keep existing streams backward compatible.
4. Add `stream.cleanup` to manifests, schemas, docs, generated clients, and package scripts.
5. Run the new cleanup in preview mode, inspect protected branches, then apply only safe local removals.
6. Run focused tests, generators, review, verify, publish, and promote to `stream/tooling`.

## test-first contract

- Behavior: a local stream with an origin counterpart, zero commits ahead, and no worktree is removable.
- Behavior: current, checked-out, diverged, ahead, or local-only streams are protected with explicit reasons.
- Behavior: cleanup previews by default and mutates only with `--apply`.
- Behavior: `task.start` reuses an existing remote stream, but a missing stream fails unless `--create-stream` is explicit.
- Existing pattern: pure helper modules tested directly plus CLI contract tests and byte-parity checks across workspace/OS.
- New tests: `packages/workspace/tests/stream-lifecycle.test.ts` and OS parity assertions.
- Focused red command: `bunx vitest run packages/workspace/tests/stream-lifecycle.test.ts`.
- Expected red failure: stream lifecycle module and cleanup CLI do not exist; task-start still silently creates missing streams.

## current status

- Local cleanup applied successfully: 19 redundant local stream refs removed; post-cleanup preview reports zero removable refs.
- Protected and preserved: `stream/security` has 1 unique local commit; `stream/os-reload-hotfix` and `stream/sites-promote-office` have no origin backup.
- Remote streams, task branches, workpads, and PR history were not deleted.
- `stream.cleanup` is implemented in workspace and OS, preview-first, typed, documented, and discoverable through `tools.search`.
- `task.start` now reuses existing streams but requires explicit `--create-stream` for a missing remote stream.
- Focused validation green: lifecycle 11/11, workspace tools.search 10/10, OS tools.search 3/3, workspace stream facade 23/23, OS stream facade 23/23, workspace manifest 6/6, OS manifest 15/15.
- Workspace script audit recognizes `stream:cleanup`; its only failures are unrelated pre-existing undocumented aliases: `docs:deploy`, `media:svg`, and `web:deploy`.
- `review.run --base origin/main` passed with zero findings across static rules, ESLint, type checks, and spec compliance.
- `verify --base origin/main` passed with a publish-valid stamp; facade input contracts, task-session tests, workspace audit, and DB guard are green.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-10 23:43:16 `review.run`: passed — OK
- 2026-07-10 23:43:39 `verify`: failed — COMMAND_FAILED
- 2026-07-10 23:44:59 `review.run`: passed — OK
- 2026-07-10 23:45:11 `verify`: passed — OK
- 2026-07-10 23:45:26 `verify`: passed — OK

## key decisions

- Local branch cleanup is reversible when the remote stream exists; remote stream/context deletion is intentionally out of scope.
- Prevent new accidental streams by requiring an explicit creation flag rather than hard-coding a subjective canonical stream registry.
- Cleanup is conservative: ambiguity protects a branch instead of deleting it.

## notes for ko

- This first pass removes local branch clutter and stops silent stream proliferation. Existing remote one-off streams remain available for a later context-consolidation pass.

## improvements noticed

- `task.start` currently creates `stream/<area>` automatically for any new area, which is the main source of one-off stream growth.
- `stream.list` reports state well but has no safe remediation command.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(tooling): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- none yet

## workspace-owned: test selection

- changed files: `.task/tasks/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails.json`, `.task/tasks/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/current.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/evidence-log.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/read-log.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/session.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/verify.json`, `.task/tooling/clean-up-one-off-streams-and-add-lifecycle-guardrails/workpad.md`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/current.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/session.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/verify.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/workpad.md`, `package.json`, `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/browser.js`, `packages/os/scripts/lib/browser/cli.ts`, `packages/os/scripts/lib/browser/config.ts`, `packages/os/scripts/lib/browser/errors.ts`, `packages/os/scripts/lib/browser/process.ts`, `packages/os/scripts/lib/browser/service.ts`, `packages/os/scripts/lib/browser/types.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/stream-lifecycle.js`, `packages/os/scripts/stream-cleanup.js`, `packages/os/scripts/task-start.js`, `packages/os/scripts/tools-search.ts`, `packages/os/skills/browser/SKILL.md`, `packages/os/skills/skills.json`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/browser-service.test.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/fixtures/skills/browser-workspace.SKILL.md`, `packages/os/tests/tools-search-v2.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/package.json`, `packages/workspace/scripts/browser.js`, `packages/workspace/scripts/lib/browser/cli.ts`, `packages/workspace/scripts/lib/browser/config.ts`, `packages/workspace/scripts/lib/browser/errors.ts`, `packages/workspace/scripts/lib/browser/process.ts`, `packages/workspace/scripts/lib/browser/service.ts`, `packages/workspace/scripts/lib/browser/types.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/stream-lifecycle.js`, `packages/workspace/scripts/stream-cleanup.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/browser-service.test.ts`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tests/stream-lifecycle.test.ts`, `packages/workspace/tests/tools-search-v2.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-task-session`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace task session tests`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace task session tests` passed, `workspace audit tests` passed
- failed suites: none
