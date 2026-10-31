# Fix standalone cloud work sessions and bundled skill entrypoints

branch: `task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2750
started: 2026-10-31

## acceptance criteria

- [x] Reproduce signed-runtime work-session failure and patch protected Git discovery safely.
- [x] Reproduce relocated bundled skill validation failure and resolve canonical package-local guidance.
- [x] Test source-tree and relocated-runtime fixtures, broken Git markers, nested worktrees, and existing session security boundaries.
- [ ] Finish strict review, formal verify, and publish to stream/os only.

## plan

1. Inspect remote stream, tests, runtime source and VM state; create isolated task session.
2. Record RED tests before editing production helpers; patch minimally.
3. Run focused GREEN, affected suites, syntax and source-safety checks.
4. Run strict review, verify and publish to the stream review PR; leave main/deployment untouched.

## files changed

- packages/os/scripts/lib/work-session-protection.ts
- packages/os/scripts/lib/skills.ts
- packages/os/tests/work-session-code-call.test.ts
- packages/os/tests/session-start-foundation.test.ts
- packages/os/tests/install-state.test.ts

## key decisions

- A release folder without a .git marker must not trigger a Git worktree command. A damaged Git directory still fails closed.
- Package-local skill entrypoint fallback is allowed only when metadata matches its canonical resource path.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Phase 2 scope and acceptance

- Source task in isolated `stream/os` managed task session, PR #2750; preserve dirty local main and all parallel tasks.
- A standalone Linux signed runtime (no Git metadata) must start a non-repository work session, while Consuelo home and actual managed repositories/worktrees remain protected against overlapping work-session edits.
- Guidance bundled skills must validate their entrypoint locations under a relocated signed Linux runtime bundle, while checking canonical tool declarations and leaving normal repository behavior intact.
- Add focused regression tests (RED first), then GREEN, strict review, formal verify, task.push and task.pr to `stream/os`. **Never merge main or deploy OS changes without separate approval.**
- Cloud VM operator track: reuse existing `consuelo-ko-cloud-1` / OS node `cloud-1`, keep Mac default; inspect bootstrap idempotence and GitHub/agent prerequisites without copying local credentials or provisioning a new VM.

## Test-first contract (initial)

behavior under test: managed repository enumeration should apply only when the resolved root is a real managed Git repo; signed runtime bundles must not be mistaken for Git roots, without weakening managed worktree restrictions. Guidance entrypoint validation should find package-local SKILL.md under relocated distributions.
existing local pattern: `scripts/session-start.ts` selects a managed repo root; `lib/work-session-protection.ts` enumerates Git worktrees; `lib/skills.ts` checks guidance paths relative to repository layout. Inspect existing tests before edits.
new or changed tests: task/work session negative and positive cases; bundled skill validation in package-root / signed-runtime fixture.
focused red command: to select from canonical test suites after inspection.
expected red failure: work-session creation fails outside Git; validation wrongly reports missing bundled guidance when release root is relocated.
no-test waiver: not applicable.

- 2026-10-31 06:59:13 append: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 06:59:13 fs.write: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`
- 2026-10-31 07:00:11 fs.write: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`
- 2026-10-31 07:01:13 fs.write: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`
- 2026-10-31 07:04:18 fs.write: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/code-call/service.ts`
- `packages/os/scripts/lib/workspace-project-cwd.ts`
- `packages/workspace/scripts/lib/verify-run-state.js`

## Test-first contract — refined before code edits

Root cause A: a signed cloud runtime is a directory containing bundled source but not a Git checkout. session-start.ts passes process.cwd() as managedRepoRoot when no checkout is configured; managedWorktreeRoots runs git worktree list there and throws. Fix should detect absence of a real .git marker along the candidate's ancestor chain and return no managed worktree roots only for non-repositories. When a marker exists, preserve fail-closed git worktree list failures. Protect linked task worktrees and nested repo paths.
Root cause B: bundled skill metadata declares source paths packages/os/skills/<name>/SKILL.md. validateGuidanceSkill constructs a source-tree path relative to getPackageRoot()/../.., invalid when the package root is a relocated immutable runtime release. Allow only canonical package-local skill entrypoint resolution as fallback without accepting arbitrary wrong metadata paths. Preserve rejection of missing guidance files and canonical OS tools.
Tests to write first: tests/work-session-code-call.test.ts (non-git root and broken .git), tests/session-start-foundation.test.ts (default work session from signed runtime), tests/install-state.test.ts (validateBundledSkills with relocated runtime fixture).
Focused RED: bun --cwd packages/os test tests/work-session-code-call.test.ts tests/session-start-foundation.test.ts tests/install-state.test.ts -t 'non-Git|signed runtime|relocated runtime|malformed Git'. Expected failures: non-Git managedWorktreeRoots throws, work sessions fail with managed root as release bundle, relocated bundled skills fail. Malformed Git continues to fail. Run canonical test-source-safety preflight first.
Expected GREEN: targeted cases pass, existing linked worktree and Consuelo-state protection pass, affected tests pass. No direct deployment or patch of the signed cloud runtime under this approval.

- 2026-10-31 07:00:11 append: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`

- 2026-10-31 07:00:41 apply-patch: `packages/os/tests/work-session-code-call.test.ts`
- 2026-10-31 07:00:41 apply-patch: `packages/os/tests/session-start-foundation.test.ts`
- 2026-10-31 07:00:41 apply-patch: `packages/os/tests/install-state.test.ts`
## TDD RED evidence - 2026-10-31

- Canonical test-source-safety preflight: 1/1 passed.
- Focused work-session/skill tests: 3 expected failures, 55 skipped. REDs: non-Git root causes managedWorktreeRoots to throw; signed-runtime work-session creation fails; relocated guidance fixture ignored by validator.
- Broken Git marker remains fail-closed (must continue passing).
- Scope: helper modules only; do not change main, VM signed runtime, or security gates.

- 2026-10-31 07:01:13 append: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`

- 2026-10-31 07:01:20 apply-patch: `packages/os/scripts/lib/work-session-protection.ts`
- 2026-10-31 07:01:20 apply-patch: `packages/os/scripts/lib/skills.ts`
- 2026-10-31 07:01:38 apply-patch: `packages/os/tests/install-state.test.ts`
- 2026-10-31 07:03:37 apply-patch: `packages/os/tests/work-session-code-call.test.ts`
- 2026-10-31 07:03:37 apply-patch: `packages/os/tests/install-state.test.ts`
## Validation update

- Focused and affected tests passed.

- 2026-10-31 07:04:18 append: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`

- 2026-10-31 07:06:28 apply-patch: `.task/os/fix-standalone-cloud-work-sessions-and-bundled-skill-entrypoints/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 07:06:44 `review.run`: passed — OK
- 2026-10-31 07:09:54 `review.run`: passed — OK
- 2026-10-31 07:30:09 `verify`: passed — OK
