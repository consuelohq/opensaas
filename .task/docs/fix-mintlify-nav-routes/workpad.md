# Fix Mintlify nav routes

## Problem
The previous sidebar-dropdown change used a fake blank top-level group (`group: ""`) to avoid visible section headers. Mintlify's docs say groups require a real `group` field and top-level groups always expand. That pattern was unsafe and caused deployed docs routes to 404.

## Correct Mintlify model
- Keep root navigation as `tabs`.
- Put visible sidebar items directly under each tab's `pages` array.
- Use nested groups inside `pages` for collapsible sections.
- Do not use blank group wrappers.

## Validation plan
- Update `base-structure.json` and generators to support tab-level `pages`.
- Regenerate `docs.json`.
- Validate `docs.json` has `tabs[].pages`, not blank top-level groups.
- Validate no missing nav targets, no icons, no duplicate path constants.
- Validate OS docs scripts still pass.


## Implementation
- Removed the invalid blank top-level group wrappers from `base-structure.json`.
- Converted `User Guide` and `Tools` tabs to use tab-level `pages`, which Mintlify documents as supported for tabs.
- Preserved nested groups inside each tab's pages for the collapsible sidebar sections.
- Updated `generate-docs-json.ts` so generated `docs.json` emits `tabs[].pages` when the base tab uses pages.
- Updated documentation path generation and OS docs scripts to support both tab-level `pages` and legacy tab-level `groups`.
- Regenerated `docs.json` and documentation path constants.

## Mintlify evidence
Mintlify navigation docs say:
- groups require a `group` field and a `pages` field;
- top-level groups always expand and only nested groups can use `expanded` behavior;
- tabs can contain other navigation fields including `pages`.
The prior blank wrapper violated that model. The corrected model keeps `tabs` as the root pattern and places sidebar items directly in each tab's `pages` array.

## Validation
- `yarn docs:generate-os-skill-docs`: passed, generated 13 skill docs.
- `bun packages/consuelo-docs/scripts/generate-docs-json.ts`: passed.
- `yarn docs:generate-paths`: passed, 244 paths.
- Navigation invariant check passed:
  - base tabs use `pages`, not blank `groups`.
  - generated docs tabs use `pages`, not blank `groups`.
  - no blank groups remain anywhere in `docs.json`.
  - User Stories is first page in User Guide.
  - Getting Started remains a nested group.
  - Sites remains a nested group under Tools.
  - Office remains a simple page under Tools.
  - no missing nav targets.
  - no icon keys.
  - no duplicate documentation path constants.
- `yarn docs:validate-os-docs`: passed.
- `yarn docs:check-os-skill-docs`: passed.
- `bun --check` passed for changed docs scripts and `DocumentationPaths.ts`.

## Risk
This is a hotfix for broken deployed docs navigation. Visual confirmation still depends on Mintlify preview/deploy, but the emitted structure now matches documented Mintlify navigation semantics instead of an empty group wrapper.


## Final publishing note
State: Hotfix pushed to `task/docs/fix-mintlify-nav-routes` at `6427541db46c0a19c3af486f0286fa082cdcd47e`.

Delta:
- Replaced invalid blank group wrappers with documented Mintlify tab-level `pages`.
- Updated docs generators and OS docs validators to support tab-level pages.
- Regenerated `docs.json`.

Evidence:
- Generated docs tabs now use `pages` and no longer use blank `groups`.
- Recursive scan found zero blank groups in `docs.json`.
- No missing navigation targets.
- OS docs validation passed.
- OS skill docs check passed.
- Touched docs scripts pass `bun --check`.

Next:
- Promote task PR #1315 into `stream/docs`.
- Merge stream/docs to main immediately after GitHub accepts the stream PR.
