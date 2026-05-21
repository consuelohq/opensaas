# Consuelo OS v1

Consuelo OS is a managed AI operating system for revenue teams.

It gives ChatGPT, Claude, and other agents a small role-aware portal into a customer workspace:

- `get_steering`
- `get_dev_steering`
- `call`

## Why a small OS portal

The OS portal stays small so agents get one stable operating contract. Customer capabilities are skills behind `call`, not separate OS portal entrypoints.

This keeps the agent map small while the Bun scripts own runtime behavior, permission checks, and future approval enforcement.

## get_steering

`get_steering` returns the context an agent needs before acting:

- OS identity
- runtime identity when configured
- business context
- data model notes
- permission rules
- integration notes
- available skills
- raw default tool manifest
- docs pointers

## get_dev_steering

`get_dev_steering` returns build, design, deployment, debugging, and internal operator context. It preserves the proven workspace steering, decision process, and tool manifest with a short OS-specific preface.

Use it for landing pages, Consuelo Design, GitHub, Supabase/auth, deployment, file workflows, and operator/debug tasks.

## call

`call` executes a named skill.

Example:

```json
{
  "name": "daily-revenue-brief",
  "input": {},
  "workspaceId": "7d0894c1-bdb1-4dd6-9a00-78681b52d5f6"
}
```

## Skills

Skills are Bun scripts under `scripts/` and are exposed to agents through `tooling/tool-manifest.json`.

Each default manifest entry declares name, title, description, permission level, approval rules, write/external side effect flags, required env, required integrations, and input/output schema hints.

## Smoke skill

`daily-revenue-brief` proves:

```text
call("daily-revenue-brief") -> Bun skill -> optional GraphQL proof query -> structured result
```

It returns scaffold status, GraphQL status, future wiring steps, and an artifact descriptor.
