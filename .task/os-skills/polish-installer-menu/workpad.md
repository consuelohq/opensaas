# polish installer menu

branch: `task/os-skills/polish-installer-menu`
stream: `stream/os-skills`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/760/polish-installer-menu
github pr: https://github.com/consuelohq/opensaas/pull/760
started: 2026-06-05

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

- 2026-06-05 01:04:09 `review.run`: passed — OK
- 2026-06-05 01:12:58 `verify`: passed — OK

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

## 2026-06-04 installer skill menu UX

Approved scope from Ko:
- Remove skill descriptions from the interactive skill menu; show titles only.
- Start the interactive skill menu with all rows unselected.
- Add a first selectable group row: `Core OS skills (suggested starting point)`.
- Make that group select all core skills visually in the terminal.
- Core skills are all current non-deprecated skills except `Consuelo Workspace Snapshot` and `Daily Revenue Brief`.
- Keep those two as non-core/optional choices.
- Add a little visual separation between the core group and the optional rows.

Test-first contract:
- Update onboarding skill unit coverage before implementation.
- Red tests should prove core/default membership excludes only the two optional skills plus deprecated alias.
- Red tests should prove grouped prompt data has a first core group label, optional group separation data, and no per-skill hints/descriptions.
- Focused red command: `bun --cwd packages/os test tests/onboarding-skills.test.ts`.
- Green command: same focused suite, then install-state/regression suite and syntax check.

Implementation plan:
1. Extend `onboarding-skills.ts` with grouped prompt metadata and explicit core membership.
2. Switch install prompt from `multiselect` to `groupMultiselect` with selectable groups, no hints, no initial interactive selections, and core group cursor start.
3. Preserve noninteractive `--yes/--json` behavior using default core skills.
4. Validate focused tests, broader install-state tests, syntax, and a real terminal interaction if feasible.

## workspace-owned: TDD red evidence

    for (const option of Object.values(grouped.options).flat()) {
      expect(option.label).toBeTruthy();
      expect(option.hint).toBeUndefined();
    }
  });
});
""")
`: passed exit 0 trace: `trc_6832db461d58`
  - output: lected).toContain('skill-creator'); expect(selected).toContain('task'); expect(selected).not.toContain('consuelo-workspace-snapshot'); expect(selected).not.toContain('daily-revenue-brief'); expect(selected).not.toContain('consuelo-design-landing-page'); }); it('groups the interactive prompt with core first, optional second, title-only rows', () => { const grouped = getGroupedOnboardingSkillOptions(); const groupNames = Object.keys(grouped.options); expect(groupNames).toEqual([ CORE_SKILL_GROUP_LABEL, OPTIONAL_SKILL_GROUP_LA... [truncated 785 chars]
- 2026-06-05 00:59:13 `bun --cwd packages/os test tests/onboarding-skills.test.ts`: failed exit 1 trace: `trc_a9d468aa5d5f`
  - output: t.ts:[2m43:21[22m[39m [90m 41| [39m [90m 42| [39m it('groups the interactive prompt with core first, optional second, … [90m 43| [39m [35mconst[39m grouped [33m=[39m [34mgetGroupedOnboardingSkillOptions[39m()[33m;[39m [90m | [39m [31m^[39m [90m 44| [39m [35mconst[39m groupNames [33m=[39m [33mObject[39m[33m.[39m[34mkeys[39m(grouped[33m.[39moptions)[33m;[39m [90m 45| [39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-05 00:59:53 `bash -lc cd packages/os && bun test tests/onboarding-skills.test.ts`: passed exit 0 trace: `trc_b148739f2799`
  - output: → tmux: opensaas-os-skills-polish-installer-menu-2d07c17a tests/onboarding-skills.test.ts: (pass) onboarding skill choices > builds onboarding choices from bundled skills instead of the old three hardcoded names [3.77ms] (pass) onboarding skill choices > defaults to core skills and excludes optional plus deprecated skills [0.77ms] (pass) onboarding skill choices > groups the interactive prompt with core first, optional second, title-only rows [1.26ms] 3 pass 0 fail 45 expect() calls Ran 3 tests across 1 file. [26.00ms]

## validation evidence

- Red: `bun --cwd packages/os test tests/onboarding-skills.test.ts` failed before implementation because `getCoreSelectedSkillNames` and `getGroupedOnboardingSkillOptions` did not exist.
- Green: `cd packages/os && bun test tests/onboarding-skills.test.ts` passed 3 tests / 45 assertions.
- Green: `cd packages/os && bun test tests/install-state.test.ts tests/skills-registry.test.ts tests/skill-migration.test.ts tests/onboarding-skills.test.ts` passed 24 tests / 146 assertions.
- Green: `cd packages/os && node ./scripts/check-syntax.js` passed.
- Green: `CONSUELO_HOME=<tmp> bun packages/os/scripts/install.ts --dry-run --yes --json` defaults to 8 core skills: browser, consuelo-design, debugger, handoff, research-ingest, senior-engineer, skill-creator, task.
- Green: expect/PTY dry-run proof shows the interactive menu starts with all skill rows unchecked, first row is `Core OS skills (suggested starting point)`, no descriptions are rendered, and pressing Space on the core row visually selects Browser, Consuelo Design, Debugger, Handoff, Research Ingest, Senior Engineer, Skill Creator, and Task Workflow while leaving Optional skills unchecked.
- Green: `git diff --check` passed.

Implemented:
- `install.ts` now uses `groupMultiselect` for the skill step.
- Interactive skill rows are title-only: no description hints.
- Interactive initial values are empty so nothing starts selected.
- The cursor starts on `Core OS skills (suggested starting point)`.
- `Core OS skills` is selectable and visually toggles all core children.
- Optional group contains only Consuelo Workspace Snapshot and Daily Revenue Brief.

## issue and recovery: stream sync shell continuation

While syncing `stream/os-skills` with current `origin/main`, a temporary worktree failed to materialize because the machine ran out of space in `/var/folders/.../T`. The shell continued and pushed this task branch HEAD to `stream/os-skills`. The pushed HEAD was the stream/main sync base and did not include the uncommitted UX changes. Recovery check:
- `HEAD` and `origin/stream/os-skills` are now the same base commit.
- Working-tree diff is back to the intended seven files for this UX task.
- No force-push was used.
- Continue by validating/committing only the intended UX diff.

## workspace-owned: test selection

- changed files: `.task/os-skills/polish-installer-menu/current.json`, `.task/os-skills/polish-installer-menu/session.json`, `.task/os-skills/polish-installer-menu/workpad.md`, `.task/tasks/os-skills/polish-installer-menu.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/onboarding-skills.ts`, `packages/os/tests/onboarding-skills.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
