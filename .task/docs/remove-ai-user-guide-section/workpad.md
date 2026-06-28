# Remove AI user guide section

## Goal
Remove the AI section from User Guide completely, including the direct `/user-guide/ai/overview` page and related localized AI pages.

## Scope
- Remove the `AI` group from `packages/consuelo-docs/navigation/base-structure.json`.
- Delete `user-guide/ai` docs in English and localized docs under `l/*/user-guide/ai`.
- Remove cards/list items that link to deleted AI pages.
- Regenerate `packages/consuelo-docs/docs.json` from the navigation source.

## No-test waiver
Docs-only/navigation-only removal. Validation replaces runtime tests:
- generated docs config after source edit
- no nav pages under `user-guide/ai`
- no remaining AI docs files under `user-guide/ai`
- no remaining `/user-guide/ai` links
- no missing navigation targets


## Implementation update
- Removed the `AI` group from `packages/consuelo-docs/navigation/base-structure.json`.
- Regenerated `packages/consuelo-docs/docs.json`.
- Deleted English and localized `user-guide/ai` docs directories.
- Removed AI cards and feature-list links from English and localized User Guide entry pages.
- Removed stale AI redirects from `docs.json`.
- Removed AI groups from `packages/consuelo-website/src/data/docs-navigation-source.json`.
- Removed stale `USER_GUIDE_AI_*` constants from `packages/twenty-shared/src/constants/DocumentationPaths.ts`.
- Fixed a same-package mechanical JSON syntax error in `packages/consuelo-docs/navigation/navigation-schema.json` discovered during docs build triage.

## Validation evidence
- `bun packages/consuelo-docs/scripts/generate-docs-json.ts`: passed.
- Repo-wide scan excluding `.task`: no `/user-guide/ai` or `user-guide/ai/` references remain.
- AI docs directories are removed in English and localized docs.
- `docs.json`, `base-structure.json`, `navigation-schema.json`, and website docs navigation source all parse as JSON.
- Generated `docs.json` has no missing navigation targets.
- Modified MDX files have frontmatter and balanced code fences.
- `bun --check packages/twenty-shared/src/constants/DocumentationPaths.ts`: passed.

## Build note
- First Mintlify build attempt showed known parser issues plus a same-package `navigation-schema.json` flow-collection syntax error. The mechanical `navigation-schema.json` error was fixed.
- Second Mintlify build attempt hit the workspace command timeout before returning output. This is not counted as a passing build.
- Focused validation is clean for this removal.

## Scope note
This task removes the AI docs section completely from User Guide and deletes the underlying route files so direct `/user-guide/ai/*` URLs stop resolving from repo source.


## Final publishing note
State: The AI User Guide section removal was pushed to `task/docs/remove-ai-user-guide-section`.

Delta:
- Deleted English and localized `user-guide/ai` docs pages.
- Removed AI group from docs navigation source and generated `docs.json`.
- Removed AI cards/list entries from English and localized User Guide entry pages.
- Removed AI redirects and stale shared/website navigation references.
- Fixed malformed `navigation-schema.json` JSON discovered during same-package build triage.

Evidence:
- No `/user-guide/ai` or `user-guide/ai/` references remain in repo files outside `.task`.
- No `user-guide/ai` files remain on disk.
- No missing generated navigation targets.
- Edited JSON files parse.
- Modified MDX files have frontmatter and balanced code fences.
- `bun --check packages/twenty-shared/src/constants/DocumentationPaths.ts` passed.
- Mintlify build did not complete cleanly locally: existing parser issues remain and the follow-up build hit the command timeout. Focused AI-removal validation passed.

Next: promote PR #1253 into `stream/docs`, then merge the stream to `main` if GitHub allows it.
