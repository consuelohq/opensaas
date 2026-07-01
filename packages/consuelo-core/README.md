# Consuelo Core

`packages/consuelo-core` owns shared Consuelo contracts and migration guardrails. The first registry version records package ownership, script entrypoints, tool/facade ownership, skill ownership placeholders, migration status, source-of-truth refs, exposure, and validation commands.

The registry exists to prevent workspace/OS migration breakage. During migration, scripts and helpers may be copied into `packages/os`, but workspace-owned sources must remain available while root or workspace callers still point at `packages/workspace`.

## Registry Files

- `registry/packages.json` records package ownership.
- `registry/scripts.json` records script entrypoints and resolved repo targets.
- `registry/tools.json` records facade/tool ownership.
- `registry/skills.json` records skill ownership placeholders without moving or rewriting skill bodies.
- `src/registry/types.ts` defines the typed schema.
- `scripts/audit-registry.ts` runs script target, local import, ownership, and drift audits.

## Migration Workflow

Before copying or moving a script/helper between `packages/workspace` and `packages/os`:

1. Check `registry/scripts.json` for the script owner, migration status, source-of-truth path, and validation list.
2. If ownership remains `workspace-owned`, keep the workspace source and helpers in place.
3. If moving ownership to OS, update all package script callers, registry ownership, migration status, source-of-truth metadata, and validation in the same PR.
4. Run `bun --cwd packages/consuelo-core audit:registry` and keep the focused registry tests green.
5. Use the drift report to review copied helper paths before deciding whether a copy should stay duplicated, move to shared core, or remain workspace-owned.

## Commands

```bash
bun --cwd packages/consuelo-core test tests/registry.test.ts
bun --cwd packages/consuelo-core audit:registry
bun --cwd packages/consuelo-core drift:registry
```

`drift:registry` is informational. It reports duplicate relative paths across `packages/workspace/scripts` and `packages/os/scripts` with SHA-256 hashes and ownership hints.
