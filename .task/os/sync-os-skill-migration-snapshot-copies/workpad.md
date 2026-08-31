# sync os skill-migration snapshot copies

branch: `task/os/sync-os-skill-migration-snapshot-copies`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2324
started: 2026-08-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/skills/task/SKILL.md`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`
- `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- `packages/os/tests/fixtures/skills/task-os-replacements.json`
- `packages/os/tests/senior-engineer-skill.test.ts`


## key decisions

- none yet

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

## Test-first contract

behavior under test: packages/os/skills/<name>/SKILL.md must match packages/os/tests/fixtures/skills/<name>-* after the documented replacements, so Consuelo / verify skill-migration.test.ts stays green on stream/os.
existing local pattern: packages/os/tests/skill-migration.test.ts verbatim-copy assertion against workspace fixtures.
new or changed tests: none unless the fixture/replacements table is the source of truth and needs an extra skill listed; first action is reproduce the existing red assertion.
focused red command: bun test tests/skill-migration.test.ts
expected red failure: AssertionError at skill-migration.test.ts:50 expect(actual).toBe(expected) for the OS task skill vs fixture+replacements.
no-test waiver: not applicable

## plan

1. reproduce the red skill-migration test in this stream worktree.
2. identify which files drifted: OS SKILL.md, workspace fixture, or replacements table.
3. sync copies without weakening product assertions.
4. re-run the focused test and any sibling snapshot tests (steering-canonical-source).
5. push into stream/os PR 2310, wait Consuelo / verify, then release canary.

- 2026-08-31 03:23:21 append: `.task/os/sync-os-skill-migration-snapshot-copies/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/senior-engineer-skill.test.ts`

## workspace-owned: activity log

- 2026-08-31 03:23:21 fs.write: `.task/os/sync-os-skill-migration-snapshot-copies/workpad.md`
- 2026-08-31 03:30:18 fs.write: `packages/os/tests/senior-engineer-skill.test.ts`

## workspace-owned: files read

- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/skills/senior-engineer/skill.json`
- `packages/os/skills/skill-creator/SKILL.md`
- `packages/os/tests/fixtures/skills/task-os-replacements.json`
- `packages/os/tests/senior-engineer-skill.test.ts`
- `packages/os/tests/skill-migration.test.ts`
- `packages/os/tests/skills-registry.test.ts`
- `packages/os/tests/steering-canonical-source.test.ts`
- `packages/os/vitest.config.ts`

## workspace-owned: validation evidence

- 2026-08-31 03:31:18 `review.run`: passed — OK
