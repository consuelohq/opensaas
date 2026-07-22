# find shared spec task shell

branch: `task/workspace-agents/find-shared-spec-task-shell`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/909/find-shared-spec-task-shell
github pr: https://github.com/consuelohq/opensaas/pull/909
started: 2026-06-10

## acceptance criteria

- [ ] Update the canonical Consuelo reader shell so the section rail uses line-style category indicators instead of tiny dots.
- [ ] Preserve desktop/web scroll affordances and make the rail generated from every top-level section, typed component, and task ledger.
- [ ] On mobile, tapping the rail opens a full-height scrollable drawer with one navigable row per section using the section title.
- [ ] Add reader behavior so text selection copies the selected text automatically.
- [ ] Add reader behavior so Enter after browser find/selection advances to the next visible occurrence where possible without breaking normal form behavior.
- [ ] Add a small copy button to each task/checklist group that copies that entire task block as Markdown.
- [ ] Update the spec/task template docs so future specs and task ledgers use the reusable shell behavior instead of requiring old spec rewrites.
- [ ] Keep OS/workspace parity: OS uses the same canonical renderer path; any workspace-only template support that should exist in OS is either landed or called out as follow-up.

## plan

1. Use the canonical renderer `packages/consuelo-design/scripts/render-consuelo-reader.ts` as the shared shell owner.
2. Add focused failing renderer tests for rail drawer, all-section nav generation, selection copy, find-next handler markers, and task Markdown copy buttons.
3. Patch the renderer and reader-shell/spec template docs.
4. Check whether OS `consuelo-design` template generation parity is small enough for this PR; land only targeted parity.
5. Run focused reader tests, OS Sites tests if OS code changes, syntax/checkFiles, diff review, review, verify, then push/promote.

## current status

- Located canonical shell: `packages/consuelo-design/scripts/render-consuelo-reader.ts`.
- Located shell contract docs: `packages/consuelo-design/templates/digital-eguides/reader-shell.md` and spec/plan/guide templates.
- Confirmed workspace `consuelo-design.ts` already has `--template <spec|plan|guide>` support.
- Confirmed OS `scripts/os.ts` already renders `spec|plan|guide` through root `wiki:render` for Sites.
- Confirmed OS `scripts/consuelo-design.ts` lacks workspace `--template` generation support; likely targeted parity candidate.

## Test-first contract

Behavior under test:
- The renderer builds section navigation from every top-level reader section, typed component, and task ledger instead of only the provided short map.
- The desktop rail renders line-style controls with section titles in accessible/hidden text.
- Mobile rail activation opens a scrollable drawer whose rows match the same section list and navigate to section anchors.
- Task/checklist groups render copy buttons carrying Markdown for the entire group.
- Reader script contains selection-copy and find-next handlers with clipboard and safe keyboard behavior.
- Docs/template contract tells agents to fill typed JSON and rely on the renderer for these shell affordances.

