# Create branch workflow skill and fix skill steering catalog integration

branch: `task/os/create-branch-workflow-skill-and-fix-skill-steering-catalog-integration`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1837/create-branch-workflow-skill-and-fix-skill-steering-catalog-integration
github pr: https://github.com/consuelohq/opensaas/pull/1837
started: 2026-08-11

## acceptance criteria

- [x] Add an active OS guidance skill for collaborative big-project decomposition and branch/PR-stack planning, preserving the intent of the stateless-MCP planning conversation: alignment before decomposition, explicit invariants, deep-dive risk discovery, sequential vs parallel dependency planning, stable `Branch N approved, go` semantics, and repository/stream state as the source of truth between branched chats.
- [x] The skill is repo-backed with `SKILL.md`, `skill.json`, and ChatGPT skill metadata where supported, and passes OS bundled-skill validation plus skill-creator validation/package checks.
- [x] Regenerate `packages/os/skills/skills.json` so the new skill is discoverable in the bundled catalog.
- [x] Restore the intended installed-skill catalog section to `get_steering`, preferring the current `<CONSUELO_HOME>/components/installed-skills.json` selected-skill index, preserving indexed custom skills, honoring runtime-disabled skills, and using legacy/bundled fallbacks only where appropriate.
- [x] Steering exposes compact skill discovery metadata, not SKILL.md bodies or arbitrary skill files, and degrades safely if installed discovery metadata is absent or malformed.
- [x] Add regression tests proving selected, legacy, custom, and disabled skill behavior in `getSteering()` and that the generated bundled registry contains the new branch-planning skill.
- [x] Preserve existing steering loop guard, local steering loading, core manifest routing, security behavior, and existing skill install semantics.
- [x] Validate diff/review gates, then publish to the OS stream review PR.

## plan

1. Recover prior skills work and current steering/install architecture before editing.
2. Record a focused red regression for installed skill visibility in `getSteering()` and registry inclusion of the new branch skill.
3. Create the branch-planning skill from the skill-creator template, then adapt it to the OS repo metadata contract without duplicating the existing `task` skill.
4. Add a small steering skill-catalog reader/renderer that prefers the installed registry and falls back to the bundled registry, with bounded/validated metadata only.
5. Regenerate `packages/os/skills/skills.json` and run focused green tests.
6. Run bundled-skill validation, skill-creator quick validation/package checks, broader OS steering/install tests, diff/review/verify, then publish.

## Test-first contract

Behavior under test:
- `getSteering()` includes a compact `## Installed skills` section sourced from the active installed skills registry, including a fixture-only custom skill marker and excluding SKILL.md body content.
- `buildSkillsRegistry()` includes the repo-backed `branch` skill once its metadata exists.

Existing local test patterns:
- `packages/os/tests/os-get-steering-trace.test.ts` already creates isolated `CONSUELO_HOME`/user-home fixtures and calls `getSteering()` through Bun.
- `packages/os/tests/skills-registry.test.ts` already asserts expected bundled skill names and registry compaction.

Focused red command:
- `bun --cwd packages/os run test tests/os-get-steering-trace.test.ts tests/skills-registry.test.ts`

Expected red failure before production implementation:
- steering assertion fails because current `getSteering()` never reads `skills.json`;
- branch registry assertion fails because `packages/os/skills/branch/skill.json` does not yet exist.

## current status

- Implementation and review complete; publish remains.
- Prior implementation intent was found on commit `ef4b0f0352` (`Installed skills node identity and update summary in steering`) in `stream/os-distribution`, but that commit is not an ancestor of current `main`/`stream/os`.
- Current installs use `<CONSUELO_HOME>/components/installed-skills.json` as the selected/active skill index. Legacy `<CONSUELO_HOME>/skills/skills.json` remains a compatibility fallback, while the bundled registry is a source/dev fallback.
- `getSteering()` now appends a bounded `## Installed skills` catalog and never inlines SKILL.md bodies.
- The new `branch` skill is a default/core onboarding candidate through its `repo` capability without changing explicit existing skill selections.

## files changed

- `.task/os/create-branch-workflow-skill-and-fix-skill-steering-catalog-integration/workpad.md`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/lib/steering-skills.ts`
- `packages/os/skills/skills.json`
- `packages/os/skills/branch/agents/openai.yaml`
- `packages/os/skills/branch/skill.json`
- `packages/os/skills/branch/SKILL.md`
- `packages/os/tests/onboarding-skills.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/skills-registry.test.ts`

## workspace-owned: files changed

- `.task/os/create-branch-workflow-skill-and-fix-skill-steering-catalog-integration/workpad.md`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/lib/steering-skills.ts`
- `packages/os/skills/skills.json`
- `packages/os/skills/branch/agents/openai.yaml`
- `packages/os/skills/branch/skill.json`
- `packages/os/skills/branch/SKILL.md`
- `packages/os/tests/onboarding-skills.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/skills-registry.test.ts`

