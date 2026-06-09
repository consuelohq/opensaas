# Consuelo OS

Consuelo OS is the local and hosted runtime that turns a company into an agent-ready workspace.

The current package proves this spine:

```text
get_steering -> call -> Bun skill -> structured result -> local execution record
```

The product runtime path is Bun/TypeScript. Python files remain only as temporary compatibility/bootstrap surfaces until the Bun server fully replaces transport needs.

## OS portal

The OS portal exposes two package entrypoints:

- `get_steering`
- `call`

The visible OS portal is `get_steering` and `call`. Internal/dev/operator raw steering is available through `call` with `name: "get_raw_steering"`.

Skills live behind `call` as Bun scripts under `scripts/`. They are exposed through manifests in `tooling/`.

Manifests are manifests. Skills are the capabilities that agents can run. Scripts are the executable implementation behind those skills.


## Docs

Operating docs live in `packages/os/docs/`:

- `docs/runtime-surfaces.md` — OS server/runtime surfaces.
- `docs/skills.md` — current skill contracts and examples.
- `docs/permissions.md` — permission and approval levels.
- `docs/env-capability-matrix.md` — runtime capabilities and env shape.

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

Return raw dev/operator steering through `call`:

```bash
bun --cwd packages/os ./scripts/os.ts call '{"name":"get_raw_steering"}'
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

## First-time Mac install

Hosted install path:

```bash
curl -fsSL https://install.consuelohq.com/os | bash
```

The hosted `/os` route is implemented by the production app server and serves the maintained source at `packages/os/scripts/bootstrap.sh` as a shell script. Railway/DNS should map `install.consuelohq.com` to the same production service that serves the app API, with the path `/os` left intact. If the deployed working directory differs from the repo root, set `CONSUELO_OS_BOOTSTRAP_SCRIPT_PATH` to the absolute path of `packages/os/scripts/bootstrap.sh` in that container.

Repo-local bootstrap testing:

```bash
bash packages/os/scripts/bootstrap.sh --dry-run
bash packages/os/scripts/bootstrap.sh --yes --install-daemons
bash packages/os/scripts/bootstrap.sh --yes --skip-daemons
```

The bootstrap is a pre-Bun shell script. It assumes macOS plus baseline `bash`, `curl`, and `uname`; verifies macOS tools `launchctl`, `plutil`, and `lsof`; installs Bun only after confirmation unless `--yes` is passed; and fails with manual Bun instructions when `--no-install-bun` is used. It does not use `sudo`, install privileged system daemons, source arbitrary `.env` files, or mutate LaunchAgents during dry-run.

When run outside a repo checkout, the hosted bootstrap downloads the Consuelo source into `~/.consuelo/source/opensaas` by default, installs the OS package dependencies with Bun, then hands off to onboarding:

```bash
bun --cwd packages/os ./scripts/install.ts --yes
```

Dry-run uses the non-mutating onboarding plan:

```bash
bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json
```

Consuelo OS runs a local background service on your Mac so agents and apps can reach your OS while you work. This is similar to common Mac utilities that run in the background. You can stop or uninstall it later.

After onboarding, the bootstrap offers user LaunchAgent setup unless `--skip-daemons` is passed. `--yes` alone skips LaunchAgents; `--yes --install-daemons` installs them without another prompt. The user LaunchAgents install to:

```text
~/Library/LaunchAgents/com.consuelo.system.plist
~/Library/LaunchAgents/com.consuelo.watchdog.plist
~/Library/LaunchAgents/com.consuelo.portless.system.plist
```

The labels stay:

```text
com.consuelo.system
com.consuelo.watchdog
com.consuelo.portless.system
```

Logs go under:

```text
~/Library/Logs/Consuelo
```

Validate LaunchAgent setup without installing services:

```bash
bun --cwd packages/os run install:system-daemons:dry-run
```

Install LaunchAgents explicitly:

```bash
bun --cwd packages/os run install:system-daemons
```

Status and stop paths are available through the local server helper and `launchctl`:

```bash
bun --cwd packages/os run server -- status
bun --cwd packages/os run server -- stop
launchctl bootout "gui/$(id -u)/com.consuelo.watchdog" || true
launchctl bootout "gui/$(id -u)/com.consuelo.portless.system" || true
launchctl bootout "gui/$(id -u)/com.consuelo.system" || true
```

To remove the user LaunchAgent plists after stopping them:

```bash
rm -f ~/Library/LaunchAgents/com.consuelo.system.plist
rm -f ~/Library/LaunchAgents/com.consuelo.watchdog.plist
rm -f ~/Library/LaunchAgents/com.consuelo.portless.system.plist
```
## Current Boundary

This is runtime foundation work. The scaffold intentionally includes one skill and docs for the shape future skills should follow. Docker, S3 storage, approval delivery, and hosted deployment hardening beyond the `/os` bootstrap route are separate tasks.

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