Existing pattern to follow:
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts` already uses string assertions plus `validateConsueloReaderHtml` for deterministic shell behavior.
- Prior roadmap/nav tests assert CSS/JS markers in the rendered HTML.

Intended tests:
- Add tests to `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`.
- If OS `consuelo-design.ts` parity is changed, add or update `packages/os/tests/consuelo-design.test.ts` or the closest existing OS test.

Focused red command:
- `bun --cwd packages/consuelo-design run test:reader`

Expected red failure:
- Missing `reader-section-line`, mobile drawer markers, clipboard selection handler, find-next handler, and task copy button/Markdown attributes.

No-test waiver:
- None for renderer behavior. The spec content/doc update is covered by reader tests plus docs readback.

## files changed

- `packages/consuelo-design/.task/workspace-agents/find-shared-spec-task-shell/reader-shell-smoke.html` (deleted)
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

## workspace-owned: files changed

- `packages/consuelo-design/.task/workspace-agents/find-shared-spec-task-shell/reader-shell-smoke.html` (deleted)
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

## workspace-owned: activity log

- 2026-06-10 02:51:01 fs.write: `.task/workspace-agents/find-shared-spec-task-shell/workpad.md`
- 2026-06-10 02:51:42 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-10 02:55:21 fs.write: `.task/workspace-agents/find-shared-spec-task-shell/patch-reader-shell.py`
- 2026-06-10 02:59:12 fs.write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-10 03:00:30 fs.write: `packages/consuelo-design/templates/digital-eguides/spec.md`
- 2026-06-10 03:02:20 fs.trash: `.task/workspace-agents/find-shared-spec-task-shell/patch-reader-shell.py`
- 2026-06-10 03:02:30 fs.trash: `packages/consuelo-design/.task/workspace-agents/find-shared-spec-task-shell/reader-shell-smoke.html`
- 2026-06-10 03:03:43 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- 2026-06-10 03:05:31 fs.write: `.task/workspace-agents/find-shared-spec-task-shell/workpad.md`
- 2026-06-10: Explored current reader shell, workspace/OS template plumbing, OS Sites renderer, and prior OS Spec recovery context.
- 2026-06-10: Read root `AGENTS.md` and full `CODING-STANDARDS.md`; no package-level AGENTS files exist for `packages/consuelo-design` or `packages/os`.
- 2026-06-10: Started from `main` into task PR #909.

## workspace-owned: validation evidence

- 2026-06-10 03:00:53 `checkFiles`: passed — OK
- 2026-06-10 03:03:12 `review.run`: passed — OK
- 2026-06-10 03:04:18 `checkFiles`: passed — OK
- 2026-06-10 03:04:33 `review.run`: passed — OK
- 2026-06-10 03:04:57 `verify`: passed — OK
- 2026-06-10 03:05:42 `verify`: passed — OK

## key decisions

- The generalized shell belongs in TypeScript renderer code, not per-spec HTML.
- Old specs/plans should not require regeneration when shell behavior changes unless their source JSON changes; future work may need versioned/re-render-on-view architecture, but this PR will keep the targeted renderer/template update.

## notes for ko

- The targeted PR can update the reusable shell and templates now.
- A larger architecture change to auto-apply shell upgrades to old specs without re-rendering/publishing them should be a follow-up unless the current runtime already supports it cleanly.

## improvements noticed

- OS `scripts/consuelo-design.ts` is behind workspace on `--template` generation. This is small enough to inspect for parity after renderer tests are in place.

## issues and recovery

- `packages/consuelo-design/AGENTS.md` and `packages/os/AGENTS.md` are absent; root standards are the active repo guidance.
- A broad batch read for standards was safety-blocked, recovered with smaller typed `fs.read` calls.

---

## publish checklist

```bash
bun run task:push -- --message "feat(reader): add navigable shell affordances" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `package.json`
- `packages/consuelo-design/package.json`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/README.md`
- `packages/consuelo-design/templates/digital-eguides/guide.md`
- `packages/consuelo-design/templates/digital-eguides/plan.md`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`
- `packages/os/scripts/consuelo-design.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: TDD red evidence

- 2026-06-10 02:51:47 `bun --cwd packages/consuelo-design run test:reader`: passed exit 0 trace: `trc_f09dfdda918b`
  - output: → tmux: opensaas-workspace-agents-find-shared-spec-task-shell-d8cc92af
- 2026-06-10 02:51:55 `bun run --cwd packages/consuelo-design test:reader`: failed exit 1 trace: `trc_8e6b2890ea26`
  - output: requestAnimationFrame(tick); }\n tick();\n </script>\n</body>\n</html>" at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-workspace-agents-find-shared-spec-task-shell/packages/consuelo-design/scripts/render-consuelo-reader.test.ts:440:18) (fail) reader navigable shell affordances > adds clipboard helpers for selection copy, find-next, and task block markdown copy [0.22ms] 17 pass 2 fail 111 expect() calls Ran 19 tests across 1 file. [25.00ms] error: script "test:reader" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-10 02:55:21 write: `.task/workspace-agents/find-shared-spec-task-shell/patch-reader-shell.py`

## workspace-owned: TDD green evidence

- 2026-06-10 02:56:05 `bun run --cwd packages/consuelo-design test:reader`: passed exit 0 trace: `trc_56b8cbb0007f`
  - output: and flow components too [0.08ms] (pass) reader nav display title > uses the short artifact title in the nav while preserving the full label [0.04ms] (pass) reader mixed module flattening > flattens no-body sections even when they contain multiple modules [0.06ms] (pass) reader navigable shell affordances > renders line rail and mobile drawer entries for every top-level section [0.21ms] (pass) reader navigable shell affordances > adds clipboard helpers for selection copy, find-next, and task block markdown copy [0.14ms] 19 pass 0 fail 140 expect() calls Ran 19 tests across 1 file. [15.00ms]

- 2026-06-10 02:59:12 write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

- 2026-06-10 03:00:30 append: `packages/consuelo-design/templates/digital-eguides/spec.md`

- 2026-06-10 03:03:43 write: `packages/consuelo-design/scripts/render-consuelo-reader.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/find-shared-spec-task-shell.json`, `.task/workspace-agents/find-shared-spec-task-shell/current.json`, `.task/workspace-agents/find-shared-spec-task-shell/evidence-log.json`, `.task/workspace-agents/find-shared-spec-task-shell/read-log.json`, `.task/workspace-agents/find-shared-spec-task-shell/session.json`, `.task/workspace-agents/find-shared-spec-task-shell/verify.json`, `.task/workspace-agents/find-shared-spec-task-shell/workpad.md`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/consuelo-design/templates/digital-eguides/spec.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## implementation update — 2026-06-10

Implemented reader shell v1.3.0 in the canonical renderer.

### files changed

- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/consuelo-design/templates/digital-eguides/spec.md`

