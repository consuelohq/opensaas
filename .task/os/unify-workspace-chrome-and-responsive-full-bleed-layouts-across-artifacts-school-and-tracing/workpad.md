# Unify workspace chrome and responsive full-bleed layouts across Artifacts, School and Tracing

branch: `task/os/unify-workspace-chrome-and-responsive-full-bleed-layouts-across-artifacts-school-and-tracing`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2657
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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

## Test-first contract — 2026-10-28

behavior under test: existing desktop mac-style chrome remains consistent, while OS pages fill actual viewport edges on mobile/tablet including touch iPad landscape; Tracing overlay does not retain 14px inset on iPad; Artifacts index content uses available width with responsive cards; School gains the same workspace route menu while keeping its navigation and browser-only completion.
existing local pattern: `workspaceWindowShellStyles` / `workspaceRouteSwitcherStyles` / `renderWorkspaceChromeBar` and tests `workspace-chrome.test.ts`, `artifacts.test.ts`, `observability-traces-site.test.ts`. School source is independently editable/versioned under ~/Consuelo/Artifacts/School; separate work-scoped update and base-version publish required.
new tests: shared responsive shell / menu invariants, Artifacts broad content grid, Tracing iPad rules, School menu and completion browser checks.
focused red: `bunx vitest run packages/os/tests/workspace-chrome.test.ts packages/os/tests/artifacts.test.ts packages/os/tests/observability-traces-site.test.ts` after writing failing assertions.
expected red: missing full-bleed touch breakpoint, Artifacts max-width:720px retained, trace <=760px responsive only.
non-goals: auth changes, OS main merge/deploy, modifying arbitrary independent artifact HTML, School assignment IDs or calendar.
no-test waiver: none.

- 2026-10-29 02:54:33 append: `.task/os/unify-workspace-chrome-and-responsive-full-bleed-layouts-across-artifacts-school-and-tracing/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 02:54:33 fs.write: `.task/os/unify-workspace-chrome-and-responsive-full-bleed-layouts-across-artifacts-school-and-tracing/workpad.md`
- 2026-10-29 02:59:16 fs.write: `.task/os/unify-workspace-chrome-and-responsive-full-bleed-layouts-across-artifacts-school-and-tracing/workpad.md`

## Implementation and focused validation

Changes: `workspace-chrome.ts` removes the 1880px desktop maximum, uses dvh, and fills tablets/touch viewports; `artifacts.ts` replaces the 720px content cap with a fluid responsive artifact gallery; `observability-traces-site.ts` adds iPad/coarse full-bleed to the tracing modal while retaining phone-only table geometry below 760px; new `workspace-fluid-layout.test.ts` covers all three.
Initial red: 3 expected failures. Green: 55 OS tests across 8 related suites, git diff --check clean.
Separate local School artifact updated and published v7 from base v6 using canonical chrome snapshot, with 14 School unit tests and 72 browser checks across desktop, phone, 820/1024/1194/1366 iPad/desktop widths; no horizontal overflow; browser completion survives reload. School published version `2026-10-29T02-58-41-148Z`.
No changes to School assignment JSON/calendar; no OS production deployment or main merge.

- 2026-10-29 02:59:16 append: `.task/os/unify-workspace-chrome-and-responsive-full-bleed-layouts-across-artifacts-school-and-tracing/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 02:59:28 `review.run`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
