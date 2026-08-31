# Add skill CLI from stream

branch: `task/os/add-skill-cli-from-stream`
stream: `stream/os`

## acceptance criteria

- [x] Verify the canonical skill source/config/materialization model from current `stream/os` code, including exactly what each `skills.json` represents and where it is written.
- [x] Verify the existing `branch` skill is structurally valid, selected/materialized correctly, discoverable by steering, and covered by install/steering tests.
- [x] Add native `consuelo add skill` and `consuelo remove skill` commands using the existing onboarding terminal interaction pattern.
- [x] `consuelo add skill` interactively lists only bundled skills not currently selected; `consuelo remove skill` lists only selected bundled skills. Display labels are the skill names only.
- [x] Support an explicit non-interactive skill name path for scripting/tests while preserving the interactive selector as the default UX.
- [x] Add/remove mutate the canonical selected-skill configuration and refresh every derived/materialized surface through one existing install/control-plane path; do not hand-edit multiple copies.
- [x] Preserve user-owned custom skills and runtime disabled-skill overlay semantics.
- [x] Add focused TDD coverage for selection logic, persistence/materialization, CLI parsing/UX contract, and branch skill discovery.
- [x] Update `packages/os/SCRIPTS.md` with the lifecycle skill-management contract and examples.
- [x] Pass strict review and full verify; publish into `stream/os` remains.

## plan

1. Map skill truth: repo bundle -> config selection -> managed index -> visible `~/Consuelo/Skills` -> steering.
2. Inspect installer/onboarding prompt implementation and the `consuelo` lifecycle dispatcher, including terminal UI dependencies.
3. Write focused RED tests for add/remove control-plane behavior and CLI dispatch/selection.
4. Implement the simplest shared skill-selection API and CLI wrapper using the existing installer renderer/prompt stack.
5. Verify with isolated temp homes, including `branch` add/remove and steering output.
6. Run diff review, strict review, full verify, push, and merge task into `stream/os`.

## discovery

- This task was deliberately started with `startFrom: stream`, source SHA `8e73964d`, so the prior branch-skill/steering implementation is present.
- Superseded bootstrap PR #1841 was created from `main` and has no production edits; do not use it for implementation.
- Skill state has distinct surfaces: bundled source/catalog (`packages/os/skills` + generated `packages/os/skills/skills.json`), durable selection (`<CONSUELO_HOME>/config.json.selectedSkills`), derived active index (`<CONSUELO_HOME>/components/installed-skills.json`), visible managed materialization (`~/Consuelo/Skills/<name>`), and visible full catalog (`~/Consuelo/Skills/skills.json`). New installs do not use a hidden `<CONSUELO_HOME>/skills` tree; that path is legacy compatibility only.
- `provisionManagedComponentIndexes()` already owns safe visible add/remove semantics: clean deselection deletes the visible managed skill and provenance; a locally modified skill is preserved with `remove-upstream` + `requiresReview`.
- Installer UX uses `@clack/prompts` `groupMultiselect`; both `@clack/prompts` and Chalk are already dependencies in OS and the top-level CLI.
- The top-level Commander CLI already delegates `consuelo update` to `<CONSUELO_HOME>/bin/consuelo`, so skill commands should follow the same product routing pattern.
- Runtime bundles are rooted at the OS package and include bundled skill files directly as the `managed-skill` role. The managed installed-skill index previously copied source metadata such as `packages/os/skills/branch/SKILL.md`, which is valid in the repo but not in an installed `runtime/current` bundle. Managed skill materialization must rewrite `load.path` to `skills/<name>/<entrypoint>` in both the visible `skill.json` and active index.
- The generated full catalog had the same source-path mismatch. `packages/os/skills/skills.json` is now normalized to runtime-relative `skills/<name>/<entrypoint>` paths before it is bundled and refreshed to `~/Consuelo/Skills/skills.json`, so source/dev fallback steering and the visible catalog agree with the active index.

## Test-first contract

Behavior under test:
- `consuelo add skill branch` updates `config.json.selectedSkills`, `components/installed-skills.json`, materializes `~/Consuelo/Skills/branch`, and makes the installed steering catalog advertise `branch`.
- `consuelo remove skill branch` reverses those managed surfaces for an unchanged bundled skill.
- removing a locally modified bundled skill deselects it but preserves its visible files and leaves an explicit managed-component review item.
- interactive add receives only unselected bundled skill names; interactive remove receives only selected bundled skill names.
- the top-level Commander CLI registers `add skill` and `remove skill` and delegates them to the installed `<CONSUELO_HOME>/bin/consuelo` lifecycle command, including global JSON/quiet flags.

Local test patterns reused:
- `packages/os/tests/lifecycle-engine.test.ts` invokes `runLifecycleCli()` with dependency injection for stdout/stderr.
- `packages/os/tests/cli-update-routing.test.ts` characterizes top-level CLI delegation to the installed OS lifecycle command.
- `packages/os/tests/managed-components.test.ts` already proves clean deselection removes visible skill content while local modifications are preserved for review.

