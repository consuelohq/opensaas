# finish office surfaces

branch: `task/sites/finish-office-surfaces`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1060/finish-office-surfaces
github pr: https://github.com/consuelohq/opensaas/pull/1060

## acceptance criteria

- [ ] Rename the top-level OS design artifact skill from `consuelo-design` to `office`.
- [ ] Keep legacy/internal implementation paths only where needed for compatibility; make user-facing skill/tool catalog language say Office.
- [ ] Update skill registry, skill docs, subskill default tools, workflow intent tests, generated manifests/docs/types, and facade tests to use `office.*` tool names.
- [ ] Preserve `design.publish`/`design.refresh` compatibility while categorizing the surface as Office.
- [ ] Avoid moving the vendored Open Design package tree unless a runtime source requires it; this prevents unrelated vendored package suites from becoming publish-gate blockers.
- [ ] Add or update tests that fail on stale `consuelo-design`/`consueloDesign` user-facing skill surfaces.
- [ ] Run focused OS/workspace validation, review, verify, then push and promote to the stream review PR.

## Test-first contract

Behavior under test:
- `office` is the active top-level OS skill.
- The old `consuelo-design` skill is no longer the user-facing active skill.
- Office subskills default to `office.*` facade tools.
- Office workflow bundles select `office.generateWebsite` alongside `design.publish`.
- Generated workspace types/docs/manifests expose `office.*` rather than `consueloDesign.*`.

Existing local pattern:
- `packages/os/tests/consuelo-design.test.ts` exercises the current skill through `executeCall`.
- `packages/os/tests/workflow-intent.test.ts`, `packages/os/tests/tool-manifest.test.ts`, and `packages/os/tests/facade.test.ts` protect manifest/tool surfaces.
- `packages/workspace/tests/facade/facade.test.ts` protects generated typed facade input contracts.

New/changed tests:
- Rename/update the skill contract test to `packages/os/tests/office-skill.test.ts` and make it expect `office` + `office.generateWebsite`.
- Update workflow/tool/facade tests to assert `office.*` names where this surface is active.

Focused red command:
`bun test --reporter dot packages/os/tests/office-skill.test.ts packages/os/tests/workflow-intent.test.ts packages/os/tests/tool-manifest.test.ts`

Expected red failure:
- `office` skill is missing and manifests still contain `consueloDesign.*`.

## current status

- Reopened existing task branch/session after previous local worktree expired.
- Remote task PR #1060 existed but had zero file changes; reapplying the implementation in this recovered task session.

## validation evidence

- pending

## files changed

- `packages/os/package.json`
- `packages/os/scripts/design/office-landing-page.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/skills.json`
- `packages/os/STEERING.md`
- `packages/os/tests/office-skill.test.ts`

## issues and recovery

- Previous local task session/worktree expired; recovered by `task.start` against existing `task/sites/finish-office-surfaces` PR #1060.
- Prior package-directory move selected unrelated vendored Open Design package suites. This implementation keeps the vendored package path as compatibility/internal unless runtime evidence requires a move.

- 2026-06-16 08:18:47 write: `.task/sites/finish-office-surfaces/workpad.md`

## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/scripts/design/office-landing-page.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/skills.json`
- `packages/os/STEERING.md`
- `packages/os/tests/office-skill.test.ts`

## workspace-owned: activity log

- 2026-06-16 08:18:47 fs.write: `.task/sites/finish-office-surfaces/workpad.md`
- 2026-06-16 08:19:07 write: `packages/os/tests/office-skill.test.ts`
- 2026-06-16 08:19:07 fs.write: `packages/os/tests/office-skill.test.ts`
- 2026-06-16 08:30:33 fs.write: `packages/os/package.json`
- 2026-06-16 08:31:10 fs.write: `packages/os/skills/skills.json`
- 2026-06-16 08:31:10 fs.write: `packages/os/scripts/design/office-landing-page.ts`
- 2026-06-16 08:40:52 fs.write: `packages/os/STEERING.md`
- 2026-06-16 08:40:53 fs.write: `packages/os/scripts/os.ts`

## workspace-owned: TDD red evidence

