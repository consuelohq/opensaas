# build os manifest registry and core manifest

branch: `task/os-manifest/build-os-manifest-registry-and-core-manifest`
stream: `stream/os-manifest`
task pr: https://app.graphite.com/github/pr/consuelohq/opensaas/718/build-os-manifest-registry-and-core-manifest
github task pr: https://github.com/consuelohq/opensaas/pull/718
started: 2026-06-03

## objective

Build the first clean OS manifest-registry pass: consolidate the regular OS tool manifest and dev tooling manifest into one canonical full manifest, generate a core manifest subset from config, preserve every existing manifest entry, and keep extended tools discoverable through tool search.

## acceptance criteria

- [x] Inventory current OS manifest sources before editing.
- [x] Record path, entry count, entry names, generated/source ownership, current consumers, and tests for each source.
- [x] Add or update manifest generation so the canonical full manifest and core manifest are reproducibly generated from source/config.
- [x] Preserve every existing regular and dev manifest entry in the new full manifest.
- [x] Generate a first-pass core manifest with filesystem, task, stream, review/verify, GitHub/gh compatibility, mac, tools.search, status, doctor, tmp, code.run, and context tools where present.
- [x] Keep Linear, Sentry, Railway, website deploy, design/studio, and other niche tools out of core unless current runtime requires them.
- [x] Prove a non-core tool remains findable through `tools.search` or the OS equivalent.
- [x] Keep existing OS skills registry behavior passing.
- [x] Run focused generation/tests, `git diff --check`, `review.run`, and `verify`.
- [x] Push and promote to a stream review PR from `stream/os-manifest` to `main`.

## initial assumptions

- This is a fresh stream created from `main` because `origin/stream/os-manifest` did not exist before `task.start`.
- Historical context says `packages/os/tooling/tool-manifest.json` is the regular/default manifest and `packages/os/tooling/dev-tool-manifest.json` preserved operator/dev facade entries.
- Workspace patterns are evidence for shape and validation, but OS package conventions should own the final implementation.

## context gathered

- `workspace.get_steering` loaded for this conversation.
- Read `CODING-STANDARDS.md` fully.
- Read `packages/os/skills/task/SKILL.md` and `packages/os/skills/task/skill.json`.
- `context.search` for `manifest` found the prior OS manifest split workpad.
- `context.search` for `os skills` found the OS skills registry generator workpad and known verify recovery path.
- `explore` was broad and not decisive for OS manifest implementation paths.
- `stream.context` found prior task `task/os/align-os-manifest-and-script-runtime` showing the regular/dev manifest split.

## plan

1. Inventory manifest-like files and current consumers/tests.
2. Read OS manifest/generator/runtime patterns and the workspace facade manifest pattern for comparison.
3. Fill the test-first contract with exact behavior, red command, and expected failure.
4. Add focused tests before implementation.
5. Implement the generator/config/full/core manifest outputs with preservation checks.
6. Generate artifacts and run focused validations.
7. Inspect diff, run review/verify, push, and promote to stream review PR.

## manifest inventory

Source files found before editing:

| path | entries | ownership | generated/source | current consumers/tests |
| --- | ---: | --- | --- | --- |
| `packages/os/tooling/tool-manifest.json` | 4 | regular OS skill manifest | source-owned JSON | `scripts/lib/manifest.ts`, `scripts/os.ts`, `server.py`, `scripts/lib/skills.ts`, `scripts/lib/local-guardrails.ts`, docs in `docs/runtime-surfaces.md`, `skills.md`, `docs/skills.md` |
| `packages/os/tooling/dev-tool-manifest.json` | 128 | dev/operator typed facade manifest | source-owned JSON copied/restored from workspace facade | `scripts/lib/facade/executor.ts`, `scripts/generate-docs.ts`, `scripts/generate-types.ts`, `scripts/tools-search.ts`, `scripts/os.ts` dev steering, `server.py` dev steering, generated `TOOLS.md`, facade snapshots |
| `packages/os/tooling/tool-manifest.schema.json` | n/a | schema/helper | source-owned schema | currently no direct consumer found in `packages/os` search |
| `packages/os/scripts/lib/manifest.ts` | n/a | runtime loader | source-owned TS | reads the regular manifest for OS `call`, skill validation, and guardrails |
| `packages/os/scripts/tools-search.ts` | n/a | tool discovery runtime | source-owned TS | currently searches only `dev-tool-manifest.json`; must search the generated full manifest after this task |