Focused RED commands:
- `cd packages/os && bun test tests/skill-selection-cli.test.ts`
- `cd packages/os && bun test tests/cli-skill-routing.test.ts`

Expected RED before production implementation:
- lifecycle tests reject `add`/`remove` as unknown commands.
- CLI routing test cannot resolve the not-yet-created `packages/cli/src/commands/skills.ts` module.

## current status

Implementation, focused/broad validation, strict review, and full verify are green. Publish remains.

## key decisions

- Current code/tests, not earlier chat wording, decide what `skills.json` means and where it belongs.
- Reuse the installer/onboarding interaction library and existing provisioning primitives; do not introduce a parallel CLI framework unless evidence shows one is necessary.
- Keep durable user intent in `config.json.selectedSkills`; treat `components/installed-skills.json` as a derived active index, not the configuration source of truth.
- Keep `~/Consuelo/Skills/skills.json` as the full bundled catalog and `~/Consuelo/Skills/<name>` as selected materialization. Hidden `<CONSUELO_HOME>/skills` remains legacy compatibility only.
- Normalize installed/bundled discovery metadata to package-root-relative `skills/<name>/<entrypoint>` paths because runtime releases are rooted at the OS package.

## validation evidence

- RED: lifecycle add/remove tests 0/5 because the commands did not exist; top-level routing RED was module-not-found for `packages/cli/src/commands/skills.ts`.
- RED: after initial implementation, 4/5 skill-selection tests passed and the remaining failure isolated the non-portable installed `load.path`.
- GREEN: `tests/skill-selection-cli.test.ts` -> 5/5, including config, active index, visible selected tree, visible full catalog, and steering discovery for `branch`.
- GREEN: `tests/cli-skill-routing.test.ts` -> 2/2.
- GREEN: `tests/managed-components.test.ts tests/install-state.test.ts` -> 43/43, 348 assertions.
- GREEN: steering/registry/onboarding/update-routing/new CLI set -> 29/29, 143 assertions.
- GREEN: `tests/lifecycle-engine.test.ts` -> 52/52, 145 assertions.
- GREEN: `tests/skills-registry.test.ts tests/distribution/runtime-bundle.test.ts` -> 28/28, 157 assertions; direct manifest inspection confirms all three `branch` files ship as `managed-skill`.
- GREEN: final registry/selection/runtime bundle set -> 33/33, 183 assertions.
- GREEN: `packages/os` syntax check passed.
- GREEN: isolated TypeScript check for `packages/cli/src/commands/skills.ts` passed and the module imports successfully under Bun.
- GREEN: `git diff --check` passed.
- Whole `packages/cli` `tsc --noEmit` still hits the pre-existing optional `twenty-sdk/cli` resolution errors in `src/index.ts`; isolated changed-file type validation is clean.
- GREEN: strict `review.run --mine --no-tests` -> 0 owned issues / 0 blocking issues; only the two pre-existing optional `twenty-sdk/cli` typecheck findings remain.
- GREEN: full `verify --base origin/stream/os` -> `passed: true`, `publishValid: true`, DB guard clean.
- Git ancestry check after a misleading `task.ensureSynced` counter: `origin/stream/os` is the direct ancestor of the task (`0 behind / 1 ahead`, merge-base exactly stream head `8e73964d`).

## issues and recovery

- Initial task #1841 accidentally started from `main`; created this correctly based stream task instead of risking a task PR that removed stream-only skill work.
- RED lifecycle command: `bun test tests/skill-selection-cli.test.ts` -> 0 pass / 5 fail, all five returning exit code 2 because `add`/`remove` are not recognized yet.
- RED top-level routing: `bun test tests/cli-skill-routing.test.ts` -> expected module-not-found for the not-yet-created `packages/cli/src/commands/skills.ts`.
- Follow-up wiring RED after CLI implementation: 4/5 skill-selection tests passed; the single failure proved the active index still advertised source-only `packages/os/skills/branch/SKILL.md` instead of runtime-portable `skills/branch/SKILL.md`.
- Release-bundle audit correction: an initial characterization incorrectly expected skill files to have role `runtime`, causing 19/20 runtime-bundle tests to pass. Direct manifest inspection proved `skills/branch/SKILL.md`, `skill.json`, and `agents/openai.yaml` are all shipped correctly with role `managed-skill`; the test expectation was corrected rather than changing bundle logic.
- Wait reason: task-scoped command execution began returning repeated MCP network errors after successful focused GREEN runs; file reads remained healthy.
  Duration: 15s.
  Resume action: run a minimal task-scoped `bun --version` command immediately after wake.
  Expected signal: normal command output/exit 0, proving the execution path recovered.
  Fallback: stop retrying long `code.call` commands and use the repository review/verify surfaces plus already-captured focused GREEN evidence.
