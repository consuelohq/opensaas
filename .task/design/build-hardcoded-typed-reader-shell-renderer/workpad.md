# build hardcoded typed reader shell renderer

branch: `task/design/build-hardcoded-typed-reader-shell-renderer`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/817/build-hardcoded-typed-reader-shell-renderer
github pr: https://github.com/consuelohq/opensaas/pull/817
started: 2026-06-06

## acceptance criteria

- [ ] Reuse the existing canonical reader implementation; do not create a duplicate reader shell.
- [ ] Canonical reader shell source of truth is TypeScript, not long-form Markdown steering.
- [ ] `spec`, `plan`, and `guide` render through the hardcoded typed reader shell.
- [ ] `roadmap` is not a template/kind; roadmap content is represented as `plan`.
- [ ] `uncategorized` is rejected by the reader shell and remains outside automatic reader-shell enforcement.
- [ ] The renderer requires hero/title/thesis, body sections, and checklist/ledger input.
- [ ] Optional modules are typed inputs rendered by code: timeline, decision cards, requirements matrix, architecture flow, risk panels, metric cards, task ledger, open questions.
- [ ] Roadmap-style UI/UX markers are asserted by TDD: fixed pill nav, `/design-wiki`, `#smooth-wrapper`, `#smooth-content`, `window.__readerShell`, resume chip, back-to-top, section rail, mobile-safe typography/components.
- [ ] `reader-shell.md` no longer acts as stale instructions; it points to the TS renderer.
- [ ] Design AGENTS/skill steering is updated so future agents use the TS renderer / typed JSON workflow.
- [ ] Focused tests, checkFiles, review, verify pass.

## plan

1. Locate existing renderer/component work and confirm it is the canonical implementation.
2. Add red tests for `plan`/`guide` support, uncategorized rejection, required checklist enforcement, typed optional component rendering, and no roadmap template.
3. Harden `packages/consuelo-design/scripts/render-consuelo-reader.ts` instead of adding a new renderer.
4. Replace stale `reader-shell.md` with a short pointer to the TypeScript renderer.
5. Update `areas/consuelo-design/AGENTS.md` to remove Markdown-shell-first instructions and point agents at `wiki:render` / typed reader input.
6. Run focused tests, render smoke, static checks, review, verify, then promote.

## current status

- Task started from `stream/design` after Ko approved the architecture.
- Confirmed the existing canonical TS renderer exists at `packages/consuelo-design/scripts/render-consuelo-reader.ts`.
- Confirmed the old `reader-shell.md` is long-form guidance, which explains UI drift when agents freehand artifacts.
- Implementation is pending TDD red.

## files changed

- `.task/design/build-hardcoded-typed-reader-shell-renderer/workpad.md`
- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/guide.md`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: activity log

- 2026-06-06 15:22:02 fs.write: `.task/design/build-hardcoded-typed-reader-shell-renderer/workpad.md`
- 2026-06-06 15:25:58 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- 2026-06-06 15:26:39 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-06 15:27:08 fs.write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-06 15:27:17 fs.write: `packages/consuelo-design/templates/digital-eguides/guide.md`
- 2026-06-06 15:27:58 fs.patch: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-06 15:28:18 fs.patch: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-06 15:28:36 fs.patch: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:28:57 fs.patch: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:29:14 fs.patch: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:29:45 fs.patch: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:29:51 fs.patch: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:31:57 fs.write: `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke.json`
- 2026-06-06 15:33:56 fs.write: `.task/design/build-hardcoded-typed-reader-shell-renderer/final-validation.md`
- 2026-06-06: Ko approved hardcoded typed reader shell renderer task.
- 2026-06-06: Located existing canonical TypeScript reader renderer; decision is to edit it, not duplicate it.
- 2026-06-06: Ran `stream.context` for design and started task from `stream/design`.
- 2026-06-06: Read `areas/consuelo-design/AGENTS.md` using task-scoped fs.read.
- 2026-06-06: Read `DESIGN.md`, `reader-shell.md`, `spec.md`, `plan.md`, `render-consuelo-reader.ts`, `render-consuelo-reader.test.ts`, and package scripts.

## validation evidence

- none yet

## key decisions

- Keep the implementation name as reader shell / Consuelo reader.
- Do not create a roadmap template; roadmap is plan.
- Do not remove the existing renderer; harden it.
- Replace the Markdown reader shell guide with a pointer to code so stale instructions cannot steer future agents.

## notes for ko

- The repo already contains the hardcoded TS starting point. The task is now a hardening/integration task, not a from-scratch renderer build.

## publish checklist

```bash
bun run task:push -- --message "feat(design): harden typed reader shell renderer" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-06 15:22:02 write: `.task/design/build-hardcoded-typed-reader-shell-renderer/workpad.md`