Regular manifest entry names:

```text
consuelo-design
consuelo-design-landing-page
consuelo-workspace-snapshot
daily-revenue-brief
```

Dev/operator manifest entry names:

```text
aiReview, audit, browser, browser.app, browser.click, browser.clipboard, browser.close, browser.consuelo, browser.cookies, browser.dialog, browser.download, browser.eval, browser.fill, browser.find, browser.get, browser.login, browser.network, browser.open, browser.raw, browser.reauth, browser.screenshot, browser.snap, browser.tabs, browser.test, browser.trace, browser.wait, checkFiles, code.run, confidenceScore, confirm, consueloDesign.check, consueloDesign.generateDemo, consueloDesign.generateDigitalEguide, consueloDesign.generateEmail, consueloDesign.generateImageBrief, consueloDesign.generateMotionFrame, consueloDesign.generateWebsite, consueloDesign.getDesignSystem, consueloDesign.listDesignSystems, consueloDesign.listSkills, consueloDesign.odBuild, consueloDesign.railwayCheck, consueloDesign.renderHyperframes, consueloDesign.run, consueloDesign.uiBg, consueloDesign.uiLogs, consueloDesign.uiStatus, consueloDesign.uiStop, consueloDesign.upstreamStatus, context.categories, context.find, context.get, context.list, context.save, context.search, context.trace, decideNext, design.publish, design.refresh, doctor, editFlow, exploit, explore, fs.list, fs.patch, fs.read, fs.search, fs.trash, fs.write, generate.docs, generate.types, gh, git.diff, git.status, github, http, linear.createIssue, linear.issue, linear.labels, linear.projects, linear.search, linear.states, linear.teams, linear.updateIssue, mac.call, mac.exec, mac.list, mac.port, mac.process, mac.read, mac.search, mac.write, prReview, railway.logs, railway.redeploy, research.ingest, review.run, sentry.config, sentry.event, sentry.issue, sentry.issueEvent, sentry.issues, sentry.projects, sentry.trace, server, status, stream.context, stream.list, stream.sync, task.call, task.cleanup, task.current, task.ensureSynced, task.exec, task.finish, task.init, task.merge, task.pr, task.prs, task.push, task.start, taskMeta.smoke, tmp, tools.search, verify, wait, website.deploy, worker.call
```

Preservation baseline:

- Old regular count: 4.
- Old dev/operator count: 128.
- Duplicate names: none.
- Required generated full manifest count: 132.
- Preservation assertion: `oldRegularToolNames union oldDevToolNames == newFullToolNames`.

Consumer decision:

- Generate a tagged canonical full manifest so the two existing schemas are preserved exactly instead of forcing a lossy conversion.
- Runtime OS skills can read the full manifest and filter `kind: "os-skill"` back to the existing `OsManifestEntry` shape.
- Facade execution can continue to execute typed facade definitions while tool search indexes the generated full manifest so regular non-core OS skills are discoverable.
- Core is generated from the full manifest by config using include names/prefixes and exclude provider families.

## Test-first contract

Behavior under test:

