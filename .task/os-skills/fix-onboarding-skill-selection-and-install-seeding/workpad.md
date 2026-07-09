# fix onboarding skill selection and install seeding

branch: `task/os-skills/fix-onboarding-skill-selection-and-install-seeding`
stream: `stream/os-skills`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/754/fix-onboarding-skill-selection-and-install-seeding
github pr: https://github.com/consuelohq/opensaas/pull/754
started: 2026-06-04

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

- none yet

## workspace-owned: validation evidence

- 2026-06-04 15:16:17 `verify`: passed — OK
- 2026-06-04 15:18:05 `verify`: passed — OK
- 2026-06-04 15:20:34 `verify`: passed — OK

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
bun run task:push -- --message "type(os-skills): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: TDD red evidence

"""
anchor = "\n\n  it('records detected agent connections without editing unknown config files', () => {"
if insert.strip() not in text:
    if anchor not in text:
        raise SystemExit('install-state insertion anchor not found')
    text = text.replace(anchor, insert + anchor)
p.write_text(text)
PY`: failed exit 2 trace: `trc_aa286e5c7382`
  - output: .stringify(result)); `)); expect(existsSync(join(tempHome, 'skills', 'task', 'SKILL.md'))).toBe(true); expect(existsSync(join(tempHome, 'skills', 'senior-engineer', 'SKILL.md'))).toBe(true); expect(existsSync(join(tempHome, 'skills', 'research-ingest', 'SKILL.md'))).toBe(false); expect(result.actions.some((acti... [truncated 1807 chars] Unknown option: - usage: /opt/homebrew/Cellar/python@3.14/3.14.5/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python [option] ... [-c cmd | -m mod | file | -] [arg] ... Try `python -h' for more information.
- 2026-06-04 15:08:29 `bun --cwd packages/os test tests/onboarding-skills.test.ts tests/install-state.test.ts`: failed exit 1 trace: `trc_faf8e76d50fa`
  - output: tempHome, 'skills', 'senior-engineer', 'SKI… [90m137| [39m expect(existsSync(join(tempHome, 'skills', 'research-ingest', 'SKI… [90m138| [39m expect(existsSync(join(tempHome, 'skills', 'consuelo-design-landin… [90m | [39m [31m^[39m [90m139| [39m [90m140| [39m const config = JSON.parse(readFileSync(join(tempHome, 'config.json… [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## 2026-06-04 implementation start

Approved scope:
- Make onboarding skill choices registry-driven from bundled OS skills.
- Preselect active/core skills by default while preserving user ability to unselect.
- Make install seeding materialize selected bundled skills into the installed home.
- Preserve local/user skills and avoid destructive removal in this pass.

Test-first contract:
- Behavior under test: onboarding choices come from bundled skill metadata, deprecated aliases are excluded from defaults, noninteractive installs use default selected skills, and selectedSkills controls fresh skill materialization.
- Existing pattern: `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/skills-registry.test.ts`.
- New/changed tests: add `packages/os/tests/onboarding-skills.test.ts`; extend `packages/os/tests/install-state.test.ts`.
- Focused red command: `bun --cwd packages/os test tests/onboarding-skills.test.ts tests/install-state.test.ts`.
- Expected red failure: missing onboarding skill helper and selectedSkills currently does not filter skill materialization.

Issue:
- First test patch attempt used array-form `task.call` with a shell heredoc and failed with Python option parsing. No files were changed by that failed command.

## workspace-owned: TDD green evidence

- 2026-06-04 15:10:03 `bun --cwd packages/os test tests/onboarding-skills.test.ts tests/install-state.test.ts`: passed exit 0 trace: `trc_aed27e9dcb7b`
  - output: → tmux: opensaas-os-skills-fix-onboarding-skill-selection-and-install-seedi-5d9625a4 $ vitest run tests/onboarding-skills.test.ts tests/install-state.test.ts

## final implementation notes

Implemented:
- Added `packages/os/scripts/lib/onboarding-skills.ts` to derive onboarding choices from bundled skill metadata.
- `install.ts` now uses registry-driven skill options and defaults selected skills to active, non-deprecated bundled skills.
- `provisionLocalOs()` now uses `selectedSkills` to materialize only selected bundled skills on fresh install.
- Existing user/local skills are still preserved; unselected already-installed bundled skills are not pruned in this pass.
- Deprecated compatibility alias `consuelo-design-landing-page` is excluded from default install.

Key decision:
- First pass uses active/non-deprecated metadata as the default selection rule. Full core/nice-to-have taxonomy remains follow-up metadata work.
- This task does not implement remote/server skill caching or skill pruning.

Validation evidence:
- red: `bun --cwd packages/os test tests/onboarding-skills.test.ts tests/install-state.test.ts` failed before implementation because onboarding helper was missing and selectedSkills did not filter installs.
- green: `bun --cwd packages/os test tests/onboarding-skills.test.ts tests/install-state.test.ts` passed 9 tests.
- green: `bun --cwd packages/os test tests/onboarding-skills.test.ts tests/install-state.test.ts tests/skills-registry.test.ts tests/skill-migration.test.ts` passed 23 tests.
- green: `bun test packages/os/scripts/onboarding-flow.test.ts` passed 6 tests.
- green: `cd packages/os && node ./scripts/check-syntax.js` passed.
- green: direct install smoke with `bun packages/os/scripts/install.ts --dry-run --yes --json` produced 10 default selected skills.
- green: direct temp install with `bun packages/os/scripts/install.ts --yes --json --skip-daemons` wrote 10 skill folders, included `senior-engineer`, and excluded deprecated `consuelo-design-landing-page`.
- green: `git diff --check` passed.

Issue:
- The task branch started from `main` and then merged `origin/stream/os-skills` to avoid regressing current stream work. That makes base ancestry less clean than starting from stream; the final stream review diff should be inspected after promotion.

## workspace-owned: test selection

- changed files: `.task/os-skills/fix-onboarding-skill-selection-and-install-seeding/current.json`, `.task/os-skills/fix-onboarding-skill-selection-and-install-seeding/session.json`, `.task/os-skills/fix-onboarding-skill-selection-and-install-seeding/verify.json`, `.task/os-skills/fix-onboarding-skill-selection-and-install-seeding/workpad.md`, `.task/tasks/os-skills/fix-onboarding-skill-selection-and-install-seeding.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/onboarding-skills.ts`, `packages/os/scripts/lib/skills.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/onboarding-skills.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
