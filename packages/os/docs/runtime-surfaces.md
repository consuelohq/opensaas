# Runtime Surfaces

Consuelo OS keeps a small OS portal while preserving powerful package capabilities behind it.

## OS portal entrypoints

OS portal entrypoints are the public agent entrypoints:

- `get_steering`
- `get_dev_steering`
- `call`

Business/revenue agents should start with `get_steering`.

Build, design, deployment, and internal operator agents should start with `get_dev_steering`.

All operational work should run through `call` when it is a named skill/capability.

## Skills

Skills are approved OS capabilities behind `call`.

Examples:

- `daily-revenue-brief`
- `lead-prioritizer`
- `build-landing-page`
- `open-design-tool`
- `deploy-landing-page`
- `configure-supabase-auth`
- `sync-leads`
- `review-meta-ads`

The default/revenue tool manifest is:

```text
packages/os/tooling/tool-manifest.json
```

Each exposed skill declares permission metadata, approval rules, required env, and integration requirements for agent steering. Runtime behavior lives in the Bun script itself.

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

There are two manifest surfaces in this scaffold:

- `tooling/tool-manifest.json`: default business/revenue agent map used by `get_steering` and `call`.
- `tooling/dev-tool-manifest.json`: restored original workspace/operator typed facade registry used by `get_dev_steering` and operator scripts.

The principle is:

```text
small OS portal entrypoints, powerful classified OS runtime behind them
```
