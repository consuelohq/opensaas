# Sidebar dropdown layout

## Goal
Keep the improved docs IA, but make the sidebar render closer to the old/simple Hermes-style dropdown list instead of large top-level header sections.

## Requested behavior
- Preserve the current two top tabs: `User Guide` and `Tools`.
- Preserve the new structure and content pages.
- Turn the current top-level sidebar section headers into nested dropdown/list items.
- Keep User Stories & Use Cases as a single page.
- Keep Sites as the GTM umbrella.
- Keep Office separate from Sites.
- Remove/avoid sidebar icons.

## No-test waiver
Docs/navigation-only shape change. Validation will use generated docs config checks, navigation target checks, no-icon checks, OS docs checks, and generated path checks.


## Implementation
- Collapsed `User Guide` into one unlabeled sidebar container so major IA sections render as nested page/dropdown items instead of top-level section headers.
- Collapsed `Tools` into one unlabeled sidebar container for the same reason.
- Kept `User Stories & Use Cases` as a single top-level page item in the User Guide sidebar.
- Kept `Sites` as a dropdown in Tools.
- Kept `Office` as a separate simple page item in Tools.
- Regenerated `packages/consuelo-docs/docs.json` from `base-structure.json`.
- Regenerated documentation path constants; no path constant diff was needed.

## Validation
- `bun packages/consuelo-docs/scripts/generate-docs-json.ts`: passed.
- `yarn docs:generate-paths`: passed, 244 paths.
- Navigation invariant check passed:
  - top tabs are `User Guide` and `Tools`.
  - User Guide has one blank top group container.
  - Tools has one blank top group container.
  - User Stories is a simple page item.
  - Getting Started / Using Consuelo OS / Features render as nested dropdown groups.
  - Sites and Media render as nested dropdown groups under Tools.
  - Office renders as a simple page item under Tools.
  - no missing nav targets.
  - no icon keys.
  - no duplicate documentation path constants.
- `yarn docs:validate-os-docs`: passed.
- `yarn docs:check-os-skill-docs`: passed.
- `bun --check packages/twenty-shared/src/constants/DocumentationPaths.ts`: passed.

## Build note
This is a docs navigation shape change. I did not count a full Mintlify local build as passed. GitHub/Mintlify preview will be the visual source of truth for whether the blank container renders exactly as expected.
