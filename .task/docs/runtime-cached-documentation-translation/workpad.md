# Runtime cached documentation translation

## Scope
Add Phase 3 translation UX to `packages/documentation`, the Bun-owned Astro/Starlight docs app, without deleting the legacy Mintlify package or reintroducing generated locale trees.

## Acceptance criteria
- Keep package name `packages-documentation`.
- Keep `packages/documentation` Bun-owned and outside root Yarn workspaces.
- Do not delete `packages/consuelo-docs`.
- Do not add committed translated MDX locale trees.
- Add a runtime translation API contract whose provider credentials stay server-side.
- Cache translation responses by route + source content hash + target language.
- Add docs UI for choosing supported target languages.
- Extend `packages/documentation/scripts/validate-documentation.mjs` with translation invariants.
- Run `bun run --cwd packages/documentation validate` and `bun run --cwd packages/documentation build`.
- Run workspace review, verify, and push to `stream/docs`.

## Test-first contract
Behavior under test:
- The docs package exposes runtime translation through a server-only API route and a small client UI without committed locale MDX.
- Validation rejects missing translation pieces, client-side Google credential use, missing cache contract, package-manager regressions, and committed locale folders.

Existing pattern to follow:
- `packages/documentation/scripts/validate-documentation.mjs` is the package-local regression gate.
- Phase 2 kept package-local behavior validated with `bun run validate` and `bun run build`.

New or changed tests:
- Extend `validate-documentation.mjs` to assert translation endpoint/client/lib presence and invariants.
- Add package-local unit-style tests for translation route normalization, hashing, cache keys, and redaction-safe payload behavior if feasible within the package.

Focused red command:
- `bun run --cwd packages/documentation validate`

Expected red failure before implementation:
- Missing translation endpoint, client island, shared contract, and README translation guidance.

Validation ladder:
1. Red package validator after adding translation invariants.
2. Green package validator after implementation.
3. Focused package tests if added.
4. `bun run --cwd packages/documentation build`.
5. Workspace review and verify.

## Implementation plan
1. Inspect Starlight package structure and current validator.
2. Add translation invariants to the validator and confirm red.
3. Implement translation config/shared types, source loader/hash/cache helpers, API route, and client UI.
4. Wire UI into Starlight through a custom head/client script or component hook depending on local Starlight patterns.
5. Update README with runtime translation ownership rules.
6. Validate, inspect diff, review, verify, push.

## Notes
- Do not add real provider credentials.
- Use deterministic local validation and mocked provider behavior. Real Google API calls are out of scope.
- A provider can be configured later through environment variables; missing credentials should fail safely at runtime, not build time.

- 2026-07-01 22:36:16 write: `.task/docs/runtime-cached-documentation-translation/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-01 22:36:16 fs.write: `.task/docs/runtime-cached-documentation-translation/workpad.md`
- 2026-07-01 22:47:55 fs.write: `.task/docs/runtime-cached-documentation-translation/workpad.md`

## Implementation notes
- Added `@astrojs/cloudflare` so the docs app can keep static Starlight pages while serving a runtime API route.
- Starlight `LanguageSelect` now points to `src/components/translation/RuntimeLanguageSelect.astro`.
- Translation source loads English MDX, extracts user-facing text segments, hashes the source content, and caches by route + content hash + target language.
- Provider credentials stay server-side through Cloudflare Worker bindings via `cloudflare:workers`; the client does not reference provider secrets.
- Missing provider config returns `translation_provider_unconfigured` instead of falling back to committed locale files or leaking secrets.

## Validation completed
- `bun run --cwd packages/documentation test:translation` passed.
- `bun run --cwd packages/documentation validate` passed.
- `bun run --cwd packages/documentation build` passed and generated 40 static pages plus the Cloudflare server bundle.
- Preview smoke passed for `/user-guide/user-stories-use-cases/`: selector rendered and `/api/docs/translate` returned the expected safe 503 when no provider binding is configured.

## Known build note
- Starlight still prints `Entry docs → 404 was not found.` to stderr during build. This was already present after Phase 2 and build exits 0.

- 2026-07-01 22:47:55 append: `.task/docs/runtime-cached-documentation-translation/workpad.md`

## workspace-owned: validation evidence

- 2026-07-01 22:48:37 `review.run`: passed — OK
- 2026-07-01 22:49:20 `review.run`: passed — OK
- 2026-07-01 22:50:05 `review.run`: passed — OK
- 2026-07-01 22:50:16 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/docs/runtime-cached-documentation-translation/current.json`, `.task/docs/runtime-cached-documentation-translation/session.json`, `.task/docs/runtime-cached-documentation-translation/workpad.md`, `.task/tasks/docs/runtime-cached-documentation-translation.json`, `packages/documentation/.gitignore`, `packages/documentation/README.md`, `packages/documentation/astro.config.mjs`, `packages/documentation/bun.lock`, `packages/documentation/package.json`, `packages/documentation/scripts/test-translation.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/components/translation/RuntimeLanguageSelect.astro`, `packages/documentation/src/lib/translation/cache.ts`, `packages/documentation/src/lib/translation/languages.ts`, `packages/documentation/src/lib/translation/provider.ts`, `packages/documentation/src/lib/translation/source.ts`, `packages/documentation/src/lib/translation/text.ts`, `packages/documentation/src/pages/api/docs/translate.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
