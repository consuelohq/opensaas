# Runtime Surfaces

Consuelo OS keeps a small OS portal while preserving powerful package capabilities behind it.

## OS portal entrypoints

OS portal entrypoints are the agent entrypoints:

- `get_steering`
- `call`

Business/revenue agents should start with `get_steering`.

Build, design, deployment, and internal operator agents should start with `get_steering`, then call `get_raw_steering` when they need full raw operator context.

All operational work should run through `call` when it is a named skill/capability.

## Bun runtime

The product runtime path is Bun/TypeScript.

Current runtime layers:

```text
scripts/server.ts   -> local OS HTTP server
scripts/os.ts       -> Bun CLI and callable runtime spine
scripts/revenue/*   -> skill implementation scripts
scripts/lib/*       -> manifest, runtime state, GraphQL, artifacts
```

The legacy Python server remains a temporary compatibility wrapper. It should not be extended as the product path.

Local OS state defaults to `~/.consuelo/os` and can be changed with `CONSUELO_HOME`. The runtime records calls in SQLite at `~/.consuelo/os/consuelo.db` and creates local folders for artifacts, logs, runs, and temp files.

The default local port is `8850`. Override it with `CONSUELO_OS_PORT`.

## Skills

Skills are approved OS capabilities behind `call`.

Examples:

- `daily-revenue-brief`
- `lead-prioritizer`
- `build-landing-page`
- `open-design-tool`
- `deploy-landing-page`
- `sync-leads`
- `review-meta-ads`

The canonical full manifest is:

```text
packages/os/manifests/tool.manifest.json
```

The generated core steering subset is:

```text
packages/os/manifests/core.manifest.json
```

Each exposed skill declares permission metadata, approval rules, required env, and integration requirements for agent steering. Runtime behavior lives in the Bun script itself.
Manifests are manifests. Skills are capabilities. Scripts are executable implementation.

## Package and operator scripts

Package scripts are internal/runtime/operator commands. They can be numerous because they power the OS behind the small OS portal.

Examples include:

- filesystem and context tools
- design tooling
- docs/type generation
- checks and review helpers
- deployment/logging helpers
- operator debugging commands

These scripts are not automatically customer-facing skills. Preserve them, classify them, and expose them through role-aware steering or skill wrappers when appropriate.

## Tool manifests

There are generated runtime manifests and preserved source inputs in this scaffold:

- `manifests/tool.manifest.json`: canonical full OS tool manifest used as the execution/search source of truth.
- `manifests/core.manifest.json`: generated default steering subset derived from the full manifest.
- `tooling/tool-manifest.json` and `tooling/dev-tool-manifest.json`: preserved source inputs consumed by `manifests/manifest.config.json`.

The principle is:

```text
small OS portal entrypoints, powerful classified OS runtime behind them
```

## Docker boundary

Docker is an operations/deployment path once supported. Local OS does not require Docker.

The current runtime task should not document Docker as the local path. Docker hardening belongs in a separate deployment task.
