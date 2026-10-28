# Fix docs navigation generators

## Goal
Fix generator failures caused by the intended docs navigation shape:
- OS no longer exists as a top-level tab; it is nested under `User Guide > Documentation > OS`.
- Some OS tool pages appear in both User Guide OS docs and Tools Workspace docs.

## Implementation
- Updated `packages/consuelo-docs/scripts/generate-os-skill-docs.ts` to locate OS groups either in a top-level `os` tab or in the nested `osDocumentation` group under User Guide.
- Updated `packages/consuelo-docs/scripts/generate-documentation-paths.ts` to de-duplicate paths before generating `DOCUMENTATION_PATHS` constants.
- Regenerated `packages/twenty-shared/src/constants/DocumentationPaths.ts`.

## Validation
- `yarn docs:generate-os-skill-docs`: passed, generated 13 skill docs.
- `yarn docs:generate-paths`: passed, generated 229 unique paths.
- `yarn docs:check-os-skill-docs`: passed, checked 13 skill docs.
- `bun --check packages/consuelo-docs/scripts/generate-os-skill-docs.ts`: passed.
- `bun --check packages/consuelo-docs/scripts/generate-documentation-paths.ts`: passed.
- `bun --check packages/twenty-shared/src/constants/DocumentationPaths.ts`: passed.
- Focused scan: no duplicate keys in `DOCUMENTATION_PATHS`.
- Focused scan: no `/user-guide/ai` references remain outside `.task`.

## Why this is required
PR #1255 failed because docs-lint expected a top-level OS tab, and shared/front builds failed because duplicate OS tool paths generated duplicate constants. These fixes preserve Ko's requested navigation instead of restoring the OS tab.
