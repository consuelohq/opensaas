# Worker 06: Managed Components, Provenance, Merge Classification, and Update Plan

## Dependencies

Begin after the runtime-bundle contract and lifecycle interface are integrated. Coordinate with Worker 05 on content-base retention.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` completely and the repository/OS engineering/task instructions. Start from `stream/os-distribution`. You are not alone in the repo.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Turn the existing bundled skill/tool hash preservation into a complete, deterministic update model for managed skills, tools, site templates, scripts, and job templates while protecting user-owned content.

## Investigation

- Verify existing `.consuelo-skill.json`, `.consuelo-tool.json`, registry generation, manifest overlay, and local-modification behavior.
- Identify which current site/script/job surfaces are genuinely user-customizable.
- Study shadcn-style registry/source ownership as prior art, focusing on how local copies and upstream updates are compared. Document lessons without importing an unnecessary framework.

## Required model

Define stable component identity and ownership:

```text
bundled-managed
custom
detached
```

Record source runtime bundle, base hash/content reference, local hash, upstream hash, installed/updated timestamps, and resolution state.

Generate a deterministic `update-plan.json` with item actions:

```text
install
update-clean
preserve-custom
merge-clean
conflict
remove-upstream
detach
no-change
```

Implement real base/local/upstream comparison. A clean merge may be materialized only after tests prove it. A conflict must preserve local content and require review.

User-owned components and arbitrary Projects/Artifacts are never treated as bundled merely because their names match.

Built-in components execute from the active runtime bundle and store only provenance/selection indexes under `~/.consuelo`. User-authored tools, skills, sites, and steering live in the visible `~/Consuelo` tree. Do not create two editable copies of one component.

Provide typed operations for:

- inspect update plan;
- apply safe items;
- inspect one conflict;
- accept upstream;
- keep local;
- apply a reviewed merged result;
- detach from upstream management;
- restore bundled default into a new path without destroying local content.

AI review is optional presentation on top of these operations. Do not make LLM output part of merge correctness.

## Owned files

- Managed-component/provenance/update-plan modules.
- Metadata schema migrations.
- Content-base cache integration.
- Component update CLI/tool interfaces.
- Focused tests and fixtures for skills, tools, sites, scripts, and jobs.

## Forbidden scope

- Do not move all visible content to `~/Consuelo` in one unbounded migration.
- Do not overwrite conflicts.
- Do not store runtime state in YAML.
- Do not read or merge secrets.
- Do not require Git or GitHub.

## Required tests

- Unmodified bundled update.
- Locally modified bundled component preservation.
- Clean three-way merge.
- Conflicting merge.
- Upstream removal with local modification.
- Name collision with custom component.
- Detach behavior.
- Content-base pruning safety.
- Deterministic plan ordering and stable JSON schema.
- No secrets in plan output.
- Visible user-owned content is never overwritten or shadowed by a hidden editable duplicate.

## Completion output

Report schema, ownership rules, action table, merge algorithm, migration behavior, exact tests, and the compact summary contract consumed by steering and the native app.
