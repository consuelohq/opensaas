# session integration

branch: `task/workspace-agent/session-integration`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2036/session-integration
github pr: https://github.com/consuelohq/opensaas/pull/2036
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 06:57:18 fs.write: `.task/workspace-agent/session-integration/workpad.md`
- 2026-08-15 07:19:07 fs.write: `.task/workspace-agent/session-integration/workpad.md`
- 2026-08-15 07:31:50 fs.write: `.task/workspace-agent/session-integration/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 07:19:41 `review.run`: passed — OK
- 2026-08-15 07:20:39 `review.run`: passed — OK
- 2026-08-15 07:24:09 `review.run`: passed — OK
- 2026-08-15 07:25:27 `verify`: failed — COMMAND_FAILED
- 2026-08-15 07:31:05 `review.run`: passed — OK
- 2026-08-15 07:31:35 `verify`: passed — OK
- 2026-08-15 07:32:25 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/package.json`
- `packages/documentation/src/content/docs/build/skills/bundled/task.mdx`
- `packages/documentation/src/content/docs/build/workflows.mdx`
- `packages/documentation/src/content/docs/reference/tools.mdx`
- `packages/os/hooks/task/guidance.js`
- `packages/os/hooks/task/workflow.js`
- `packages/os/package.json`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/private-workspace-session-recovery.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/work-session-fs.ts`
- `packages/os/scripts/lib/work-session.ts`
- `packages/os/scripts/session-start.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/streams/workspace-agent/AGENTS.md`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/task-hook-workflow-contract.test.ts`
- `packages/os/tests/task-hooks.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/work-session-code-call.test.ts`
- `packages/os/tools/task-lifecycle/handler.ts`
- `packages/os/tools/task-lifecycle/schema.ts`
- `packages/workspace/hooks/task/guidance.js`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/gh.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/os-release.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/task.md`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/task-hook-workflow-contract.test.ts`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/workflow-intent.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## Test-first contract

behavior under test: integrated task/work session routing, compatibility, recovery, observability projection, and managed-repo escape protection.
existing local pattern: focused OS/workspace contract tests plus generated manifest/type parity.
new or changed tests: session-start foundation, work-session Code Call/FS, MCP routing/affinity, durable recovery, observability, and generated-surface parity as needed.
focused red command: run the smallest existing session/routing/observability suites after adding integration assertions, before production edits.
expected red failure: current guidance/generated/routing surfaces do not yet fully assert the final umbrella-session behavior.
no-test waiver: none.

- 2026-08-15 06:57:18 append: `.task/workspace-agent/session-integration/workpad.md`

## Integration progress

- Synchronized current `stream/workspace-agent` into the task, then neutralized inherited main-only/foreign-stream tree changes so the final task tree is scoped to session integration only.
- Canonical task construction now uses `session.start({ kind: "task" })`; `task.start` remains a compatibility alias.
- OS + workspace task hooks/guidance subscribe to canonical `session.start` task events while retaining legacy alias behavior.
- Added a real workspace fallback `session:start` wrapper and `SessionStartInput`; work mode reuses the OS durable work-session metadata primitive, task mode delegates the existing workspace task lifecycle.
- Regenerated OS and workspace tool manifests, workflow bundles, type stubs, and tool docs.
- Added focused `workspace-session-integration` test-selection ownership.
- Prior merged workspace-agent local task branch refs were verified ancestors of the stream and deleted; no prior workspace-agent task worktrees remained.

## Validation so far

- Canonical hook/guidance integration: 40/40 passed.
- Workspace manifest/workflow compatibility: 23/23 passed.
- Workspace executable work-session constructor: 1/1 passed.
- Work-session Code Call containment: 12 passed / 1 platform skip.
- Work-session FS containment: 9/9 passed.
- Durable task worktrees: OS 2/2 + workspace 2/2 passed.
- Task-session recovery: OS 11/11 + workspace 13/13 passed.
- Worktree eviction/recovery: 9/9 passed.
- Observability Session presentation: 10/10 passed.
- Test-selection registry: 40/40 passed.

## Grok subagent diagnostics

- First start with `reasoningEffort: xhigh` failed with `CAPABILITY_NOT_SUPPORTED`: Grok provider reports `reasoningEffort: false`. Retry without reasoning effort succeeded.
- Large initial `tmp` handoff payloads intermittently failed at the MCP transport with `network_error`; a shorter handoff succeeded. This was transport/payload flakiness before Grok execution, not a Grok model failure.
- Grok run `run_ab497a2c81025890280a4767` completed, but reviewed the stale remote PR head before our baseline repair/push and therefore correctly flagged stale ancestry/unrelated PR scope. It could not publish GitHub review comments because the Grok environment blocked the raw GitHub POST as an external publish action.
- A second Grok review must run after the verified integration commit is pushed to PR #2036; that pass will be used for actionable GitHub comments/fixes.

- 2026-08-15 07:19:07 append: `.task/workspace-agent/session-integration/workpad.md`

## Final pre-push validation

- Strict review: 0 branch-owned issues, 0 blockers, 0 documentation opportunities.
- Public documentation aligned: generated bundled Task skill page, Tools reference evidence, and Workflows session-start guidance; documentation build/reference tests 19/19 passed.
- OS manifest characterization refreshed for canonical `session.start` and `task.start` compatibility alias.
- Exact selected gate: 12/12 focused suites passed; unrelated whole-OS package fallback is no longer selected because integration test files are explicitly owned by the focused session-integration rule.
- Formal verify: `publishValid: true`; review passed; DB guard passed; verify stamp written.

## Remaining publish sequence

1. Push the verified integration diff to PR #2036.
2. Rerun Grok against the pushed remote head (without unsupported reasoningEffort).
3. Post/fix valid Grok findings; record any GitHub-publish limitation if the provider still cannot comment directly.
4. Re-verify after any Grok fixes, merge #2036 into `stream/workspace-agent`, and finish the task.

- 2026-08-15 07:31:50 append: `.task/workspace-agent/session-integration/workpad.md`
