# Worker 26: Canonical Tool Packages And Generated Manifests

## Mandatory context

Bootstrap with `os.get_steering()`, then read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` and this brief in full. Use `os.call` with a task session from `stream/os-distribution`. This task changes organization and authority, not public tool behavior.

## Mission

Remove the ambiguous `scripts` versus `tools` versus `tooling` model and establish one canonical tool-package architecture whose generated manifests route typed tool IDs to implementations.

## Current facts to verify

- `packages/os/scripts` has roughly 95 top-level files and mixes tool handlers with lifecycle/operator commands.
- `packages/os/tooling` contains manifest sources, generated/legacy manifests, schemas, workflow metadata, and parity classifications.
- `packages/os/tools` contains a small legacy Python tool collection rather than the primary OS tool catalog.
- `packages/os/manifests/tool.manifest.json` currently has 152 generated tools from three sources; `core.manifest.json` has 13 steering/bootstrap tools.
- `packages/os/tooling/dev-tool-manifest.json` has 123 tools and `media-tool-manifest.json` has 25. Both capability sets remain in the generated full catalog.
- `packages/os/tooling/tool-manifest.json` has four legacy skill actions, including stale `get_raw_steering`, `daily-revenue-brief`, and `consuelo-workspace-snapshot` entries.
- `workflow-bundles.json` is actively consumed by manifest overlay, settings snapshot, install state, the intent hook, and workflow tests; it is a workflow runtime output, not a competing tool manifest.
- `script-parity-classifications.json` is internal audit data that currently ships accidentally, and `tool-manifest.schema.json` is a build/test/docs validation schema.
- Some scripts expose multiple coherent tool actions and should not be split into one folder per action blindly.

## Target structure

```text
packages/os/tools/<domain>/
  manifest.ts
  handler.ts
  schema.ts
  handler.test.ts

packages/os/manifests/
  manifest.config.ts
  schemas/tool-manifest.schema.json
  generated/tool.manifest.json
  generated/core.manifest.json

packages/os/workflows/
  workflows.ts
  generated/workflow-bundles.json

packages/os/scripts/
  lifecycle entrypoints
  CLI/generator/operator entrypoints
```

Every callable tool uses a Bun TypeScript handler. Generated JSON files are build outputs, never editable source. Hono is not part of local tool execution; it remains limited to HTTP route boundaries.

## Required implementation

1. Build a complete inventory mapping every manifest tool to its implementation, schema, tests, runtime dependencies, and current directory.
2. Classify every top-level script as tool handler, lifecycle command, generator, operator-only command, test utility, or dead code.
3. Define one tool-package contribution schema and deterministic aggregate-manifest generator.
4. Migrate a representative vertical slice, then the remaining active customer tool handlers in bounded groups.
5. Preserve current intentional public tool IDs, schemas, scopes, approvals, and behavior. Remove the stale four-entry legacy skill surface rather than preserving aliases; individually retain an action only if usage and product intent are proven.
6. Generate the full executable/search catalog from the 123 development-tool and 25 media-tool capabilities (verified initial target: 148 after the four stale legacy entries are removed). Generate the small core steering/bootstrap subset from explicit TypeScript configuration. Assert inventory parity without permanently hard-coding 148 as a product limit. Full and core are the only shipped tool manifests.
7. Move workflow source/output under `packages/os/workflows` and preserve all active workflow consumers and tests. Do not merge workflows into the tool manifest.
8. Move `script-parity-classifications.json` to an internal test/audit fixture path and exclude it from the runtime bundle. Keep `tool-manifest.schema.json` under `manifests/schemas` for build/test/docs validation and exclude it unless a runtime consumer is proved.
9. Remove stale `manifest-sources.json`. Delete `packages/os/tooling` in this release only after every active consumer and test uses tool packages, generated full/core catalogs, and workflow outputs.
10. Classify the legacy Python tools individually; migrate active customer behavior to Bun/TypeScript, intentionally retain non-runtime utilities outside the bundle, or delete dead code with usage proof.
11. Update runtime-bundle classification so handlers plus generated full/core and workflow outputs ship, while source-only generators, schema-only files, and audit fixtures do not.

## Constraints

- Do not rewrite working handlers merely to move them.
- Do not change 150 tool IDs or schemas in one unreviewable sweep.
- Do not leave duplicate editable manifests.
- Do not add compatibility shims, deprecated aliases, path bridges, or duplicate dispatch. This is a pre-launch clean cutover: switch consumers and tests, then delete superseded sources in the same release.
- Do not move lifecycle/update/install/service commands into tool packages unless they are genuinely callable tools.
- Do not delete customer capabilities to simplify structure.
- Provider workers 08-12 consume this layout and must not reintroduce `tooling`.

## Tests

- Every public tool resolves to exactly one package/handler.
- No handler is orphaned and no generated manifest entry has an unknown implementation.
- Deterministic generation produces byte-identical manifests.
- Generated-file drift fails CI.
- Core/non-core visibility, scopes, approvals, input/output schemas, and discovery behavior remain unchanged.
- The generated full catalog includes all current dev and media capabilities; the core catalog remains the explicit steering/bootstrap subset.
- Workflow-bundle consumers and behavior remain green after their source/output move.
- Legacy stale actions and manifest-source files have no remaining runtime, test, docs, or generated references before deletion.
- Runtime-bundle allowlist includes required handlers and excludes operator/source-only files.
- `packages/os/tooling` has no remaining runtime/import references before deletion.

## Acceptance gates

- One canonical manifest authority exists.
- Active tool implementations have clear package ownership.
- `scripts` contains only justified lifecycle, CLI, generator, and operator entrypoints.
- `tooling` is removed, not left as a confusing duplicate.
- Existing facade/tool behavior passes unchanged plus the new parity tests.

## Review and completion

Request CodeRabbit and run the approved Grok 4.5 review. Save the prompt, metadata, response, inventory, cutover map, and finding dispositions under `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/reviews/<task>/` and the task workpad.
