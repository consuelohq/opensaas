# session start foundation

branch: `task/workspace-agent/session-start-foundation`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1984/session-start-foundation
github pr: https://github.com/consuelohq/opensaas/pull/1984
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/work-session.ts`
- `packages/os/scripts/session-start.ts`
- `packages/os/tests/session-start-foundation.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/work-session.ts`
- `packages/os/scripts/session-start.ts`
- `packages/os/tests/session-start-foundation.test.ts`

## workspace-owned: activity log

- 2026-08-15 01:31:16 fs.write: `.task/workspace-agent/session-start-foundation/workpad.md`
- 2026-08-15 01:34:52 fs.write: `packages/os/tests/session-start-foundation.test.ts`
- 2026-08-15 01:37:31 fs.write: `packages/os/scripts/lib/work-session.ts`
- 2026-08-15 01:38:25 fs.write: `packages/os/scripts/session-start.ts`
- 2026-08-15 01:54:43 fs.write: `.task/workspace-agent/session-start-foundation/workpad.md`
- 2026-08-15 02:05:36 fs.write: `.task/workspace-agent/session-start-foundation/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 01:55:13 `review.run`: passed — OK
- 2026-08-15 01:56:12 `review.run`: passed — OK
- 2026-08-15 01:58:40 `verify`: failed — COMMAND_FAILED
- 2026-08-15 01:59:24 `review.run`: passed — OK
- 2026-08-15 02:00:31 `verify`: failed — COMMAND_FAILED
- 2026-08-15 02:04:50 `verify`: failed — COMMAND_FAILED

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agent): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `session.start` is the canonical session constructor; `kind=task` preserves existing task.start behavior through a compatibility alias, while `kind=work` creates metadata-only work sessions with node affinity and a normalized path. Top-level `workSession` routes through the same generalized session-affinity layer as `taskSession`, and mixed task/work session authority is rejected.
existing local pattern: task.start task lifecycle + Device Authority task-session affinity and MCP proxy routing.
new or changed tests: session.start task/work contract; work-session metadata; generalized affinity claim/resolve; top-level workSession routing; mixed taskSession+workSession rejection; task.start compatibility.
focused red command: identify the existing focused task-lifecycle/device-authority/facade test files, preflight them for destructive literals, then run only the new safe tests before production edits.
expected red failure: session.start/workSession schemas and routing do not exist yet; Device Authority only understands task affinity.
no-test waiver: not applicable.

## Scope boundaries

- Do not change Code Call or filesystem work-session behavior in this branch.
- Do not add work-session write authority or containment here.
- Keep task.push/task.pr/task.finish semantics task-specific.
- Preserve task.start as a compatibility alias while making session.start canonical.
- All promotion targets `stream/workspace-agent`.

- 2026-08-15 01:31:16 append: `.task/workspace-agent/session-start-foundation/workpad.md`

- 2026-08-15 01:34:52 write: `packages/os/tests/session-start-foundation.test.ts`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/work-session.ts`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/mcp-central-proxy-scope.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tools/task-lifecycle/handler.ts`

## Implementation status

- Added canonical `session.start` with `kind=task|work`; `kind=task` delegates to the existing task-start script and `task.start` remains unchanged as a compatibility alias.
- Added metadata-only work sessions stored under managed node state at `node/sessions/work/<wrk_...>.json` with canonical path, owner node, and created/updated timestamps.
- Generalized Device Authority affinity storage to task/work session kinds while retaining all legacy task-affinity methods and task error/log contracts.
- Added top-level `workSession` MCP routing, work route-source propagation, and taskSession+workSession mutual-exclusion validation.
- Added automatic work-session affinity claim after a successful `session.start(kind=work)` response.
- No Code Call or filesystem work-session edit behavior was added in this branch.
- Added `session.start` to the generated full/core manifests and documented the canonical constructor in `packages/os/SCRIPTS.md`.

## Validation

