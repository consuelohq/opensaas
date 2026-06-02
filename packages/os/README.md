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

## Local Mac Testing Path

Run a user-style local install without writing files first:

```bash
cd packages/os
bun run install:local -- --dry-run --json
bun run install:local -- --yes
```

The installer prepares `CONSUELO_HOME`, local runtime folders, skill metadata, and optional agent links. Consuelo OS runs a background service on the Mac so agents and apps can reach it while you work, similar to common Mac utilities that keep a helper running in the background.

For foreground server testing:

```bash
cd packages/os
bun run server:run
curl --fail http://127.0.0.1:8850/health
```

For startup and restart readiness, validate the generated macOS background services without installing them:

```bash
cd packages/os
bash scripts/install-system-daemons.sh --dry-run
```

The dry run generates and lints user LaunchAgent plists under `scripts/generated/`. The normal install path writes those plists to `~/Library/LaunchAgents` with labels `com.consuelo.system`, `com.consuelo.watchdog`, and `com.consuelo.portless.system`, and logs to `~/Library/Logs/Consuelo`. The plists use `RunAtLoad` and `KeepAlive`; no privileged system install is required for local Mac testing.

## Current Boundary

This is runtime foundation work. The scaffold intentionally includes one skill and docs for the shape future skills should follow. Docker, S3 storage, approval delivery, and hosted deployment hardening are separate tasks.

### App files cloud artifact capability

Set `CONSUELO_APP_API_URL` and `CONSUELO_APP_API_KEY` to enable app-visible artifact publishing through Consuelo Files/S3. This capability is separate from app GraphQL reads. Existing `CONSUELO_GRAPHQL_URL` env remains a compatibility fallback for object reads; prefer `CONSUELO_APP_GRAPHQL_URL` for new setups.

## Doctor execution logs

Doctor is the local observability surface for Consuelo OS. Every OS skill execution records a trace id in the local SQLite database at `<CONSUELO_HOME>/consuelo.db`. Future users get the same operator workflow that proved useful in workspace development:

```bash
bun run doctor:watch -- --limit 20
bun run doctor:errors -- --limit 20
bun run doctor:analytics -- --json
```

Doctor redacts known secret keys, bearer/API tokens, credential-like values, full phone numbers, sensitive URL query values, and raw payload bodies before writing execution logs or printing Doctor output.

Use `--home <path>` or `--db <path>` when inspecting another OS home. The scripts read the packaged OS execution tables and do not depend on Ko's local workspace trace database.
