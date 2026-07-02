# align observability trace frontend architecture

branch: `task/os/align-observability-trace-frontend-architecture`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1331/align-observability-trace-frontend-architecture
github pr: https://github.com/consuelohq/opensaas/pull/1331
started: 2026-07-01

## acceptance criteria

- [x] Start the research branch from current local `main` and target `stream/os`.
- [x] Preserve `/observability` as the primary Sites Observability route.
- [x] Preserve `/traces` and `/tracing` as compatibility aliases in the route model.
- [x] Confirm `sites.consuelohq.com` is handled by site-snapshot routing, not reserved-host handling.
- [x] Inspect Trace Sites materialization, edge snapshot publishing, route seeding, browser client, live endpoints, live stream, focused tests, launcher Astro, and website theme files.
- [x] Classify the current Observability shell architecture.
- [x] Identify the migration path to Astro without React.
- [x] Call out React drift / incorrect implementation paths.
- [x] Produce a proposed implementation slice, file list, and focused test list.
- [x] Avoid product code changes on this research branch.

## current status

Research/alignment complete. No product code changed. This workpad is the only intended branch output.

Important branch-base note: this task was started from local `main` as requested. `origin/stream/os` is currently ahead of `main` with the latest `task(os): wire trace sse live stream` work. Research inspected both the task branch/main files and the `origin/stream/os` versions of the SSE files. The implementation branch must preserve the stream SSE changes; do not reintroduce the main-branch one-shot snapshot behavior.

## research read map

Primary files inspected:

- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/trace-sites-browser-client.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- `packages/os/scripts/lib/consuelo-sites-trace-adapter.ts`
- `packages/os/scripts/server.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/consuelo-website/src/pages/os/launcher.astro`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/consuelo-website/src/styles/primitives.css`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- relevant `packages/os/tests/trace-sites-*`, Sites, launcher, edge-route, and workspace archive tests.

## current Observability shell classification

The current tracked shell is not Astro-backed and not React-backed. It is generated static HTML with inline CSS and inline browser JavaScript from `buildTracesSite()` in `packages/os/scripts/lib/sites.ts`, then written to `sites/traces/index.html` by `materializeSites()`.

The generated shell currently:

- renders the page title/header as `Traces`;
- fetches `/gateway/traces/recent` directly from inline browser JS;
- renders a trace table with Time, Tool, Latency, Tokens, Branch, Input, Output;
- uses simple normalization helpers in inline JS;
- truncates Input/Output with CSS and native `title` attributes;
- does not consume `/gateway/traces/summary` or `/gateway/traces/events` from the generated page yet.

So the state is transitional:

- OS owns install/runtime materialization and local gateway endpoints.
- The public website already uses Astro for the launcher and shared theme tokens.
- Trace Sites frontend source is still embedded in an OS TypeScript string.
- The old design/archive route machinery still maps `/observability` and `/tracing` to `/trace-burn-intelligence`, but that artifact is not present in this task worktree.

## routing and snapshot findings

`workspace-edge-route-seed.ts` is aligned with the product direction:

- `/observability` routes to the `traces` site snapshot.
- `/traces` routes to the same `traces` site snapshot.
- `/tracing` routes to the same `traces` site snapshot.
- `/gateway/traces/events` routes to `trace-sites-live-endpoints`.
- `/gateway/traces` routes to `trace-sites-read-layer`.
- Gateway routes use `publicSiteRouteFamily: '/observability/*'`.

`workspace-cloudflare-edge-router.ts` no longer includes `sites.consuelohq.com` in `DEFAULT_RESERVED_HOSTNAMES`; it serves site snapshots with `x-consuelo-edge-cache-authority: sites-snapshot`. This matches the requirement that `sites.consuelohq.com` route through snapshot routing, not reserved-host handling.

`install-edge-site-publisher.ts` uploads/verifies `/observability` and `/traces` snapshots for the `traces` site. It does not currently list `/tracing` in `snapshotSites`, while route seed does include `/tracing`. Next implementation should decide whether `/tracing` must be explicitly verified in the snapshot plan or whether route seed coverage is enough. Product direction says compatibility alias should keep working; the safer implementation is to add `/tracing` to the publisher verification list with the same snapshot key.

## SSE findings

`trace-sites-browser-client.ts` already has the right browser transport contract for a non-React page:

- load `/gateway/traces/recent`;
- load `/gateway/traces/summary`;
- open `/gateway/traces/events?cursor=<cursor>` when `createEventSource` exists;
- fall back to `/gateway/traces/recent?cursor=<cursor>` polling if EventSource creation fails;
- reject direct local runtime URLs in browser-facing paths.

The task branch from `main` still has the older `sseSnapshotResponse()` in `trace-sites-gateway-live-endpoints.ts`, but `origin/stream/os` has the latest valid SSE work:

- imports `createTraceSitesGatewayLiveStreamEndpoint()`;
- handles `/gateway/traces/events` through `sseLiveResponse()`;
- maps read-layer dashboard events into live stream rows;
- emits the live stream endpoint's `snapshot`, `trace`, `keepalive`, and `state` events instead of the old `trace-sites-snapshot` event.

Implementation must start from the stream state or merge it first. Do not regress to the one-shot `trace-sites-snapshot` response.

## workspace trace site preservation update

Ko clarified that the existing internal workspace Trace Burn Intelligence site is the product-quality source to preserve and port, not just an example to inspect. Follow-up exploration found the durable source on branch `origin/task/design/rewrite-trace-burn-intelligence-in-astro-with-tdd`:

- `packages/consuelo-design/trace-burn-intelligence/src/pages/index.astro`
- `packages/consuelo-design/trace-burn-intelligence/src/scripts/traceExplorer.ts`
- `packages/consuelo-design/trace-burn-intelligence/src/scripts/traceStore.ts`
- `packages/consuelo-design/trace-burn-intelligence/src/styles/trace.css`
- `packages/consuelo-design/trace-burn-intelligence/scripts/build.ts`
- `packages/consuelo-design/trace-burn-intelligence/tests/artifactContract.test.ts`
- `packages/consuelo-design/trace-burn-intelligence/tests/traceStore.test.ts`
- `scripts/operator/trace-burn-page-feed.ts`

That source is more complete than the current OS generated shell. It includes the product details that should not be lost: KPI cards, live trace launcher, modal trace cockpit, search, filters, branch/tool aggregation, stable trace identity, detail rail, raw input/output/metadata panes, pagination, mobile full-screen behavior, pseudo-live polling, generatedAt-only refresh suppression, and selected-trace persistence across feed refreshes. It also has TDD coverage and browser validation recorded in its workpad.

The next implementation should therefore port/adapt this workspace Trace Burn Intelligence Astro source into the OS Observability shell instead of recreating the shell from scratch. The API seam changes from the workspace pseudo-live JSON file to OS gateway routes:

- replace `/trace-burn-intelligence/live-traces.json` with `/gateway/traces/recent`, `/gateway/traces/summary`, and `/gateway/traces/events`;
- keep the traceStore stable identity and selected-row persistence semantics;
- preserve the cockpit/modal/table/detail/filter/pagination UX unless a specific OS route constraint forces a tweak;
- preserve the Astro source-first ownership and build handoff pattern;
- preserve the motion/interaction polish from the workspace/design line, including GSAP where that layer is part of the internal trace-site experience, while still avoiding React.

This supersedes the earlier narrow recommendation to add a new Astro shell from the current generated OS string. The generated OS string should be treated as compatibility/bootstrap fallback only; the implementation source of truth should be the internal workspace Trace Burn Intelligence Astro product, adapted to OS gateway contracts.

## Astro alignment recommendation

Recommendation: port the existing internal workspace Trace Burn Intelligence Astro source into the OS Observability shell, then make OS materialization publish the built static shell. Do not jump straight to a React cockpit, and do not keep expanding the `buildTracesSite()` string long-term.

Reasoning:

- The intended product architecture is Astro, and the website already has Astro theme/token anchors.
- The installed OS still needs a static shell at runtime; installs should not require a full `packages/consuelo-website` Astro build on the user's machine.
- The edge snapshot publisher expects a static `sites/traces/index.html` artifact to upload and route.
- The current generated string is maintainability debt, but it is a stable fallback while the SSE/route work settles.
- Porting the existing workspace Trace Burn Intelligence Astro source preserves product polish already paid for, while giving OS a reviewable source without disturbing route recovery or live-stream contracts.

Target architecture:

1. The existing workspace Trace Burn Intelligence Astro source is the baseline product source to port; final OS-owned source should live in `packages/consuelo-website` or an OS package asset source path selected by the implementation branch.
2. The Observability shell remains static HTML plus plain browser JavaScript. No React components, no React routes, no React-only cockpit.
3. Shared visual system comes from `tokens.css`, `primitives.css`, and `MarketingLayout.astro` patterns, not from a new design system.
4. Browser JS consumes the gateway only:
   - initial recent rows from `/gateway/traces/recent`;
   - summary data from `/gateway/traces/summary`;
   - live deltas from `/gateway/traces/events` through `EventSource`;
   - polling fallback to `/gateway/traces/recent?cursor=<cursor>`.
5. `packages/os` owns install/runtime materialization, local trace DB access, gateway endpoints, route seed, edge snapshot publishing, and aliases.
6. `sites.consuelohq.com/observability`, `/traces`, and `/tracing` all serve the same `traces` snapshot; the page itself continues to say `Traces`.

## React drift / incorrect paths to avoid

- `packages/consuelo-website` already has `@astrojs/react`, `react`, `react-dom`, and React-adjacent dependencies. That is existing website drift, not evidence that Observability should be React.
- Do not add React components for this surface.
- Do not add React routes or hydrate the Trace Sites cockpit with React.
- Do not use React-only tooltip/table libraries for the next branch.
- Do not solve frontend maintainability by adding more behavior to the giant inline `buildTracesSite()` string except as a short-lived compatibility fallback.
- Do not route the browser directly to local OS, localhost, tailnet, or raw trace-store endpoints. Browser access should stay behind `/gateway/traces/*`.

## proposed next implementation slice

Slice name: `task/os/port-workspace-trace-burn-astro-to-observability`

Implementation goal: port the internal workspace Trace Burn Intelligence Astro shell into OS Observability while preserving the cockpit UX, Astro source ownership, motion/interaction polish, and route/SSE contracts.

Suggested steps:

1. Start from `stream/os`, not bare `main`, so the SSE live stream wiring is present.
2. Import/adapt the existing Trace Burn Intelligence Astro source from `origin/task/design/rewrite-trace-burn-intelligence-in-astro-with-tdd` instead of rebuilding from the current generated OS string.
3. Keep page chrome text as `Traces` even though route is `/observability`, but preserve the cockpit UX and detail rail from the workspace product.
4. Preserve `traceStore` semantics: stable row identity, generatedAt-only refresh suppression, selected trace persistence, filtering, pagination, and time-only labels.
5. Replace the pseudo-live feed file with OS gateway consumption: `/gateway/traces/recent`, `/gateway/traces/summary`, and `/gateway/traces/events` with polling fallback.
6. Preserve workspace/design motion polish, including GSAP where it is part of the intended internal trace-site interaction layer, while avoiding React.
7. Add a build/export handoff from Astro output to a tracked or generated OS shell asset.
8. Update `materializeSites()` to write the shell asset instead of hard-coded inline HTML when the asset is available, preserving fallback behavior only if needed for install resilience.
9. Add `/tracing` to `install-edge-site-publisher.ts` snapshot verification unless implementation proves route seed alone already covers the deployed alias.
10. Update stale tests that still expect `/traces/*` as the primary Trace Sites public family.
11. Keep `/observability` primary and `/traces`/`/tracing` compatible.

## files the implementation branch should likely touch

Frontend source:

- `packages/consuelo-design/trace-burn-intelligence/**` as source/reference input, or migrated equivalents under `packages/consuelo-website` / `packages/os`
- `packages/consuelo-website/src/pages/os/observability.astro` or `packages/consuelo-website/src/pages/sites/observability.astro`
- `packages/consuelo-website/src/components/os/TraceSitesShell.astro` if a component split is cleaner
- `packages/consuelo-website/src/scripts` or equivalent for ported `traceExplorer.ts` / `traceStore.ts` behavior
- `packages/consuelo-website/src/styles/tokens.css` only if a missing token is genuinely needed
- `packages/consuelo-website/src/styles/primitives.css` only if a reusable primitive is genuinely needed

OS materialization / publishing:

- `packages/os/scripts/lib/sites.ts`
- a new tracked shell asset location, for example `packages/os/scripts/assets/sites/traces/index.html` or another repo-conventional path chosen after checking asset conventions
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts` only if route metadata changes
- `packages/os/scripts/lib/trace-sites-browser-client.ts` only if its existing contract needs to be exported/reused by the generated page
- `scripts/operator/trace-burn-page-feed.ts` as migration reference only; OS should replace this with gateway reads, not keep a separate pseudo-live file as the primary data path

Compatibility/local archive:

- `packages/workspace/scripts/office.ts` if `/traces` should be added as a local archive compatibility alias beside `/observability` and `/tracing`

Tests:

- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/os/tests/trace-sites-browser-client.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/os/tests/consuelo-sites-trace-adapter.test.ts`
- `packages/workspace/tests/office-theme.test.js`
- a website/Astro focused test or `bun --cwd packages/consuelo-website build` once the Astro page exists

## focused tests to add or update next

- Assert materialized `sites/traces/index.html` comes from the ported Trace Burn Intelligence Astro source and still contains `Traces`, `/gateway/traces/recent`, `/gateway/traces/summary`, and `/gateway/traces/events`.
- Assert the browser client path never calls localhost/tailnet/raw trace DB routes.
- Assert `/observability`, `/traces`, and `/tracing` resolve to the same `traces` site snapshot route.
- Assert snapshot publishing verifies `/observability`, `/traces`, and `/tracing` for the `traces` shell, or explicitly document why `/tracing` is route-only.
- Update stale Trace adapter expectations from `/traces/*` to `/observability/*` as primary public route family.
- Keep live endpoint tests aligned with `origin/stream/os`: `/gateway/traces/events` should emit live stream events, not `trace-sites-snapshot`.
- Add a workspace archive test that `/traces` aliases to `/trace-burn-intelligence` if that local compatibility path remains supported.

## bounded decisions / ambiguities

- Need decision: final source path should be `src/pages/os/observability.astro`, `src/pages/sites/observability.astro`, or a component plus build-copy target. Product direction points to Astro but not exact source location.
- Need decision: should the OS package commit a built static shell asset, generate it during release, or copy it from website build output during OS release packaging? Recommended: release-time generated asset checked or copied into an OS package asset path so installs do not run Astro.
- Need decision: whether the old `/trace-burn-intelligence` archive path remains as a compatibility alias, but its Astro source should be treated as the implementation baseline to port into OS Observability.
- Need decision: whether `/tracing` must be verified by `install-edge-site-publisher.ts`; route seed already contains it, but publisher does not.

## validation evidence

Read-only research was performed before editing this workpad. No product code changes were made.

Representative inspection traces:

- `trc_e6809b08cf4d` - initial task branch status after task creation.
- `trc_fcc53608c9eb` - `sites.ts` trace shell and materialization inspection.
- `trc_e6a5b33a395f` - workspace edge route seed inspection.
- `trc_b67a8886129b` - launcher Astro and website source inspection.
- `trc_30aaa710a97e` - website theme token/layout inspection.
- `trc_d4e7ee6c9d90` and `trc_aebce46478ce` - `origin/stream/os` SSE stream wiring inspection.
- `trc_0b67d5f076d2`, `trc_297ad3fabb04`, `trc_aa62eb79613e`, `trc_b301e9d61043` - internal workspace Trace Burn Intelligence Astro source, scripts, tests, and build handoff inspection.

## files changed

- `.task/os/align-observability-trace-frontend-architecture/workpad.md`

## workspace-owned: files changed

- `.task/os/align-observability-trace-frontend-architecture/workpad.md`
- `.task/os/align-observability-trace-frontend-architecture/current.json`
- `.task/os/align-observability-trace-frontend-architecture/session.json`
- `.task/tasks/os/align-observability-trace-frontend-architecture.json`

## workspace-owned: validation evidence

- `git status --short --branch`: only task metadata/workpad files are changed.
- `verify` (`trc_e92a3d7f702c`): failed full gate due pre-existing unrelated repo issues; changed-file selection passed with zero focused suites because changes are docs/task metadata only; DB guard passed with 0 findings; review reported 0 issues from this branch.
- 2026-07-01 21:21:12 `verify`: failed — COMMAND_FAILED
- 2026-07-01 21:21:12 `verify`: failed — COMMAND_FAILED

## key decisions

- Treat Astro as the intended page architecture for Observability / Trace Sites.
- Keep OS as the runtime owner for installed materialization, local trace reads, gateway endpoints, route seed, and edge snapshot publishing.
- Port the workspace Trace Burn Intelligence Astro source; keep the generated OS shell only as fallback during migration.
- Preserve stream SSE changes; do not regress to one-shot `trace-sites-snapshot` behavior.

## notes for ko

The next implementation should port the existing internal workspace Trace Burn Intelligence Astro product into OS Observability, not recreate the UI from the current generated shell. Tooltip/highlight work should ride on that port after the gateway data seam is stable.

## improvements noticed

- `install-edge-site-publisher.ts` should probably include `/tracing` in `snapshotSites` for alias verification.
- `packages/workspace/scripts/office.ts` aliases `/observability` and `/tracing`, but not `/traces`.
- `packages/os/tests/consuelo-sites-trace-adapter.test.ts` has stale `/traces/*` expectations while implementation uses `/observability/*`.

## issues and recovery

- `workspace stream.context` was blocked by safety checks, but task creation from local `main` to `stream/os` succeeded and session metadata is present.
- The task branch intentionally starts from local `main`; latest SSE work is on `origin/stream/os`, so research inspected stream files explicitly.

---

## publish checklist

```bash
bun run task:push -- --message "docs(os): align observability trace frontend architecture" --changed
```

## workspace-owned: test selection

- changed files: `.task/os/align-observability-trace-frontend-architecture/current.json`, `.task/os/align-observability-trace-frontend-architecture/session.json`, `.task/os/align-observability-trace-frontend-architecture/workpad.md`, `.task/tasks/os/align-observability-trace-frontend-architecture.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed files are docs or task metadata
