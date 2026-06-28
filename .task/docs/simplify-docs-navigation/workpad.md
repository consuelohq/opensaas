# Simplify docs navigation

## Goal
Restore the tighter old Mintlify navigation model while preserving current docs content.

## Requested structure
- Only two top tabs: `User Guide` and `Tools`.
- Remove top-level `OS`, `Developers`, and `GraphQL API` tabs.
- Move the current OS navigation tree under `User Guide`.
- Move GraphQL API under `Tools`.
- Remove Developers from navigation, but do not delete developer docs files.
- Preserve `Getting Started`.
- Use the old tight/collapsible layout: `User Guide > Getting Started` and `User Guide > Documentation`.
- Remove icon-heavy sidebar groups.

## Implementation
- Edited `packages/consuelo-docs/navigation/base-structure.json`, the Mintlify navigation source of truth.
- Regenerated `packages/consuelo-docs/docs.json` using `bun packages/consuelo-docs/scripts/generate-docs-json.ts`.

## Validation
- `docs.json` has tabs: `User Guide`, `Tools`.
- `User Guide` groups are exactly: `Getting Started`, `Documentation`.
- `Tools` includes: `Overview`, `Media`, `Office`, `Browser`, `Workspace`, `GraphQL API`.
- OS pages are reachable under User Guide.
- GraphQL pages are reachable under Tools.
- Developers pages are no longer in navigation.
- No missing navigation targets.
- No `icon` keys remain in `base-structure.json` or generated `docs.json` navigation.

## No-test waiver
Docs/navigation-only change. Focused JSON generation and navigation invariants replace runtime tests.
