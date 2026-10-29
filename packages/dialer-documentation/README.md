# Consuelo Dialer documentation

Branch 2 owns this independent Bun/Astro/Starlight app. Its presentation is cloned from `packages/documentation`; that package remains the OS docs and is unchanged.

## Work locally

```sh
bun install --cwd packages/dialer-documentation --frozen-lockfile
bun run --cwd packages/dialer-documentation validate
bun run --cwd packages/dialer-documentation test
bun run --cwd packages/dialer-documentation test:translation
bun run --cwd packages/dialer-documentation build
bun run --cwd packages/dialer-documentation test:browser
bun run --cwd packages/dialer-documentation dev --host 127.0.0.1
```

English MDX under `src/content/docs` is the editorial source. Navigation, breadcrumbs and footer are driven by `src/lib/docs-navigation.ts`. Search, theme selection, mobile sheets, Markdown page actions and automatic language translation retain the existing shell implementation. The social card is generated from its committed SVG during build; no generated binary is needed in Git.

## Preview and cutover

The distinct Worker is `consuelo-dialer-docs`. Wrangler routes are empty, there is no copied production KV namespace, and this package has no authentication/session persistence requirement. Astro's unused session driver is in memory rather than the OS docs' production binding. Translation cache is instance-local; translation credentials stay server-side.

Build with `DOCS_SITE_URL` set to the preview origin to produce matching canonicals and social metadata. Its fallback is the agreed final `https://docs.consuelohq.com` destination, not permission to attach that domain. Runtime translation uses Google when a separate secret is configured; without it English remains readable and the translation endpoint reports unavailability.

`DOCS_SITE_URL=https://<isolated-preview-origin> bun run deploy:preview` rejects missing, invalid and production origins, marks generated pages noindex, then builds and deploys the isolated Worker through the generated `dist/server/wrangler.json`. For local/test translation use `DOCS_TRANSLATION_PROVIDER=passthrough`; do not publish passthrough as a translated product.

Branch 3 owns final domains, redirects, production secrets/bindings and shared release wiring. It must migrate OS docs, resolve old URL collisions and protect OS authentication before attaching the Dialer custom domain. Do not invoke the OS `docs:deploy` command for this package, reuse its KV ID, move its current custom domain, or alter `calls.consuelohq.com`.

See `AUTHORING.md` and `CLAIM-LEDGER.md` before changing product claims. The current set is preview documentation, not a certificate that installation or carrier acceptance has passed.
