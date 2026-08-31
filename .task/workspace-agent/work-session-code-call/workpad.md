# Work session Code Call

branch: `task/workspace-agent/work-session-code-call`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1994/work-session-code-call
github pr: https://github.com/consuelohq/opensaas/pull/1994
started: 2026-08-15

## acceptance criteria

- [x] Work-session Code Call authority, protection, topology, and containment are implemented and tested.

## plan

1. Merge current `stream/workspace-agent` foundation.
2. Add RED authority/topology/containment tests.
3. Implement facade work-session resolution and Git-topology task validation.
4. Enforce work-session filesystem containment for Code Call.
5. Regenerate tool contracts and run focused/full regression plus strict review.

## current status

- Implementation complete; focused/safe regression gates are green; strict review is clean.

## files changed

- `packages/os/TOOLS.md`
- `packages/os/manifests/generated/core.manifest.json`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/lib/code-call/location.ts`
- `packages/os/scripts/lib/code-call/policy.ts`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/code-call/service.ts`
- `packages/os/scripts/lib/code-call/types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/code-call-parity.test.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/codemode/schema.ts`
- `packages/os/workflows/generated/workflow-bundles.json`
- `packages/os/tests/work-session-code-call.test.ts`


## workspace-owned: files changed

- `packages/os/scripts/lib/code-call/location.ts`
- `packages/os/tests/work-session-code-call.test.ts`

## workspace-owned: activity log

- 2026-08-15 02:38:35 fs.write: `.task/workspace-agent/work-session-code-call/workpad.md`
- 2026-08-15 02:41:11 fs.write: `packages/os/tests/work-session-code-call.test.ts`
- 2026-08-15 02:42:06 fs.write: `.task/workspace-agent/work-session-code-call/workpad.md`
- 2026-08-15 02:46:57 fs.write: `packages/os/scripts/lib/code-call/location.ts`

## workspace-owned: validation evidence

- Final focused integration: 81 passed / 1 platform-gated skip across Code Call, work-session FS, session foundation, tool-manifest, and facade compatibility coverage.
- Canonical generated manifest/types/docs are current; `generate-tool-manifest:check`, package typecheck/syntax, and `git diff --check` pass.
- Final strict review vs `origin/stream/workspace-agent`: 0 issues, 0 blockers; one non-blocking public-docs opportunity is intentionally left to the final session-integration branch that owns cross-tool discoverability.
- Official verify: review + DB guard + all selected critical suites passed. The only failing lane is the non-critical whole `@consuelo/os` package suite.
- Baseline comparison proves the remaining whole-package failures are inherited: clean `origin/stream/workspace-agent` = 31 failing files / 93 failing tests; this task checkout = 26 failing files / 85 failing tests after fixing the two Code Call compatibility failures surfaced by verify.
- Stream synchronization check: `origin/main...origin/stream/workspace-agent` = 0 behind / 8 ahead before promotion.

## key decisions

- Callers pass only `workSession`; the facade resolves the persisted path internally.
- Work-session roots overlapping Consuelo home or any managed repo worktree are rejected with taskSession guidance.
- Task worktree identity is Git common-dir + registered linked-worktree + `task/*` branch, never directory naming.
- macOS uses Seatbelt write containment; work-session Code Call fails closed on platforms without a containment provider.
- `taskSession` and `workSession` are mutually exclusive authorities.

## notes for ko

- Work-session Code Call is fully composed with the parallel work-session FS branch through one shared local work-session authority resolver.
- macOS has enforced filesystem containment now. Work-session Code Call intentionally fails closed on Linux/Windows until dedicated containment providers are implemented; task-session Code Call remains cross-platform as before.

## improvements noticed

- Add Linux and Windows work-session containment providers before advertising work-session Code Call edits on those nodes.
- Public tool-reference docs should be updated in the final session-integration branch alongside the rest of the session-start/tool guidance.

## issues and recovery