- Wait outcome: the timed `wait` response itself lost its MCP connection, but the immediate wake check `bun --version` succeeded with Bun 1.3.14 / exit 0. Command execution recovered, so validation resumed with smaller bounded suites.
- A stream sync check reported the stream itself was already up to date with main. Its temporary-worktree verification hit a missing `zod` dependency in the workspace-facade test and therefore pushed nothing; this does not affect the task, whose own full verify is publish-valid. Direct Git ancestry disproved the stale `behind: 80` task metadata signal.

- 2026-08-11 21:43:52 write: `.task/os/add-skill-cli-from-stream/workpad.md`

## files changed

- `packages/cli/src/index.ts`
- `packages/cli/src/commands/skills.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/skill-selection.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/skills/skills.json`
- `packages/os/tests/cli-skill-routing.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/skill-selection-cli.test.ts`
- `packages/os/tests/skills-registry.test.ts`

## workspace-owned: files changed

- `packages/cli/src/commands/skills.ts`
- `packages/os/scripts/lib/skill-selection.ts`
- `packages/os/tests/cli-skill-routing.test.ts`
- `packages/os/tests/skill-selection-cli.test.ts`

## workspace-owned: activity log

- 2026-08-11 21:43:52 fs.write: `.task/os/add-skill-cli-from-stream/workpad.md`
- 2026-08-11 21:47:39 fs.write: `packages/os/tests/skill-selection-cli.test.ts`
- 2026-08-11 21:47:39 fs.write: `packages/os/tests/cli-skill-routing.test.ts`
- 2026-08-11 21:49:42 fs.write: `packages/os/scripts/lib/skill-selection.ts`
- 2026-08-11 21:49:42 fs.write: `packages/cli/src/commands/skills.ts`

## workspace-owned: files read

- `packages/cli/package.json`
- `packages/cli/src/commands/os.ts`
- `packages/cli/src/commands/queue.ts`
- `packages/cli/src/commands/update.ts`
- `packages/cli/src/index.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/managed-components.ts`
- `packages/os/scripts/lib/managed-user-content-release.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/onboarding-skills.ts`
- `packages/os/scripts/lib/skill-selection.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/skills/branch/SKILL.md`
- `packages/os/skills/branch/skill.json`
- `packages/os/skills/skills.json`
- `packages/os/skills/task/skill.json`
- `packages/os/tests/cli-update-routing.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/installer-onboarding-ui.test.ts`
- `packages/os/tests/managed-components.test.ts`
- `packages/os/tests/skills-registry.test.ts`
- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/scripts/lib/task-selection.js`

## workspace-owned: validation evidence

- RED: lifecycle add/remove tests 0/5 because the commands did not exist; top-level routing RED was module-not-found for `packages/cli/src/commands/skills.ts`.
- RED: after initial implementation, 4/5 skill-selection tests passed and the remaining failure isolated the non-portable installed `load.path`.
- GREEN: `tests/skill-selection-cli.test.ts` -> 5/5, including config, active index, visible selected tree, visible full catalog, and steering discovery for `branch`.
- GREEN: `tests/cli-skill-routing.test.ts` -> 2/2.
- GREEN: `tests/managed-components.test.ts tests/install-state.test.ts` -> 43/43, 348 assertions.
- GREEN: steering/registry/onboarding/update-routing/new CLI set -> 29/29, 143 assertions.
- GREEN: `tests/lifecycle-engine.test.ts` -> 52/52, 145 assertions.
- GREEN: `tests/skills-registry.test.ts tests/distribution/runtime-bundle.test.ts` -> 28/28, 157 assertions; direct manifest inspection confirms all three `branch` files ship as `managed-skill`.
- GREEN: final registry/selection/runtime bundle set -> 33/33, 183 assertions.
- GREEN: `packages/os` syntax check passed.
- GREEN: isolated TypeScript check for `packages/cli/src/commands/skills.ts` passed and the module imports successfully under Bun.
- GREEN: `git diff --check` passed.
- Whole `packages/cli` `tsc --noEmit` still hits the pre-existing optional `twenty-sdk/cli` resolution errors in `src/index.ts`; isolated changed-file type validation is clean.
- 2026-08-11 22:00:46 `review.run`: passed — OK
- 2026-08-11 22:00:47 `review.run`: passed — OK
- 2026-08-11 22:01:02 apply-patch: `packages/os/scripts/lifecycle.ts`
- 2026-08-11 22:01:24 `review.run`: passed — OK
- 2026-08-11 22:01:44 `verify`: passed — OK
- 2026-08-11 22:02:46 apply-patch: `.task/os/add-skill-cli-from-stream/workpad.md`
- 2026-08-11 22:02:54 `verify`: passed — OK

- 2026-08-11 22:04:02 apply-patch: `.task/os/add-skill-cli-from-stream/current.json`