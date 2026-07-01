# Consuelo Documentation

This package is the new Bun-owned Astro/Starlight documentation app for Consuelo. It is replacing the legacy Mintlify package in phases.

## Source of truth

- Public docs content lives in `src/content/docs/**/*.mdx`.
- Sidebar structure lives in `astro.config.mjs` until we introduce a separate typed navigation module.
- Mintlify remains in `packages/consuelo-docs` only until the Phase 4 cutover.
- English MDX is the editorial source of truth. Do not add committed machine-translated locale trees.

## Package ownership

This package is Bun-owned. Use Bun commands from this directory or with `--cwd packages/documentation`.

`packages/documentation` intentionally remains outside the root Yarn workspaces during this migration. Do not add it to the root Yarn workspace list unless the package-manager migration is explicitly in scope.

## Commands

```bash
bun install
bun run dev
bun run build
bun run validate
```

From repo root:

```bash
bun run --cwd packages/documentation dev
bun run --cwd packages/documentation build
bun run --cwd packages/documentation validate
```

## Adding or moving pages

1. Add or edit the MDX page under `src/content/docs`.
2. Add the page to the Starlight sidebar in `astro.config.mjs`.
3. Run `bun run validate`.
4. Run `bun run build`.

Keep routes stable where possible. The old public docs routes are the compatibility contract until Phase 4 adds redirects.

## MDX component adapters

Legacy Mintlify-like MDX components are adapted in `src/components/mintlify`.

Current adapters:

- `Note`
- `Warning`
- `CardGroup`
- `Card`
- `CardTitle`
- `VimeoEmbed`
- `AgentContext`

Prefer Starlight-native Markdown and components for new docs. Only add adapters when porting existing public docs requires them.

## Do not edit generated Mintlify files

Do not edit `packages/consuelo-docs/docs.json` or use it as the source of truth for this app. While Mintlify is live, its source of truth is still `packages/consuelo-docs/navigation/base-structure.json`, but this package should not depend on generated Mintlify files.

## Removed content policy

Do not bring these back into public docs:

- generated raw OS source docs;
- committed locale fallback trees;
- legacy Twenty UI reference pages unless they are intentionally rewritten for Consuelo;
- Starlight starter examples.

## Phase boundaries

- Phase 2: this package becomes a working Starlight docs app with curated English content.
- Phase 3: translation UX and cached runtime translation endpoint.
- Phase 4: deploy cutover, redirects, and deletion of `packages/consuelo-docs`.