- The task-session MCP route intermittently returned `Connection failed` while general OS status and explicit task-worktree Code Call remained healthy. Work continued through the same Git-linked task worktree using explicit Code Call task authority; no raw host Git editing was used.
- Parallel FS work landed during this task, producing one expected executor conflict. It was reconciled by sharing the FS branch's canonical work-session resolver and adding Code Call as another supported authority consumer.
- Normal task.push is currently blocked because full verify cannot issue a publish-valid stamp while the inherited non-critical whole-OS package suite is red. An approved publish path requires explicit Ko approval; no bypass has been used yet.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agent): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Code Call accepts a routed workSession as edit authority, resolves cwd inside the work-session root, rejects taskSession+workSession conflicts, rejects work-session edits inside Consuelo-managed repos/worktrees, and enforces write containment so Bash/Python/Bun cannot mutate outside the approved root.
existing local pattern: taskSession edit authority, task-worktree cwd resolution, mode-based Code Call policy, before/after mutation snapshots, central session.start foundation on stream/workspace-agent.
new or changed tests: focused facade/schema/session-routing tests plus Code Call location/policy/containment tests; add escape attempts using absolute paths, parent traversal, and symlink targets outside the work root.
focused red command: to be determined after syncing current stream and locating owning Code Call test files.
expected red failure: current Code Call schema/policy does not accept workSession authority and process execution is not contained to a work-session root.
no-test waiver: not applicable.

## Dependency note

This task was created from main even though its PR targets stream/workspace-agent. Before production edits, merge the latest origin/stream/workspace-agent into the task branch so the already-approved session-start foundation is present.

- 2026-08-15 02:38:35 append: `.task/workspace-agent/work-session-code-call/workpad.md`

- 2026-08-15 02:41:11 write: `packages/os/tests/work-session-code-call.test.ts`

- 2026-08-15 02:41:25 apply-patch: `packages/os/tests/work-session-code-call.test.ts`
- 2026-08-15 02:41:34 apply-patch: `packages/os/tests/work-session-code-call.test.ts`
## RED evidence

Focused command: `bun --cwd packages/os vitest run tests/work-session-code-call.test.ts`

Result before implementation: 5/6 failures. The current facade strips/does not resolve `workSession`, edit mode therefore cannot route to the work path; the hard-coded `opensaas-worktrees/task-*` heuristic rejects a valid linked worktree at an arbitrary path and incorrectly accepts an unrelated repo placed under the heuristic path; escape tests fail before execution rather than proving containment. This is the expected RED state.

- 2026-08-15 02:42:06 append: `.task/workspace-agent/work-session-code-call/workpad.md`

- 2026-08-15 02:45:49 apply-patch: `packages/os/scripts/lib/code-call/types.ts`
- 2026-08-15 02:45:59 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-08-15 02:46:07 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-08-15 02:46:13 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-08-15 02:46:57 write: `packages/os/scripts/lib/code-call/location.ts`

- 2026-08-15 02:47:55 apply-patch: `packages/os/scripts/lib/code-call/policy.ts`
- 2026-08-15 02:48:03 apply-patch: `packages/os/scripts/lib/code-call/process.ts`
- 2026-08-15 02:48:10 apply-patch: `packages/os/scripts/lib/code-call/process.ts`
- 2026-08-15 02:48:20 apply-patch: `packages/os/scripts/lib/code-call/service.ts`
- 2026-08-15 02:48:36 apply-patch: `packages/os/tests/work-session-code-call.test.ts`
- 2026-08-15 02:49:06 apply-patch: `packages/os/tests/work-session-code-call.test.ts`
- 2026-08-15 02:49:57 apply-patch: `packages/os/scripts/lib/code-call/process.ts`
- 2026-08-15 02:50:00 apply-patch: `packages/os/scripts/lib/code-call/service.ts`
- 2026-08-15 02:50:05 apply-patch: `packages/os/tests/work-session-code-call.test.ts`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/code-call-parity.test.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tools/codemode/schema.ts`

- 2026-08-15 02:54:59 apply-patch: `packages/os/tests/work-session-code-call.test.ts`