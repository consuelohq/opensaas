# Worker 16: Workspace Trace Table Through Hono

## Dependencies

Begin after Worker 13 defines the authenticated workspace contract. Coordinate with Worker 15 on route ownership.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md`, repository steering, OS skills, and the existing trace-site implementation before editing. Start from `stream/os-web`. Do not revert concurrent changes.

Read Worker 25's explicit-node routing contract before selecting a node data source. The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory.

## Objective

Bring only the useful Astro trace-table/live-feed experience into the authenticated OS Hono server for each workspace. Do not migrate the entire old dashboard or introduce React.

## Required investigation

- Read the current Astro trace site, live recent-trace endpoint, table formatters, virtualization, inspector behavior, raw payload detail views, and archive refresh behavior.
- Read current local Hono trace routes/services.
- Identify static build versus runtime API boundaries.
- Verify workspace database and node routing semantics.

## Required implementation

- Serve the trace table/assets through the existing Hono app or a clearly owned static-resource adapter.
- Reuse semantic row formatting and retain raw payloads in details.
- Preserve near-live polling/cursor behavior without unbounded responses.
- Scope every trace query to the authenticated workspace and appropriate node/state source.
- Never silently read traces from another online node when the selected/default node is offline; disclose the node state and require explicit selection.
- Keep selection, open state, collapse/fullscreen, and refresh behavior stable.
- Ensure archive/static refresh cannot replace live local assets unexpectedly.
- Add empty, offline-node, loading, error, and reconnect states.
- Do not expose bearer tokens, prompts containing secrets, or unredacted environment values.

## Owned files

- OS Hono trace route/service integration.
- Trace static build/materialization adapter.
- Existing trace-site files only where required to extract reusable table behavior.
- Focused unit, route, and browser tests.

## Forbidden scope

- No React rewrite.
- No full dashboard migration.
- No nested decorative UI redesign.
- No unauthenticated trace feed.
- No multiple peer-authoritative workspace databases.

## Required tests

- Authenticated workspace isolation.
- Opaque cursor/pagination and near-live refresh.
- Real trace shapes including browser calls, error envelopes, and command arrays.
- Raw details retained while rows stay semantic.
- Stable inspector interactions during refresh.
- Offline-node and empty-state behavior.
- Static asset and Hono route integration.
- Redaction and no cross-workspace cache leak.
- Browser screenshots at desktop/mobile sizes if presentation changes.

## Completion output

Report reused versus retired surfaces, route/API contract, workspace data source, interaction proof, tests/screenshots, and deployment integration needed by Worker 17.