- 2026-06-16 08:19:13 `bun test --reporter dot packages/os/tests/office-skill.test.ts packages/os/tests/workflow-intent.test.ts packages/os/tests/tool-manifest.test.ts`: failed exit 1 trace: `trc_504a61805e61`
  - output: s' from '/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-sites-finish-office-surfaces/[eval]' Bun v1.3.14 (macOS arm64) at execFileSync (node:child_process:271:14) at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-sites-finish-office-surfaces/packages/os/tests/office-skill.test.ts:17:31) (fail) office skill > loads the orchestration guide and subskill presets [29.94ms] .............. 14 pass 1 fail 354 expect() calls Ran 15 tests across 3 files. [284.00ms] error: script "task:exec" exited with code 1
- 2026-06-16 08:19:22 `bun --cwd packages/os test --reporter dot tests/office-skill.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts`: failed exit 1 trace: `trc_0c6941bea373`
  - output: 0m 25|[39m `[39m))[33m;[39m [90m 26|[39m [90m 27|[39m [34mexpect[39m(result[33m.[39mok)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m [90m |[39m [31m^[39m [90m 28|[39m [34mexpect[39m(result[33m.[39mname)[33m.[39m[34mtoBe[39m([32m'office'[39m)[33m;[39m [90m 29|[39m [34mexpect[39m(result[33m.[39mpermission)[33m.[39m[34mtoBe[39m([32m'draft'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: files read

- `packages/consuelo-core/registry/skills.json`
- `packages/os/STEERING.md`
- `packages/os/package.json`
- `packages/os/scripts/design/consuelo-design.ts`
- `packages/os/scripts/design/office-landing-page.ts`
- `packages/os/scripts/design/office.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/office-landing-page/skill.json`
- `packages/os/skills/skills.json`
- `packages/os/tests/consuelo-design-landing-page.test.ts`
- `packages/os/tests/office-landing-page.test.ts`
- `packages/os/tests/office-skill.test.ts`
- `packages/os/tests/skills-registry.test.ts`
- `packages/twenty-shared/src/constants/DocumentationPaths.ts`

## workspace-owned: TDD green evidence

- 2026-06-16 08:26:15 `bun --cwd packages/os test --reporter dot tests/office-skill.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts`: failed exit 1 trace: `trc_224bb39c0af5`
  - output: [90m 4|[39m [35mfunction[39m [34mrunBunEval[39m(code[33m:[39m string)[33m:[39m string { [90m 5|[39m [35mreturn[39m [34mexecFileSync[39m([32m'bun'[39m[33m,[39m [[32m'-e'[39m[33m,[39m code][33m,[39m { [90m |[39m [31m^[39m [90m 6|[39m cwd[33m:[39m process[33m.[39m[34mcwd[39m()[33m,[39m [90m 7|[39m env[33m:[39m { [90m [2m❯[22m tests/office-skill.test.ts:[2m17:31[22m[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-16 08:26:30 `bun --cwd packages/os test --reporter dot tests/office-skill.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts`: failed exit 1 trace: `trc_14314ce129ae`
  - output: ./../Users/kokayi/Dev/opensaas/packages/os/node_modules/vite/dist/node/chunks/node.js:[2m3411:26[22m[39m [90m [2m❯[22m EnvironmentPluginContainer.transform ../../../../../../../../../../Users/kokayi/Dev/opensaas/packages/os/node_modules/vite/dist/node/chunks/node.js:[2m30164:51[22m[39m [90m [2m❯[22m loadAndTransform ../../../../../../../../../../Users/kokayi/Dev/opensaas/packages/os/node_modules/vite/dist/node/chunks/node.js:[2m24512:26[22m[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-16 08:26:52 `bun --cwd packages/os test --reporter dot tests/office-skill.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts`: passed exit 0 trace: `trc_4bbe50f24921`
  - output: → tmux: opensaas-sites-finish-office-surfaces-c37df820 $ vitest run --reporter dot tests/office-skill.test.ts tests/workflow-intent.test.ts tests/tool-manifest.test.ts

- 2026-06-16 08:30:33 write: `packages/os/package.json`

- 2026-06-16 08:31:10 write: `packages/os/skills/skills.json`

- 2026-06-16 08:31:10 write: `packages/os/scripts/design/office-landing-page.ts`

- 2026-06-16 08:40:52 write: `packages/os/STEERING.md`

- 2026-06-16 08:40:53 write: `packages/os/scripts/os.ts`
