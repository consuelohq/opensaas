# Fix sidebar drilldown

## Problem
The current sidebar still behaves incorrectly:
- Clicking a navigation group opens the first page instead of only toggling the group.
- Single-page groups like `Features > Features` create redundant header/child UI.
- We need the major IA sections to behave as dropdown/toggle rows wherever Mintlify supports that.

## Mintlify evidence
- `interaction.drilldown: false` prevents auto-navigation when selecting a group and only expands/collapses it.
- `expanded` controls default state for nested groups.
- Top-level groups always expand, so this task cannot fully force Railway-style collapse for direct top-level groups without changing to a different root navigation pattern. We will still emit `expanded: false` everywhere useful and remove redundant single-page groups.

## No-test waiver
Docs/navigation-only shape change. Validation will inspect generated docs JSON invariants, no missing targets, no blank groups, no icon keys, OS docs validation, and script syntax.


## Implementation
- Set `interaction.drilldown` to `false` in `docs.json` so clicking a group toggles instead of navigating to the first child page.
- Added `expanded: false` to navigation groups in `base-structure.json` so Mintlify has explicit collapsed defaults where supported.
- Flattened redundant one-page groups:
  - `Features > Features` became `Features` as a simple page item.
  - `Integrations > Integrations` became `Integrations` as a simple page item.
  - `Guides & Tutorials > Guides & Tutorials` became `Guides & Tutorials` as a simple page item.
- Updated `generate-docs-json.ts` to preserve `expanded` from `base-structure.json` into generated `docs.json`.
- Updated `generate-os-skill-docs.ts` so the generated `Planned Skills` group also emits `expanded: false` and does not make the generated nav stale.
- Regenerated `docs.json` through the generator.

## Validation
- Sidebar invariant check: passed.
  - `interaction.drilldown` is false.
  - no missing navigation targets.
  - no blank groups.
  - redundant single-page groups are flattened.
  - every multi-page group in generated docs has `expanded: false`.
- `bun --check packages/consuelo-docs/scripts/validate-os-docs.ts`: passed; validated 13 generated skill pages and localized OS routes.
- `bun --check packages/consuelo-docs/scripts/generate-docs-json.ts`: passed.
- `bun --check packages/consuelo-docs/scripts/generate-os-skill-docs.ts`: passed; generated 13 skill docs.

## Mintlify note
Mintlify documents that `interaction.drilldown: false` prevents group clicks from navigating to the first page. It also documents `expanded` for nested groups. This patch applies both controls. If Mintlify still renders a direct tab child group as a static header, the remaining structural option is to switch the root pattern from tabs to dropdowns or add a visible parent group; this patch avoids that larger IA change for now.