- RED: the new focused suite initially failed on the missing `work-session` module/contracts as expected.
- Focused foundation + compatibility: 93/93 tests passed across `session-start-foundation`, `workspace-node-registry-routing`, `tool-manifest`, and `mcp-gateway`.
- Foundation coverage includes memory and DurableStore affinity, mixed-session rejection, local facade propagation, edge affinity routing, and automatic affinity claim from `session.start` output.
- `packages/os` syntax/type gate passed.
- Generated manifest check passed.
- `git diff --check` passed.
- The Bun-native `mcp-central-proxy-scope` suite still has one pre-existing read-only classifier mismatch (`lifecycle.status`, `monitor.errors`, `security.scan`) unrelated to this task; this branch does not change those tool definitions or the central read-only classifier.
- `stream.sync` merged latest main cleanly in its temporary worktree with zero conflicts, but refused to push because the non-critical whole-OS package baseline already fails in facade tests. The sync tool exposes no approved override, so no failed-check stream merge was pushed silently.

## Decisions

- `session.start(kind=task)` intentionally exposes only the normal task-creation flags actually supported by `scripts/task-start.js`; it does not copy the pre-existing `task.start` PR-selector schema/CLI drift.
- Existing task affinity storage/API remains readable/writable through compatibility methods. Generic session affinity maps task sessions onto the legacy task records; work sessions use separate session-affinity keys.
- Task bookkeeping still calls the legacy task-affinity claim/release methods so injected-failure tests and operational log/error contracts remain unchanged.
- Work-session metadata stays local to the owning node; the control plane stores only session identity/owner affinity, not the filesystem path.

- 2026-08-15 01:54:43 append: `.task/workspace-agent/session-start-foundation/workpad.md`

- 2026-08-15 01:55:25 apply-patch: `packages/os/scripts/session-start.ts`
- 2026-08-15 01:55:54 apply-patch: `packages/documentation/src/content/docs/reference/mcp.mdx`
- 2026-08-15 01:55:54 apply-patch: `packages/documentation/src/content/docs/reference/tools.mdx`

- 2026-08-15 01:59:03 apply-patch: `packages/os/cloudflare/os-device-authority/src/stores.ts`

- 2026-08-15 02:03:10 apply-patch: `packages/os/tests/tool-package-layout.test.ts`

## Final gate evidence

- Focused session foundation and compatibility suites: 93/93 passed.
- Lifecycle handoff selector suite after adding `session.start` to the core manifest: 136/136 passed across 9 files.
- Other critical selector suites from the same verifier run passed: OS release freshness 19/19, workspace production release 3/3, Workspace Edge dry run, lifecycle syntax, lifecycle facade snapshots 9/9, managed-cloud contracts 91/91, Device Authority Worker 29/29.
- Documentation validation passed; documentation foundation 15/15 passed.
- `packages/os` typecheck and generated-manifest check passed; `git diff --check` passed.
- Final strict review/verify review lane: 0 task issues, 0 related-pre-existing issues, 0 blockers, 0 documentation opportunities. DB guard: 0 risks/findings.
- Full verify remains non-publish-valid only because its non-critical auto-selected whole `@consuelo/os` package test exercises the existing broad facade baseline failures. The explicit critical selector rules are green after the task-owned core-count fixture was corrected.
- Package-wide test runs regenerate `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`; that test-generated drift was restored and is not part of the publication diff.

## Stream synchronization state

- `stream/workspace-agent` was created from `main` for this feature train.
- Latest `origin/main` merged into the local stream without conflicts; local stream is fully caught up with main.
- `stream.sync` refused to push that clean merge because it also executes the existing non-critical whole-OS package baseline. The tool exposes no approved override, so the remote stream was not force/bypass-pushed silently.
- Remote `origin/stream/workspace-agent` therefore still needs the already-created conflict-free main merge published through an explicitly approved fallback before Branch 1 is promoted.

- 2026-08-15 02:05:36 append: `.task/workspace-agent/session-start-foundation/workpad.md`
