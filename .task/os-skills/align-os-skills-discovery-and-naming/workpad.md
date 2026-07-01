# align os skills discovery and naming

branch: `task/os-skills/align-os-skills-discovery-and-naming`
stream: `stream/os-skills`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/716/align-os-skills-discovery-and-naming
github pr: https://github.com/consuelohq/opensaas/pull/716
started: 2026-06-03

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

- 2026-06-03 17:20:06 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/capabilities.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/skills.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills.md`
- `packages/os/skills/consuelo-design/skill.json`
- `packages/os/skills/skills.json`
- `packages/os/skills/task/SKILL.md`
- `packages/os/skills/task/skill.json`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/skill-migration.test.ts`

## 2026-06-02 install-time skill materialization

Approved scope: seed bundled OS skills into the installed user OS home instead of leaving the installed skills folder empty.

Implemented:

- provisionLocalOs() now calls seedBundledSkills(home, dryRun).
- Bundled package skills from packages/os/skills/* are copied to <home>/skills/<skill-name>/.
- Installed skill.json files are made portable by rewriting load.path to skills/<name>/<entrypoint>.
- Each bundled installed skill gets <home>/skills/<name>/.consuelo-skill.json with source/hash/install timestamps.
- Existing local/user skills without bundled metadata are preserved and included in the installed registry.
- <home>/skills/skills.json is written from the installed skill store.
- Bundled skills with local edits are preserved instead of overwritten.

Validation:

- bun --cwd packages/os test tests/install-state.test.ts: passed, 5 tests.
- cd packages/os && bun run generate-skills-registry: passed, wrote 5 bundled skills.
- cd packages/os && bun test tests/skills-registry.test.ts: passed, 7 tests.
- cd packages/os && node ./scripts/check-syntax.js: passed.
- git diff --check: passed.

## workspace-owned: test selection

- changed files: `.task/os-skills/align-os-skills-discovery-and-naming/current.json`, `.task/os-skills/align-os-skills-discovery-and-naming/evidence-log.json`, `.task/os-skills/align-os-skills-discovery-and-naming/read-log.json`, `.task/os-skills/align-os-skills-discovery-and-naming/session.json`, `.task/os-skills/align-os-skills-discovery-and-naming/workpad.md`, `.task/tasks/os-skills/align-os-skills-discovery-and-naming.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/skills.ts`, `packages/os/skills/skills.json`, `packages/os/skills/task/SKILL.md`, `packages/os/skills/task/skill.json`, `packages/os/tests/fixtures/skills/task-os-replacements.json`, `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/skill-migration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