- The tool manifest generator reads the regular OS skill manifest and dev/operator typed facade manifest and writes a canonical full manifest plus a core subset.
- The full manifest preserves every original entry by name and exact original definition, with no missing entries.
- Duplicate tool names fail generation instead of silently dropping a definition.
- The core manifest includes first-pass core families and task workflow tools: `fs.*`, `task.*`, `stream.*`, `mac.*`, `context.*`, `tools.search`, `status`, `doctor`, `tmp`, `code.run`, `github`, `gh`, `review.run`, `verify`, `git.diff`, `git.status`, `checkFiles`, `audit`, decision-engine helpers.
- The core manifest excludes first-pass non-core provider families: Linear, Sentry, Railway, website deploy, browser, design, and Consuelo Design.
- `tools.search` indexes the generated full manifest so a non-core regular OS skill such as `daily-revenue-brief` remains discoverable outside core.

Existing pattern to follow:

- `packages/os/scripts/generate-skills-registry.ts` exports pure build/generate functions, validates raw metadata, writes deterministic JSON, and has focused Vitest coverage in `packages/os/tests/skills-registry.test.ts`.
- `packages/os/scripts/tools-search.ts` already builds searchable cards from a manifest; this task should change its manifest source and projection, not rewrite search ranking.
- `packages/os/scripts/lib/manifest.ts` is the current OS skill loader and should preserve the `readManifest()` / `findManifestEntry()` public behavior for existing OS calls.

Intended tests:

- Add `packages/os/tests/tool-manifest.test.ts` covering full/core generation, preservation, duplicate failure, and tool-search discovery of a regular non-core OS skill.
- Keep `packages/os/tests/skills-registry.test.ts` passing.

Focused red command:

```bash
bun --cwd packages/os test tests/tool-manifest.test.ts
```

Expected red failure:

- The new test should fail because `packages/os/scripts/generate-tool-manifest.ts` does not exist and `tools-search.ts` does not yet export a testable search function over the generated full manifest.

No-test waiver:

- None.

## files changed

- `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`
- `.task/tasks/os-manifest/build-os-manifest-registry-and-core-manifest.json`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/docs/skills.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/manifest.config.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/server.py`
- `packages/os/skills.md`
- `packages/os/STEERING.md`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/TOOLS.md`

## validation evidence

- Red test observed: `bun --cwd packages/os test tests/tool-manifest.test.ts` initially failed before the generator/search export was wired.
- `bun --cwd packages/os generate-tool-manifest`: passed; wrote `tool.manifest.json` with 132 tools and `core.manifest.json` with 54 tools.
- Preservation proof in `packages/os/tests/tool-manifest.test.ts`: old regular names (4) plus old dev/operator names (128) equal the generated full manifest names (132), and original definitions are preserved under each generated entry.
- Core proof in `packages/os/tests/tool-manifest.test.ts`: first-pass core families are present, while Linear, Sentry, Railway, website deploy, browser, design, and Consuelo Design entries are excluded from core.
- Tool-search proof in `packages/os/tests/tool-manifest.test.ts`: non-core regular OS skill `daily-revenue-brief` remains discoverable through `runToolSearch` over the generated full manifest.
- `bun --cwd packages/os generate-docs`: passed; regenerated `TOOLS.md` from the canonical full manifest.
- `bun --cwd packages/os generate-types`: passed; regenerated facade type stubs from the canonical full manifest.
- `bun --cwd packages/os generate-skills-registry`: passed; wrote `packages/os/skills/skills.json` with 5 skills.
- `bun --cwd packages/os test tests/tool-manifest.test.ts tests/skills-registry.test.ts tests/facade/facade.test.ts`: passed; 548 tests.
- `bun --cwd packages/os typecheck`: passed.
- `bun --cwd packages/os get-steering`: passed.
- `bun --cwd packages/os get-dev-steering`: passed.
- `git diff --check`: passed.
- Full `bun --cwd packages/os test` was attempted separately and failed on the existing Vitest/Bun runner limitation resolving `bun:sqlite` in `tests/doctor-redaction.test.ts`; focused manifest, registry, and facade coverage passed.
- `review.run`: passed after the workpad evidence update; no must-fix findings.
- `verify`: passed after the workpad evidence update; `publishValid: true` and stamp written to `.task/os-manifest/build-os-manifest-registry-and-core-manifest/verify.json`.

