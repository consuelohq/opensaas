# Consuelo Mintlify Documentation (Legacy During Migration)

This package currently hosts the live Mintlify documentation site at [docs.consuelohq.com](https://docs.consuelohq.com).

A new Bun/Starlight documentation app has been bootstrapped at `packages/documentation`. Until cutover is complete, this package remains the live Mintlify source, but new architecture work should prefer `packages/documentation`.

## Current source of truth

When editing this package, use these rules:

1. Edit MDX page content in the relevant content directory.
2. Edit navigation in `navigation/base-structure.json`.
3. Treat `docs.json` as generated config. Do not hand-edit navigation inside `docs.json`.
4. Run `yarn docs:generate` after changing `navigation/base-structure.json`.
5. Run `yarn docs:generate-paths` after adding, removing, or renaming public page slugs.
6. Run `yarn docs:validate-os-docs` for OS docs changes.

## What not to add back

Do not add committed locale trees back to this package. Translations are moving to the new `packages/documentation` architecture as runtime/cached translation artifacts, not checked-in MDX copies.

Do not regenerate public raw-source pages from OS runtime files. The previous raw-source generated docs were intentionally removed because they made the public docs heavy and confusing:

- `os/agent-context/steering`
- `os/agent-context/decision`
- `os/agent-context/tools`
- `os/agent-context/scripts`
- legacy `os/tools/default-steering`, `os/tools/decision-engine`, `os/tools/tool-manifest`, and `os/tools/scripts`

Those runtime files may still be useful internally, but they should not be dumped into public Mintlify docs as generated MDX.

## Navigation files

- `navigation/base-structure.json`: source of truth for tabs, groups, and page slugs while Mintlify is live.
- `navigation/navigation.template.json`: label template for navigation groups.
- `l/<language>/`: intentionally absent. Do not commit machine-translated fallback page trees.
- `docs.json`: generated Mintlify config. Keep non-navigation settings here, but regenerate navigation from `base-structure.json`.
- `packages/twenty-shared/src/constants/DocumentationPaths.ts`: generated from `base-structure.json` by `yarn docs:generate-paths`.

## Local development

```bash
npx nx run consuelo-docs:dev
```

## Build / validation

```bash
npx nx run consuelo-docs:build
yarn docs:generate
yarn docs:generate-paths
yarn docs:validate-os-docs
yarn docs:check-os-skill-docs
```

## Package-manager note

The repository root is still Yarn-owned. The new `packages/documentation` Starlight app is Bun-owned during migration. Do not use this legacy package to decide the final package-manager policy for the new docs app.