## workspace-owned: files changed

- `.task/design/build-hardcoded-typed-reader-shell-renderer/workpad.md`
- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/guide.md`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: TDD red evidence

- 2026-06-06 15:22:27 `bun run test:reader`: failed exit 1 trace: `trc_17292694ff4e`
  - output: tionFrame(tick); }\n tick();\n </script>\n</body>\n</html>" at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-design-build-hardcoded-typed-reader-shell-renderer/packages/consuelo-design/scripts/render-consuelo-reader.test.ts:294:18) (fail) typed reader shell contract > renders optional typed components deterministically [0.15ms] 4 pass 4 fail 42 expect() calls Ran 8 tests across 1 file. [20.00ms] error: script "test:reader" exited with code 1 error: script "test:reader" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/scripts/validate-consuelo-reader.ts`
- `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: TDD green evidence

- 2026-06-06 15:27:08 write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-06 15:27:17 write: `packages/consuelo-design/templates/digital-eguides/guide.md`
- 2026-06-06 15:27:58 patch lines 43-43: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-06 15:28:18 patch lines 1826-1826: `packages/workspace/scripts/consuelo-design.ts`
- 2026-06-06 15:28:36 patch lines 38-38: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:28:57 patch lines 174-174: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:29:14 patch lines 180-180: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:29:45 patch lines 182-182: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:29:51 patch lines 184-184: `areas/consuelo-design/AGENTS.md`
- 2026-06-06 15:30:30 `bun run test:reader`: passed exit 0 trace: `trc_59b566f1f3ee`
  - output: l section components with mobile-safe tables and shell polish [0.30ms] (pass) typed reader shell contract > renders plan and guide as canonical reader shell kinds without introducing roadmap kind [0.16ms] (pass) typed reader shell contract > rejects uncategorized and roadmap as reader shell templates [0.05ms] (pass) typed reader shell contract > requires body sections and a checklist ledger for reader shell documents [0.03ms] (pass) typed reader shell contract > renders optional typed components deterministically [0.13ms] 8 pass 0 fail 55 expect() calls Ran 8 tests across 1 file. [13.00ms]

## workspace-owned: validation evidence

- 2026-06-06 15:30:46 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-06 15:31:57 write: `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke.json`
- 2026-06-06 15:33:56 write: `.task/design/build-hardcoded-typed-reader-shell-renderer/final-validation.md`
- 2026-06-06 15:34:17 `review.run`: passed — OK
- 2026-06-06 15:34:29 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/build-hardcoded-typed-reader-shell-renderer/current.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/evidence-log.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/final-validation.md`, `.task/design/build-hardcoded-typed-reader-shell-renderer/read-log.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke/index.html`, `.task/design/build-hardcoded-typed-reader-shell-renderer/session.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/workpad.md`, `.task/tasks/design/build-hardcoded-typed-reader-shell-renderer.json`, `areas/consuelo-design/AGENTS.md`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/guide.md`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/workspace/scripts/consuelo-design.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
