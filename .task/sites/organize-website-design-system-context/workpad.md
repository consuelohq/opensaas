# organize website design system context

branch: `task/sites/organize-website-design-system-context`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1243/organize-website-design-system-context
github pr: https://github.com/consuelohq/opensaas/pull/1243
started: 2026-06-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/AGENT-SPECS.md` (deleted)

## workspace-owned: files changed

- `packages/consuelo-website/AGENT-SPECS.md` (deleted)

## workspace-owned: activity log

- 2026-06-28 00:52:47 fs.trash: `packages/consuelo-website/AGENT-SPECS.md`

## workspace-owned: validation evidence

- 2026-06-28 01:52:08 `review.run`: passed — OK
- 2026-06-28 01:52:23 `verify`: passed — OK

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
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```


## Test-first contract

Behavior under test:
- Website-facing design rules resolve from package-level files in `packages/consuelo-website`.
- `areas/website/AGENTS.md` routes agents to the package-level website rules.
- The stale `AGENT-SPECS.md` surface is fully removed.
- Consuelo design manifest source paths resolve to real files and do not import upstream Open Design systems as Consuelo-owned sources.
- `MarketingLayout.astro` loads website `tokens.css` and `primitives.css`.

Existing local pattern to follow:
- `packages/consuelo-website/tests/website-structure.test.js` owns package structure contracts.
- `packages/consuelo-design/design-system/manifest.json` identifies design-system source-of-truth files.

New or changed tests:
- Extend `website-structure.test.js` with design-context, manifest-resolution, and layout CSS-import contracts.

Focused red command:
- `bun test packages/consuelo-website/tests/website-structure.test.js`

Expected red failure:
- The test should fail before implementation because `AGENTS.md`, `animations.md`, `tokens.css`, and `primitives.css` are missing, `areas/website/AGENTS.md` is a stale file, `AGENT-SPECS.md` still exists, and `MarketingLayout.astro` does not import the new CSS files.


## implementation update

- Removed `packages/consuelo-website/AGENT-SPECS.md` through the task filesystem trash path.
- Added package-level `AGENTS.md`, curated `DESIGN.md`, and `animations.md`.
- Added `src/styles/tokens.css` and `src/styles/primitives.css`.
- Wired the design CSS files through `MarketingLayout.astro`.
- Replaced stale `areas/website/AGENTS.md` with a symlink to `../../packages/consuelo-website/AGENTS.md`.
- Updated the Consuelo design manifest to point at real website source-of-truth files and design tooling rules.


## tooling wrapper correction

- Updated `packages/consuelo-design/scripts/consuelo-design.ts` to delegate to `packages/workspace/scripts/office.ts`, the script that currently owns the design facade implementation in this branch.
- This keeps package-local commands like `bun run --cwd packages/consuelo-design check` usable while preserving the existing facade boundary.


## design operator guidance update

- Updated `areas/consuelo-design/AGENTS.md` to name the current `office.*` workspace tools and `packages/workspace/scripts/office.ts` facade implementation.
- Updated website-specific motion context to point at `packages/consuelo-website/animations.md`.


## validation evidence

- Red: `bun test packages/consuelo-website/tests/website-structure.test.js` failed after adding the design-context contract because the new package docs, CSS files, area symlink, manifest roles, and layout imports did not exist yet.
- Green: `bun test packages/consuelo-website/tests/website-structure.test.js` passed — 10 tests, 192 assertions.
- Green: `bun run --cwd packages/consuelo-website build` passed — Astro check returned 0 errors and 0 warnings, with existing inline-script hints only; static build generated 94 pages.
- Green: `bun run --cwd packages/consuelo-design check` passed after correcting the package wrapper.
- Green: `bun run --cwd packages/consuelo-design get-design-system` passed and returned the updated office/tooling guidance.
- Green: local static smoke over built output passed for `/`, `/contact/`, `/login/device/`, `/blog/`, and `/mercury/`.
- Green: built `dist/404.html` contains the custom `404 - Not Found | Consuelo` page.

## notes for ko

- `areas/website/AGENTS.md` is now a symlink to `../../packages/consuelo-website/AGENTS.md`.
- The old `AGENT-SPECS.md` file is deleted, not converted into a pointer.
- The package-local `consuelo-design` script now delegates to `packages/workspace/scripts/office.ts`, which is the current design facade implementation in this branch.

## workspace-owned: test selection

- changed files: `.task/sites/organize-website-design-system-context/current.json`, `.task/sites/organize-website-design-system-context/session.json`, `.task/sites/organize-website-design-system-context/workpad.md`, `.task/tasks/sites/organize-website-design-system-context.json`, `areas/consuelo-design/AGENTS.md`, `areas/website/AGENTS.md`, `packages/consuelo-design/design-system/manifest.json`, `packages/consuelo-design/scripts/consuelo-design.ts`, `packages/consuelo-website/AGENT-SPECS.md`, `packages/consuelo-website/AGENTS.md`, `packages/consuelo-website/COMPONENTS.md`, `packages/consuelo-website/DESIGN.md`, `packages/consuelo-website/animations.md`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/src/styles/primitives.css`, `packages/consuelo-website/src/styles/tokens.css`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
