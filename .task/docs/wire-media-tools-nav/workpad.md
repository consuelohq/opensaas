# Wire Media Tools nav

## Goal
Wire the existing Media Tools docs into Mintlify's real navigation source and merge through `stream/docs` to `main`.

## Source of truth
Mintlify navigation is generated from:
- `packages/consuelo-docs/navigation/base-structure.json`

Generated output:
- `packages/consuelo-docs/docs.json`

## No-test waiver
Docs/navigation-only task. Validation will be docs-specific:
- regenerate `docs.json`
- verify navigation contains `Tools > Media`
- verify all nav page targets exist
- attempt Mintlify validation and triage same-package failures
- skip repo review gate per Ko instruction


## Validation evidence
- Patched `packages/consuelo-docs/navigation/base-structure.json`, the Mintlify navigation source of truth.
- Regenerated `packages/consuelo-docs/docs.json` with `bun packages/consuelo-docs/scripts/generate-docs-json.ts`.
- Generated config now has tabs: `User Guide`, `Tools`, `OS`, `Developers`, `GraphQL API`.
- Generated config now has `Tools > Media` with 19 Media pages.
- Navigation target check passed with no missing pages.
- JSON parse and changed MDX frontmatter/fence checks passed across 21 `tools/**/*.mdx` pages.
- Mintlify build command was attempted twice but blocked by the ChatGPT workspace wrapper before reaching the workspace command.

## Review gate
Ko explicitly requested skipping code reviews for this wiring task. No `review.run` gate was run.

## Next move
Push task PR, promote into `stream/docs`, then merge `stream/docs` to `main`.
