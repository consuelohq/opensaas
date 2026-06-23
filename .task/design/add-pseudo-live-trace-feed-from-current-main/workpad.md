# add pseudo live trace feed from current main

branch: `task/design/add-pseudo-live-trace-feed-from-current-main`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1186/add-pseudo-live-trace-feed-from-current-main
github pr: https://github.com/consuelohq/opensaas/pull/1186
started: 2026-06-23

## goal

Give the local Trace Burn Intelligence archive page a pseudo-live feed by polling a JSON file generated from the local OpenWorkspace trace SQLite database.

## constraints

- Do not edit `packages/os/**`.
- Preserve raw payloads for development inspection.
- Keep the existing static embedded rows as fallback.
- Keep the live-ish path simple: a local polling JSON feed, not the full OS live tracing architecture.
- Treat `.od/` archive artifact edits as local runtime state because the archive folder is ignored by git.

## acceptance criteria

- [x] Add a repo script that exports recent trace rows to `live-traces.json` beside the Trace Burn Intelligence artifact.
- [x] Preserve raw payload fields by default in the exported feed.
- [x] Include failure rows and meta totals in the feed.
- [x] Patch the local ignored archive page to poll `live-traces.json` every 15 seconds and rerender the trace explorer.
- [x] Start a local background feed writer for Ko's current page.
- [x] Validate browser rendering, polling, row count, raw payloads, and inspector behavior.
- [x] Validate script syntax and design boundary checks.
- [x] Update script docs.

## implementation

Tracked repo changes:

- `scripts/operator/trace-burn-page-feed.ts`
- `package.json`
- `packages/workspace/SCRIPTS.md`

Local ignored runtime changes:

- `/Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/index.html`
- `/Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/live-traces.json`

The script writes a single feed file with this shape:

```json
{
  "meta": { "generatedAt": "...", "rowCount": 250, "failureCount": 24, "maxRowid": 5076 },
  "rows": [],
  "failures": []
}
```

Raw payload fields are included by default on each row:

- `rawInputJson`
- `rawResolvedInputJson`
- `rawResultJson`
- `rawStderr`

The local page patch uses `fetch('/trace-burn-intelligence/live-traces.json?t=' + Date.now(), { cache: 'no-store' })`, applies the new rows into `tbxTraceRowsData`, applies failures into `consueloFailureRowsData`, updates the health pill, and rerenders the trace explorer when open.

The running local feeder is:

```text
pid: 76621
pid file: /tmp/trace-burn-feed/pid
log file: /tmp/trace-burn-feed/live.log
interval: 15 seconds
limit: 250 rows
artifact dir: /Users/kokayi/Dev/opensaas/packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence
```

## validation evidence

- `trc_59b360bffe53`: generated a 500-row raw feed; it worked but took about 48s, so the default was reduced.
- `trc_765efff92a62`: generated a 250-row raw feed in about 4s: 250 rows, 24 failures.
- `trc_3e38cb986ef9`: focused script smoke wrote 5 rows to `/tmp/trace-burn-feed-verify/live-traces.json`; all 5 rows had raw payload fields.
- `trc_1171f68634de`: patched the ignored local archive HTML with the polling feed hook.
- `trc_7b9b033a39fc`: background feed process wrote `/live-traces.json`; file had 250 rows, 24 failures, 9.1 MB, maxRowid 5076.
- `trc_4eb3ea04e571`: browser page loaded and health pill showed pseudo-live state from the JSON feed.
- `trc_cca870d3a468`: browser eval confirmed feed marker installed, 250 rows, 24 failures, 250 raw rows, 100 rendered rows, `250 traces` footer, and inspector Input/Output/Metadata visible.
- `trc_ea4b3803e0ad`: TypeScript transpiler syntax check passed and `bun run consuelo-design check --json` passed.

## caveats

- The page patch lives in ignored `.od/` runtime state, so it is active on Ko's machine now but not represented in the PR diff.
- The PR carries the reusable exporter script, package command, and docs. A future durable archive publish or tracked source conversion would be needed to make the polling hook reproducible from git alone.
- A first task PR, `#1185`, was created from `stream/design` before discovering the archive artifact only existed on current main/runtime state. It was left untouched because closing PRs is durable GitHub cleanup.

## workspace-owned: validation evidence

- `trc_59b360bffe53`: generated a 500-row raw feed; it worked but took about 48s, so the default was reduced.
- `trc_765efff92a62`: generated a 250-row raw feed in about 4s: 250 rows, 24 failures.
- `trc_3e38cb986ef9`: focused script smoke wrote 5 rows to `/tmp/trace-burn-feed-verify/live-traces.json`; all 5 rows had raw payload fields.
- `trc_1171f68634de`: patched the ignored local archive HTML with the polling feed hook.
- `trc_7b9b033a39fc`: background feed process wrote `/live-traces.json`; file had 250 rows, 24 failures, 9.1 MB, maxRowid 5076.
- `trc_4eb3ea04e571`: browser page loaded and health pill showed pseudo-live state from the JSON feed.
- `trc_cca870d3a468`: browser eval confirmed feed marker installed, 250 rows, 24 failures, 250 raw rows, 100 rendered rows, `250 traces` footer, and inspector Input/Output/Metadata visible.
- `trc_ea4b3803e0ad`: TypeScript transpiler syntax check passed and `bun run consuelo-design check --json` passed.
- 2026-06-23 04:47:16 `review.run`: passed — OK
- 2026-06-23 04:52:52 `review.run`: passed — OK
- 2026-06-23 04:52:53 `review.run`: passed — OK
- 2026-06-23 04:52:53 `review.run`: passed — OK
- 2026-06-23 04:59:27 `verify`: failed — COMMAND_FAILED
- 2026-06-23 04:59:27 `verify`: failed — COMMAND_FAILED
- 2026-06-23 04:59:27 `verify`: failed — COMMAND_FAILED

## workspace-owned: test selection

- changed files: `.task/design/add-pseudo-live-trace-feed-from-current-main/current.json`, `.task/design/add-pseudo-live-trace-feed-from-current-main/session.json`, `.task/design/add-pseudo-live-trace-feed-from-current-main/workpad.md`, `.task/tasks/design/add-pseudo-live-trace-feed-from-current-main.json`, `package.json`, `packages/workspace/SCRIPTS.md`, `scripts/operator/trace-burn-page-feed.ts`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none
