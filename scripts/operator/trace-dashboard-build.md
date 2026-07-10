# Trace Burn Intelligence payload builder

`trace-dashboard-build.ts` turns the local trace SQLite database into a static JSON payload for the Trace Burn Intelligence page. The HTML should consume this payload; it should not query SQLite or recompute costs in the browser.

## Commands

```bash
bun run trace:dashboard -- --since 7d
bun run trace:dashboard -- --since 24h --out tmp/trace-burn-dashboard/payload.json
bun run trace:dashboard -- --fixture --json
```

Default output is `tmp/trace-burn-dashboard/payload.json`.

## Payload contract

The payload includes:

- `kpis`: calls, errors, token totals, estimated USD cost, failed cost, average burn/cost, and analytics-script cost.
- `heatmap`: a 7 x 24 cache with per-cell tokens, input/output tokens, cost, calls, errors, top tool, top branch, top session, state, and intensity class.
- `rankings`: top tools, branches, sessions, models, and task/prompt categories.
- `failures`: error cause rankings and failed expensive traces.
- `live_seed`: recent rows for first paint before polling starts.
- `workspace_health`: status derived from real source availability, trace-row coverage, pricing coverage, and supporting script availability.
- `pricing`: pricing registry hash, model coverage, and unpriced row count.

## Runtime model

For Cloudflare/profile deployment, generate this JSON server-side or at build time and serve it as static data. The page should cache this payload on load so heatmap hovers and popovers are instant. Poll only the live surfaces, such as trace feed and workspace health. Do not expose the local trace database to the browser.

## HTML integration notes

The shipped mockup currently has `window.__TRACE_BURN_CACHE__` and `window.__WORKSPACE_HEALTH_CACHE__` placeholders. Replace those placeholders with this payload, or fetch this payload once on page load and hydrate those caches from it.
