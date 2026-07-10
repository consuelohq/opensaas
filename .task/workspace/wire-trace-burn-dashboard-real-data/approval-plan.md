# Trace Burn Intelligence real-data task

## Goal
Turn the shipped HTML mockup into a real script-generated dashboard suitable for `profile.consuelohq.com` behind Cloudflare, without rewriting the current visual work owned by the design/html agents.

## Current inputs confirmed
- `scripts/operator/trace-costs.ts` exists and prices trace rows using `scripts/operator/trace-pricing-registry.json`.
- `scripts/operator/trace-analytics.ts`, `trace-errors.ts`, `trace-watch.ts`, and `trace-home.ts` already cover most of the trace/read/failure/live-feed data surface.
- `packages/workspace/scripts/status.js` and `scripts/health-check.sh` exist for workspace health.
- A backup of the current shipped HTML was copied to `/tmp/trace-burn-intelligence-backups/` before any real-data work.

## Proposed architecture
1. Build-time cache generator
   - Add a dashboard payload mode to the trace scripts, or add a small orchestrator script such as `scripts/operator/trace-dashboard-build.ts`.
   - It should call or import the existing analytics/cost/error logic and emit one normalized JSON payload.
   - Output target: `tmp/trace-burn-dashboard/payload.json` first, then a profile/static target when Cloudflare migration is ready.

2. Payload contract
   - `generated_at`, `range`, `trace_db`, `workspace_health`
   - `kpis`: total tokens, input/output tokens, calls, errors, error rate, total cost, avg cost/call, avg burn/call
   - `heatmap`: 7 x 24 cells with `{ day, hour, tokens, input_tokens, output_tokens, cost_usd, calls, errors, top_tool, top_branch, top_session, state }`
   - `rankings`: top tools, branches, sessions, models, prompt/task categories
   - `failures`: failed expensive traces, error causes, safety blocks, timeouts, missing task sessions
   - `live_seed`: initial recent trace rows for first paint
   - `pricing`: registry version/hash, default model, coverage/unpriced rows

3. Runtime behavior
   - Heatmap and KPI data are page-load cached, not fetched on hover.
   - Hover/tooltips read from `window.__TRACE_BURN_CACHE__` or embedded JSON instantly.
   - Live trace feed and workspace health can poll a small JSON endpoint or periodically refresh from a generated file.
   - No browser DB access; no Cloudflare worker needs local sqlite access.

4. Implementation boundaries
   - Do not overwrite the current hand-edited HTML during design iteration.
   - Treat HTML as a consumer of the payload contract.
   - Script work happens in this branch; HTML integration happens only after the payload contract is stable or by explicit request.

## Acceptance criteria
- `bun run trace:costs -- --json` remains working.
- New dashboard payload command emits deterministic JSON for the shipped UI.
- Heatmap cells can be generated from real trace DB rows and priced by `trace-pricing-registry.json`.
- Workspace health payload uses real status/health sources when available and marks missing sources explicitly.
- Add a fixture or sample JSON so the HTML agents can wire without needing a live trace DB.
- Include a README note for Cloudflare/static deployment behavior.
