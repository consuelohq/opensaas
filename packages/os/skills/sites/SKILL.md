# Sites

Sites is Consuelo OS delivery infrastructure. It materializes local HTML surfaces and provides the files that local Hono routes and Cloudflare workspace-edge snapshots serve.

Artifacts is the product domain for durable generated outputs. Sites must not create a second artifact catalog or rename artifacts as a site category.

## Local layout

```text
<OS_HOME>/sites/
<OS_HOME>/sites/index.html
<OS_HOME>/sites/artifacts/index.html
<OS_HOME>/sites/artifacts/data/catalog.json
<OS_HOME>/sites/pages/
<OS_HOME>/sites/.data/pages/registry.json
<OS_HOME>/sites/.data/pages/leases.json
<OS_HOME>/sites/traces/index.html
<OS_HOME>/sites/diffs/index.html
<OS_HOME>/sites/docs/index.html
<OS_HOME>/sites/settings/index.html
```

The canonical artifact bytes and catalog live under:

```text
<OS_HOME>/artifacts/catalog.json
<OS_HOME>/artifacts/current/<artifact-route>/
<OS_HOME>/artifacts/versions/<artifact-route>/<version-id>/
```

## Commands

Use `bun run artifacts` for artifact generation, publishing, history, rollback, and index refresh.

Use the Sites command only for delivery infrastructure and typed collaborative pages:

```bash
bun ./scripts/os.ts sites path
bun ./scripts/os.ts sites status
bun ./scripts/os.ts sites refresh
bun ./scripts/os.ts sites open
bun ./scripts/os.ts sites render --template <spec|plan|guide> --input <content.json> --out <index.html>
bun ./scripts/os.ts sites publish --target <file-or-dir> --path /pages/<slug> --title <title> --kind <kind> [--base-version <id>]
bun ./scripts/os.ts sites patch --page <slug> --section <id> --input <section.json> --base-version <id> [--agent <id>]
bun ./scripts/os.ts sites lease acquire|status|release --page <slug> --section <id> [--agent <id>]
```

## Boundaries

- `/artifacts` is the canonical durable-output route.
- Sites may serve or snapshot artifact output but must not own a separate artifact model.
- Do not create retired artifact-site aliases, parallel archives, or fallback reads.
- Typed collaborative pages remain separate because they have section leases and patch/rebase behavior.
- Trace and Settings pages may hydrate from their signed Hono gateways.
- Public edge compatibility for historical URLs belongs in explicit redirects, not internal aliases.