### behavior landed

- Replaced dot-style section rail with line-style section controls.
- Generated rail/drawer entries from every top-level section, typed component, and task ledger.
- Added mobile section drawer with scrollable rows using section titles.
- Added automatic selected-text copy through the reader shell.
- Added reader-owned Enter-to-next-occurrence support when a selected/find term is available.
- Added per-task/checklist copy buttons that copy the task group as Markdown.
- Updated reader-shell and spec template docs so future specs use typed input and inherited shell behavior.

### OS/workspace parity

- OS Sites already delegates typed `spec|plan|guide` rendering to root `wiki:render`, so this renderer change applies to OS-rendered Sites pages after they are re-rendered.
- Workspace `consuelo-design.ts` already exposes `--template <spec|plan|guide>` for generated digital e-guide work orders.
- OS `scripts/consuelo-design.ts` still lacks that workspace-only generation flag. I did not widen this PR into full OS `consuelo-design` parity because the requested page behavior is covered through the shared renderer and OS Sites renderer. Parity for OS `consuelo-design generate digital-eguide --template` should be a follow-up if Ko wants live-workflow generation parity too.

### architecture note

Existing published specs are static rendered HTML. Updating the TypeScript shell improves future renders and any re-rendered existing page, but old published spec HTML will not update automatically unless it is re-rendered/published or served through a dynamic renderer. A follow-up architecture PR should make old specs reference source JSON plus renderer version so shell upgrades can be applied without hand-editing old specs.

### validation evidence

- Red: `bun run --cwd packages/consuelo-design test:reader` failed before implementation on missing `data-reader-section-title="Summary"` and missing new shell affordances.
- Green: `bun run --cwd packages/consuelo-design test:reader` passed, 19 tests, 140 assertions. Trace: `trc_d67ec1049b97`.
- Syntax: `checkFiles` passed for `render-consuelo-reader.ts` and `render-consuelo-reader.test.ts`. Trace: `trc_1f049973d336`.
- Render smoke: `bun run wiki:render -- --template spec ...` produced reader shell version `1.3.0`. Trace: `trc_e0f9eebd13c8`.
- Validate smoke: `bun run wiki:validate -- --input ...` passed with no missing markers. Trace: `trc_b6c4359fbdd5`.
- OS Sites regression: `bun --cwd packages/os test tests/sites-cli.test.ts` passed, 5 tests. Trace: `trc_36a829e9f6ad`.
- Review: `review.run --base origin/main --no-tests` passed with 0 issues in my changes; one pre-existing project typecheck-target limitation remains. Trace: `trc_2fc8278ac7f0`.
- Verify: `verify --base origin/main` passed and wrote publish-valid stamp. Trace: `trc_d0956f56f303`.

### cleanup

- Removed task-local temporary patch helper and smoke HTML artifact before final diff review.

- 2026-06-10 03:05:31 append: `.task/workspace-agents/find-shared-spec-task-shell/workpad.md`
