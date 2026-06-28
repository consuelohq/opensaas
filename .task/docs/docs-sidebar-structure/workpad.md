# Docs sidebar structure

## Goal
Create a clearer Hermes-style docs sidebar without doing a full content rewrite.

## Requested direction
- `User Stories & Use Cases` should be one page, not a group of pages.
- Keep the two top tabs: `User Guide` and `Tools`.
- Keep `Getting Started`.
- Use more section-focused collapsible sidebar groups.
- Move old GTM/site product docs under `Sites`; Sites is the umbrella for GTM.
- Keep `Office` separate from Sites.
- Preserve existing docs content; placeholders are acceptable where the structure is ahead of the content.

## No-test waiver
Docs/navigation-only IA task. Validation will use generated docs config checks, path checks, JSON parse checks, generated path checks, and docs-specific scripts.


## Implementation
- Added one-page `User Stories & Use Cases` at `user-guide/user-stories-use-cases.mdx` with sections: Overview, Sales Teams, Insurance Agencies, Founder / Operator Workflows, Support & Ops, Developer / Automation Workflows, Community Examples.
- Rebuilt User Guide sidebar into Hermes-style sections: User Stories & Use Cases, Getting Started, Using Consuelo OS, Features, Tools, Integrations, Guides & Tutorials, Developer Guide, Reference.
- Added placeholder pages for Features, Integrations, Guides & Tutorials.
- Added `Tools > Sites` with `tools/sites/overview.mdx`; Sites is the umbrella for the existing GTM/product docs.
- Kept Office separate under Tools.
- Moved the old GTM/site docs under `Tools > Sites` instead of leaving them as top-level User Guide sections.
- Updated tools overview cards so Sites is first and Office is separate.
- Updated docs OS helper scripts so OS docs can live under renamed/nested sections without breaking docs-lint.

## Validation
- `bun packages/consuelo-docs/scripts/generate-docs-json.ts`: passed.
- `yarn docs:generate-paths`: passed, generated 244 unique paths.
- Navigation invariant check: passed.
  - Top tabs: `User Guide`, `Tools`.
  - User Guide groups: `User Stories & Use Cases`, `Getting Started`, `Using Consuelo OS`, `Features`, `Tools`, `Integrations`, `Guides & Tutorials`, `Developer Guide`, `Reference`.
  - Tools groups: `Overview`, `Sites`, `Office`, `Media`, `Browser`, `Workspace`, `GraphQL API`.
  - User Stories is one page.
  - Sites exists as the GTM umbrella.
  - Office is separate.
  - No missing navigation targets.
  - No icon keys.
  - No duplicate documentation path constants.
- `yarn docs:validate-os-docs`: passed, validated 13 generated skill pages and localized OS routes.
- `yarn docs:check-os-skill-docs`: passed, checked 13 skill docs.
- `bun --check packages/consuelo-docs/scripts/generate-os-skill-docs.ts`: passed.
- `bun --check packages/consuelo-docs/scripts/validate-os-docs.ts`: passed.
- `bun --check packages/twenty-shared/src/constants/DocumentationPaths.ts`: passed.

## Build note
- `bun run --cwd packages/consuelo-docs build` was attempted and hit the workspace command timeout before producing output. This is not counted as a passing build.
- Focused docs/navigation validation passed.
