# add os skills registry generator

branch: `task/os/add-os-skills-registry-generator`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/619/add-os-skills-registry-generator
github pr: https://github.com/consuelohq/opensaas/pull/619
started: 2026-05-28

## acceptance criteria

- [x] Add Bun-compatible generator at `packages/os/scripts/generate-skills-registry.ts`.
- [x] Read top-level `packages/os/skills/*/skill.json` files.
- [x] Write generated `packages/os/skills/skills.json`.
- [x] Registry shape is `{ version: 1, skills: [...] }`, sorted by `name`.
- [x] Registry keeps compact metadata only: `name`, `title`, `description`, `trigger`, `entrypoint`, `load`, `permission`, `requiresApproval`, `status`, `capabilities`, `tools`, `subskills`.
- [x] Registry does not inline `SKILL.md` content or full subskill bodies.
- [x] Generator fails for missing required fields and missing entrypoint/load paths.
- [x] Focused tests cover task skill, existing skills, sorting, no markdown bodies, malformed metadata, and missing paths.
- [x] Package script added for generated validation.
- [x] Generated registry committed.

## plan

1. Inspect current OS skill metadata and package script/test conventions.
2. Add generator with reusable build/write functions for tests.
3. Add compact progressive-disclosure metadata fields to existing skill manifests.
4. Add focused registry tests.
5. Generate `packages/os/skills/skills.json`.
6. Run focused validation, review, and verify recovery path.
7. Push and promote into `stream/os`.

## current status

- Ready to publish.

## files changed

- `packages/os/package.json`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/skills/consuelo-design-landing-page/skill.json`
- `packages/os/skills/consuelo-design/skill.json`
- `packages/os/skills/consuelo-workspace-snapshot/skill.json`
- `packages/os/skills/daily-revenue-brief/skill.json`
- `packages/os/skills/skills.json`
- `packages/os/tests/skills-registry.test.ts`

## key decisions

- Existing executable skills now include registry-required progressive-disclosure fields in `skill.json`.
- Skills that already have `SKILL.md` use it as `entrypoint` / `load.path`.
- Older executable skills without `SKILL.md` use `skill.json` as their compact entrypoint so this task stays scoped to registry metadata and does not create new manuals.
- The generator enforces required fields instead of filling defaults, so malformed metadata exits non-zero.
- The generator omits runtime-only fields such as `script`, `artifactTypes`, `deprecated`, and `supersededBy` from `skills.json`.

## validation evidence

- `bun --cwd packages/os generate-skills-registry`: passed, wrote 5 skills.
- `bun --cwd packages/os test tests/skills-registry.test.ts`: passed, 7 tests.
- `bun --cwd packages/os test tests/install-state.test.ts`: passed, 4 tests.
- `bun --cwd packages/os typecheck`: passed, `workspace script syntax checks passed`.
- `git.diff`: inspected changed files and generated registry.
- `review.run` against `origin/stream/os`: passed, 0 blocking issues after replacing `console.*` with stdout/stderr writes.
- `verify` against `origin/stream/os`: failed on stale `review.js --summary-json` and missing `test-selection.js` path.
- `bun packages/workspace/scripts/verify.js --base origin/stream/os --no-review --json --quiet`: passed DB/file-risk guard after direct `review.run` succeeded.

## issues and recovery

- Initial registry test failed because the generator filled missing `trigger` by default. Fixed generator to validate raw metadata and fail missing required fields.
- Initial review failed on `console.log`/`console.error` in the CLI path. Replaced with `process.stdout.write` and `process.stderr.write`.
- Normal verify still has the known stale `--summary-json` issue. Used the accepted recovery path: direct `review.run`, then `verify.js --no-review`.

## notes for Ko

- Did not rewrite `packages/os/skills/task/SKILL.md`.
- Did not touch public spec/wiki.

## publish checklist

```bash
bun run task:push -- --message "feat(os): add skills registry generator" --changed
bun run task:pr
```

- 2026-05-28 20:14:45 write: `.task/os/add-os-skills-registry-generator/workpad.md`

## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/skills/consuelo-design-landing-page/skill.json`
- `packages/os/skills/consuelo-design/skill.json`
- `packages/os/skills/consuelo-workspace-snapshot/skill.json`
- `packages/os/skills/daily-revenue-brief/skill.json`
- `packages/os/skills/skills.json`
- `packages/os/tests/skills-registry.test.ts`

## workspace-owned: activity log

- 2026-05-28 20:14:45 fs.write: `.task/os/add-os-skills-registry-generator/workpad.md`
