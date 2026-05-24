# Consuelo OS

Consuelo OS is the local and hosted runtime that turns a company into an agent-ready workspace.

The current package proves this spine:

```text
get_steering -> call -> Bun skill -> structured result -> local execution record
```

The product runtime path is Bun/TypeScript. Python files remain only as temporary compatibility/bootstrap surfaces until the Bun server fully replaces transport needs.

## OS portal

The OS portal exposes three package entrypoints:

- `get_steering`
- `get_dev_steering`
- `call`

The customer-facing portal is `get_steering` and `call`. `get_dev_steering` is internal/dev/operator context.

Skills live behind `call` as Bun scripts under `scripts/`. They are exposed through manifests in `tooling/`.

Manifests are manifests. Skills are the capabilities that agents can run. Scripts are the executable implementation behind those skills.

## Local runtime state

Local OS state defaults to:

```text
~/.consuelo/os
```

Override it with:

```bash
export CONSUELO_HOME="/path/to/consuelo-os"
```

The runtime creates:

```text
~/.consuelo/os/
  consuelo.db
  artifacts/
  logs/
  runs/
  tmp/
```

SQLite stores execution metadata and events. Raw artifact bytes stay in the artifact folder until the artifact service moves them to cloud storage.

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

Run the workspace snapshot skill:

```bash
bun --cwd packages/os ./scripts/os.ts call '{"name":"consuelo-workspace-snapshot","input":{"limit":25}}'
```

With GraphQL env configured, the same command attempts a harmless connectivity proof.

## Bun server

Start the local OS server:

```bash
cd packages/os
bun run server:run
```

The server listens on `127.0.0.1:8850` by default.

Override the port with:

```bash
export CONSUELO_OS_PORT=8851
```

The server exposes:

- `/health`
- `/get_steering`
- `/get_dev_steering`
- `/call`

Manage the background server through:

```bash
cd packages/os
bun run server -- status
bun run server -- restart
bun run server -- stop
```

## Current boundary

This is runtime foundation work. The scaffold intentionally includes one skill and docs for the shape future skills should follow. Docker, S3 storage, approval delivery, and hosted deployment hardening are separate tasks.


### App files cloud artifact capability

Set `CONSUELO_APP_API_URL` and `CONSUELO_APP_API_KEY` to enable app-visible artifact publishing through Consuelo Files/S3. This capability is separate from app GraphQL reads. Existing `CONSUELO_GRAPHQL_URL` env remains a compatibility fallback for object reads; prefer `CONSUELO_APP_GRAPHQL_URL` for new setups.
