# Consuelo OS

Consuelo OS is a customer-facing runtime seeded from the proven `packages/workspace` OS portal pattern.

This scaffold proves one narrow spine:

```text
get_steering -> call -> Bun skill -> structured result
```

The OS portal exposes exactly three tools:

- `get_steering`
- `get_dev_steering`
- `call`

Skills live behind `call` as Bun scripts under `scripts/` and are exposed to agents through `tooling/tool-manifest.json`.

The original workspace/operator tool surface is preserved in `tooling/dev-tool-manifest.json` and returned through `get_dev_steering` with a short OS-specific preface.

## Environment

GraphQL proof uses environment variables only:

```bash
export CONSUELO_GRAPHQL_URL="https://consuelo.consuelohq.com/graphql"
export CONSUELO_INTERNAL_GRAPHQL_API_KEY="<local-only-api-key>"
export CONSUELO_WORKSPACE_ID="7d0894c1-bdb1-4dd6-9a00-78681b52d5f6"
```

Never commit secrets. Smoke output reports only env presence, URL host, query status, and safe messages.

## Bun smoke

Return OS steering:

```bash
bun --cwd packages/os ./scripts/os.ts get-steering
```

Return dev/operator steering:

```bash
bun --cwd packages/os ./scripts/os.ts get-dev-steering
```

Run the smoke skill:

```bash
bun --cwd packages/os ./scripts/os.ts call '{"name":"daily-revenue-brief"}'
```

With GraphQL env configured, the same command attempts a harmless connectivity proof.

## OS portal

Start the server:

```bash
cd packages/os
.venv/bin/python3 server.py
```

The server exposes:

- `/health`
- OS portal transport at `/`

The `call` portal entrypoint delegates into the Bun skill runtime.

## Current boundary

This is packaging, not full product completion. The scaffold intentionally includes one skill and docs for the shape future skills should follow.