## issues and recovery

- First attempted `fs.read` before `task.start`; workspace returned `TASK_SESSION_REQUIRED`. Recovered by starting the task and passing `taskSession` at top level.
- `stream.sync` failed because `origin/stream/os-manifest` did not exist. `task.start` created the new remote stream from `main` and the task branch from that source.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add generated manifest registry" --changed
bun run task:pr
```
- 2026-06-03 01:56:15 patch lines 1-68: `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`

## workspace-owned: files changed

- `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`
- `.task/tasks/os-manifest/build-os-manifest-registry-and-core-manifest.json`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/docs/skills.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/manifest.config.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/server.py`
- `packages/os/skills.md`
- `packages/os/STEERING.md`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/TOOLS.md`

## workspace-owned: activity log

- 2026-06-03 02:01:30 fs.patch: `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`
- 2026-06-03 02:03:01 fs.write: `packages/os/tests/tool-manifest.test.ts`
- 2026-06-03 02:06:17 fs.write: `packages/os/scripts/generate-tool-manifest.ts`
- 2026-06-03 02:06:18 fs.write: `packages/os/manifests/manifest.config.json`
- 2026-06-03 02:06:34 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:06:56 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:07:02 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:07:19 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:07:42 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:08:13 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:11:21 fs.patch: `packages/os/scripts/lib/manifest.ts`
- 2026-06-03 02:11:41 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:12:30 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:12:48 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:13:28 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:13:44 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-03 02:13:58 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-03 02:14:17 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-03 02:14:30 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-03 02:14:46 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-03 02:14:50 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-03 02:14:57 fs.patch: `packages/os/server.py`
- 2026-06-03 02:15:17 fs.patch: `packages/os/server.py`
- 2026-06-03 02:15:28 fs.patch: `packages/os/server.py`
- 2026-06-03 02:15:37 fs.patch: `packages/os/server.py`
- 2026-06-03 02:15:55 fs.patch: `packages/os/server.py`
- 2026-06-03 02:16:03 fs.patch: `packages/os/server.py`
- 2026-06-03 02:16:18 fs.patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-06-03 02:16:28 fs.patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-06-03 02:16:51 fs.patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-06-03 02:17:18 fs.patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-06-03 02:17:29 fs.patch: `packages/os/scripts/generate-docs.ts`
- 2026-06-03 02:17:30 fs.patch: `packages/os/scripts/generate-types.ts`
- 2026-06-03 02:17:55 fs.patch: `packages/os/scripts/generate-docs.ts`
- 2026-06-03 02:18:02 fs.patch: `packages/os/scripts/generate-types.ts`
- 2026-06-03 02:18:12 fs.patch: `packages/os/scripts/generate-docs.ts`
- 2026-06-03 02:18:23 fs.patch: `packages/os/package.json`
- 2026-06-03 02:18:53 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:19:03 fs.patch: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:20:34 fs.patch: `packages/os/STEERING.md`
- 2026-06-03 02:20:35 fs.patch: `packages/os/skills.md`
- 2026-06-03 02:20:36 fs.patch: `packages/os/docs/skills.md`
- 2026-06-03 02:20:56 fs.patch: `packages/os/docs/runtime-surfaces.md`
- 2026-06-03 02:21:13 fs.patch: `packages/os/docs/runtime-surfaces.md`
- 2026-06-03 02:21:32 fs.patch: `packages/os/docs/runtime-surfaces.md`
- 2026-06-03 02:21:55 fs.patch: `packages/os/docs/runtime-surfaces.md`
- 2026-06-03 02:27:20 fs.patch: `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`
- 2026-06-03 02:28:07 fs.patch: `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`
- 2026-06-03 02:29:02 fs.patch: `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`
- 2026-06-03 02:29:06 fs.patch: `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`

## workspace-owned: files read

- `packages/os/docs/runtime-surfaces.md`
- `packages/os/package.json`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/local-guardrails.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/skills.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/server.py`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/skills-registry.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/tool-manifest.json`
- `packages/os/tooling/tool-manifest.schema.json`

## workspace-owned: TDD green evidence

- 2026-06-03 02:18:40 `bun --cwd packages/os test tests/tool-manifest.test.ts`: failed exit 1 trace: `trc_028f145d6802`
  - output: 9m[34mresolve[39m([35mimport[39m[33m.[39mmeta[33m.[39mdir[33m,[39m [32m'..'[39m)[33m;[39m [90m | [39m [31m^[39m [90m154| [39mconst manifestPath = path.join(workspaceRoot, 'manifests', 'tool.manif… [90m155| [39m[35mconst[39m toolsDocPath [33m=[39m path[33m.[39m[34mjoin[39m(workspaceRoot[33m,[39m [32m'TOOLS.md'[39m)[33m;[39m [90m [2m❯[22m tests/tool-manifest.test.ts:[2m8:1[22m[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-03 02:18:53 patch lines 1-5: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:19:03 patch lines 154-154: `packages/os/scripts/tools-search.ts`
- 2026-06-03 02:19:09 `bun --cwd packages/os test tests/tool-manifest.test.ts`: passed exit 0 trace: `trc_4de78ab996f1`
  - output: → tmux: opensaas-os-manifest-build-os-manifest-registry-and-core-manifest-c16c960f $ vitest run tests/tool-manifest.test.ts

- 2026-06-03 02:20:34 patch lines 56-56: `packages/os/STEERING.md`

- 2026-06-03 02:20:35 patch lines 5-5: `packages/os/skills.md`

- 2026-06-03 02:20:36 patch lines 6-6: `packages/os/docs/skills.md`

- 2026-06-03 02:20:56 patch lines 53-57: `packages/os/docs/runtime-surfaces.md`

- 2026-06-03 02:21:13 patch lines 52-64: `packages/os/docs/runtime-surfaces.md`

- 2026-06-03 02:21:32 patch lines 63-64: `packages/os/docs/runtime-surfaces.md`

- 2026-06-03 02:21:55 patch lines 84-87: `packages/os/docs/runtime-surfaces.md`

## workspace-owned: validation evidence

Pending.
- 2026-06-03 02:23:20 `review.run`: passed — OK
- 2026-06-03 02:23:32 `verify`: passed — OK
- 2026-06-03 02:28:19 `review.run`: passed — OK
- 2026-06-03 02:28:33 `verify`: passed — OK
- 2026-06-03 02:29:19 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os-manifest/build-os-manifest-registry-and-core-manifest/current.json`, `.task/os-manifest/build-os-manifest-registry-and-core-manifest/evidence-log.json`, `.task/os-manifest/build-os-manifest-registry-and-core-manifest/read-log.json`, `.task/os-manifest/build-os-manifest-registry-and-core-manifest/session.json`, `.task/os-manifest/build-os-manifest-registry-and-core-manifest/verify.json`, `.task/os-manifest/build-os-manifest-registry-and-core-manifest/workpad.md`, `.task/tasks/os-manifest/build-os-manifest-registry-and-core-manifest.json`, `packages/os/STEERING.md`, `packages/os/TOOLS.md`, `packages/os/docs/runtime-surfaces.md`, `packages/os/docs/skills.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/package.json`, `packages/os/scripts/generate-docs.ts`, `packages/os/scripts/generate-tool-manifest.ts`, `packages/os/scripts/generate-types.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/manifest.ts`, `packages/os/scripts/os.ts`, `packages/os/scripts/tools-search.ts`, `packages/os/server.py`, `packages/os/skills.md`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/tool-manifest.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
