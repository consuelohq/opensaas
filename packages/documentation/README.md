# Consuelo Documentation

This package is the Bun-owned Astro/Starlight documentation app for Consuelo. It is the source package for `docs.consuelohq.com`.

## Source of truth

- Public docs content lives in `src/content/docs/**/*.mdx`.
- Sidebar structure lives in `astro.config.mjs` until we introduce a separate typed navigation module.
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
bun run docs:deploy
bun run web:deploy -- docs
```

## Deployment

`docs.consuelohq.com` is served by the `consuelo-docs` Cloudflare Worker defined in `wrangler.jsonc`. The Worker owns the custom domain through git-backed Wrangler config. Do not manually create a DNS CNAME or A record for `docs.consuelohq.com`; Cloudflare Workers Custom Domains provision DNS when the Worker is deployed.

Deploy from repo root:

```bash
bun run docs:deploy
bun run web:deploy -- docs
bun run web:deploy -- docs --build-only
bun run web:deploy -- docs --skip-build
```

Build without deploying:

```bash
bun run docs:deploy -- --build-only
```

### Cloudflare setup

1. Authenticate Wrangler for the Consuelo Cloudflare account.
2. Deploy once so the Worker and custom domain attach:

```bash
bun run docs:deploy
```

3. Set the production translation secret (never commit this value). Deploy merges `wrangler.jsonc` into the Astro-generated Worker config under `dist/server/`:

```bash
bun run docs:deploy -- --build-only
bunx wrangler secret put GOOGLE_TRANSLATE_API_KEY --config packages/documentation/dist/server/deploy.wrangler.json
```

4. Deploy again after secrets are configured:

```bash
bun run docs:deploy -- --skip-build
```

`DOCS_TRANSLATION_PROVIDER` defaults to `google` through Worker vars in `wrangler.jsonc`. Use `passthrough` only for local validation.

## Adding or moving pages

1. Add or edit the MDX page under `src/content/docs`.
2. Add the page to the Starlight sidebar in `astro.config.mjs`.
3. Run `bun run validate`.
4. Run `bun run build`.

Keep routes stable where possible. Legacy public docs routes are preserved through `src/lib/legacy-redirects.mjs`.

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

## Legacy-route compatibility

Legacy Mintlify routes that still matter should redirect into curated Starlight pages through `src/lib/legacy-redirects.mjs`. Do not bring back generated Mintlify files, `docs.json`, or old locale fallback trees.

## Removed content policy

Do not bring these back into public docs:

- generated raw OS source docs;
- committed locale fallback trees;
- legacy Twenty UI reference pages unless they are intentionally rewritten for Consuelo;
- Starlight starter examples.

## Runtime translation

Runtime translation is Phase 3-owned. The English MDX files remain the only editorial source of truth. Do not add committed translated locale folders under `src/content/docs`. The header language selector calls `/api/docs/translate`, and the server route loads the English source, hashes the content, translates with the configured provider, and caches by route + content hash + target language.

Provider credentials must stay server-side. The client selector must never reference `GOOGLE_TRANSLATE_API_KEY` or any provider token. Use `DOCS_TRANSLATION_PROVIDER=passthrough` only for local/test validation; production translation is configured with `GOOGLE_TRANSLATE_API_KEY`.

## Phase boundaries

- Phase 2: this package becomes a working Starlight docs app with curated English content.
- Phase 3: translation UX and cached runtime translation endpoint.
- Phase 4: deploy cutover and legacy package deletion are complete when this package is the only active docs app.