## workspace-owned: activity log

- 2026-08-11 21:18:06 fs.write: `.task/os/create-branch-workflow-skill-and-fix-skill-steering-catalog-integration/workpad.md`
- 2026-08-11 21:25:02 fs.write: `packages/os/skills/branch/SKILL.md`
- 2026-08-11 21:25:08 fs.write: `packages/os/skills/branch/skill.json`
- 2026-08-11 21:25:12 fs.write: `packages/os/skills/branch/agents/openai.yaml`
- 2026-08-11 21:25:31 fs.write: `packages/os/scripts/lib/steering-skills.ts`

## workspace-owned: validation evidence

- TDD red: focused steering/registry/onboarding tests failed only for the intentionally missing branch skill and steering catalog behavior before production implementation.
- TDD red follow-up: disabled-skill and preserved-custom-skill steering assertions failed before the overlay/custom-index fix.
- Green: `cd packages/os && bun test tests/os-get-steering-trace.test.ts tests/skills-registry.test.ts tests/onboarding-skills.test.ts` -> 19 pass, 0 fail.
- Green broader owned regression: `cd packages/os && bun test tests/install-state.test.ts tests/manifest-overlay.test.ts tests/os-get-steering-trace.test.ts tests/skills-registry.test.ts tests/onboarding-skills.test.ts` -> 46 pass, 0 fail, 398 assertions.
- Generated registry is deterministic on rerun and contains 11 bundled skills including `branch`.
- `cd packages/os && bun run typecheck` -> workspace script syntax checks passed.
- `git diff --check` -> clean.
- Skill-creator `quick_validate.py` -> `Skill is valid!`.
- Skill-creator `package_skill.py` -> package validated and built successfully. Staged validation hashes match repo `SKILL.md` and `agents/openai.yaml` hashes exactly.
- `review.run --strict --no-tests` against `origin/stream/os` -> 0 blocking issues, 0 owned issues, 0 pre-existing review issues; static rules, ESLint, typecheck, and spec compliance all passed.
- 2026-08-11 21:32:01 `review.run`: passed — OK
- 2026-08-11 21:32:02 `review.run`: passed — OK

## key decisions

- Reuse the prior distribution branch's intent (compact installed-skill discovery in steering) without cherry-picking its unrelated node/update-summary architecture.
- Keep `branch` separate from `task`: `branch` owns alignment, decomposition, dependency/parallel planning, and branch execution contracts; `task` continues to own the lifecycle of one concrete repo task.
- Prefer the current selected installed-skill index for user/node truth; include preserved user-owned custom skills, honor `manifest.overlay.json` disabled skills, and use legacy/bundled registries only as compatibility/source fallbacks.
- Do not inline full SKILL.md bodies into steering.
- Preserve explicit existing user skill selections; `branch` is included automatically for fresh/default selection, but this PR does not silently re-enable skills for installs with an explicit custom selection.

## notes for ko

- Git history confirms the behavior was built on `stream/os-distribution` but never landed in current main, matching the remembered “we did this at one point” state.

## improvements noticed

- Add a regression assertion tying generated skills to steering discovery so future canonical-steering refactors cannot silently drop skill visibility again.

## issues and recovery

- Initial task-scoped discovery batch hit a transient OS network error; one retry succeeded with no repo mutation.
- A history batch stopped because `grep` returned exit 1 for no match; rerun treated non-match as normal and completed successfully.
- One `git log | head` read returned SIGPIPE/141 after `head` closed the pipe; output was still sufficient and no mutation occurred.
- First workpad overwrite was blocked by `fs.write` because the durable task record already existed; reran explicitly with overwrite enabled.
- One broader `settings-site.test.ts` assertion expects an obsolete Secrets placeholder string and fails against the current authenticated bindings shell. This PR does not change the configuration site; the owned install/overlay/steering/skills suite passes 46/46.
- First `review.run` attempt hit a transient MCP network failure before producing findings; one retry completed successfully with zero findings.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/manifest-overlay.ts`
- `packages/os/scripts/lib/onboarding-skills.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/skills.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills.md`
- `packages/os/skills/skills.json`
- `packages/os/skills/task/SKILL.md`
- `packages/os/skills/task/skill.json`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/onboarding-skills.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/skills-registry.test.ts`

- 2026-08-11 21:31:29 apply-patch: `.task/os/create-branch-workflow-skill-and-fix-skill-steering-catalog-integration/workpad.md`

- 2026-08-11 21:32:12 apply-patch: `.task/os/create-branch-workflow-skill-and-fix-skill-steering-catalog-integration/workpad.md`