# roll out observability gateway and internal workspace surfaces

branch: `task/os/roll-out-observability-gateway-and-internal-workspace-surfaces`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1794/roll-out-observability-gateway-and-internal-workspace-surfaces
github pr: https://github.com/consuelohq/opensaas/pull/1794
started: 2026-08-10
resumed task session: `tsk_4e5fd8c23e86`

## acceptance criteria

- [ ] `/observability/traces` is the already-developed trace-table experience, not a dashboard/cockpit: table-first route, no launcher/modal, no persistent details/sidebar rail, no retired pagination chrome, no “click to open” flow.
- [ ] Trace history/backlog loads from the authenticated same-origin gateway and new rows arrive live.
- [ ] `/observability`, `/environments`, `/configuration`, `/tools`, `/artifacts`, `/diffs`, `/docs`, and `/secrets` resolve through the intended internal workspace snapshot/routes.
- [ ] `/secrets` works for the authenticated workspace session and exposes metadata only: never secret values, ciphertext, fingerprints, local addresses, Tailnet addresses, or tunnel origins.
- [ ] Unauthenticated gateway requests fail closed; authenticated browser E2E succeeds.
- [ ] Current local Consuelo runtime is healthy on the intended dev bundle; gateway remains local-only.
- [ ] R2 snapshot/version is known; D1 points at the intended snapshot; heartbeat restores `node_F3Wsfd-vJrKkYlfi` as default with active node/connector/gateway routes after any publication.
- [ ] Production workspace-edge deployment ID/timestamp is recorded after state reconciliation.
- [ ] The previously exposed inherited MCP agent bearer credential is rotated via supported repair/re-provision flow without repeating its value; MCP agent connections are revalidated.
- [ ] Exact operational evidence is recorded here and PR #1794 is finished only after all rollout conditions are proven.

## plan

1. Reconstruct current state without mutation: verify task/PR reuse, local runtime/gateway, D1 route, R2 objects/version, workspace-edge deployment history, and whether the interrupted snapshot publisher completed.
2. Locate the canonical existing Astro/trace-table implementation and its commit history; compare it with `packages/os/scripts/lib/observability-traces-site.ts` rather than redesigning the page.
3. Before production UI edits, make `packages/os/tests/observability-traces-site.test.ts` fail on the desired table-only contract (no launcher/modal/inspector/cockpit chrome; same-origin history/live routes retained), then port the canonical table implementation and make the focused test pass.
4. Diagnose the `/secrets` auth/home-node failure through the existing edge -> node gateway contract; add a focused regression test before any production fix.
5. Refresh generated workspace content and compare the resulting content hashes/snapshots to the intended source.
6. If publication is incomplete, publish snapshots/routes, wait at least 35 seconds, and prove heartbeat restored default node, node target, connector route, and gateway routes.
7. Deploy workspace-edge only after reconciliation; record deployment ID/timestamp.
8. Run authenticated and unauthenticated browser E2E for all required routes plus leak checks and secret metadata contract checks.
9. Rotate the exposed MCP agent credential using the supported Consuelo repair/re-provision path; verify MCP connections.
10. Run focused tests, review/verify, update this workpad with exact evidence, push PR #1794, and finish the task.

## current status

- Existing task/PR was resumed without duplication. `task.current` initially returned no active local session; the old task id was not mounted. `task.start` reused the exact existing branch and PR #1794 with `createdBranch=false` and `createdPr=false`, and restored task session `tsk_4e5fd8c23e86`.
- PR #1794 is open on the expected branch, based on `stream/os`; current head observed at resume: `fdc11ef62b7c644f8348bba2a46acd1e73abbf98`.
- Local gateway port `127.0.0.1:46321` is listening (Bun process). Runtime version/bundle still needs exact current-value verification because the current `consuelo status --json` schema reports install-state/preferences rather than the older version fields.
- The user-visible trace mismatch is explained by current source: `packages/os/scripts/lib/observability-traces-site.ts` explicitly renders the Observability hero/KPIs, “Live tracing cockpit”, launcher/modal, filters rail, detail inspector, pagination, and “Trace scope” copy. This is not the already-developed table-only contract.
- Existing workspace trace-site work already contains a deployment contract that removes the retired cockpit, toolbar, and pagination markup; it is a likely canonical source/history to port rather than recreating behavior.
- Snapshot publication outcome, current D1/R2 linkage, workspace-edge deployment history, live authenticated trace data, secrets route, and credential rotation remain unverified in this resumed session.

## files changed

- `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/workpad.md`
- `packages/consuelo-website/src/pages/os/observability/traces.astro`
- `packages/os/scripts/lib/observability-traces-site.ts`

## workspace-owned: files changed

- `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/workpad.md`
- `packages/consuelo-website/src/pages/os/observability/traces.astro`
- `packages/os/scripts/lib/observability-traces-site.ts`

## workspace-owned: activity log

- 2026-08-10 04:09:31 fs.write: `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/workpad.md`
- 2026-08-10 04:20:25 fs.write: `packages/os/scripts/lib/observability-traces-site.ts`
- 2026-08-10 04:20:35 fs.write: `packages/consuelo-website/src/pages/os/observability/traces.astro`

## workspace-owned: validation evidence

- none yet

## key decisions

- Treat the current Observability traces shell as a regression against the established trace-table UX; recover/port existing implementation instead of designing a new cockpit.
- Do not publish or deploy until interrupted snapshot state is established.
- Preserve same-origin gateway endpoints and edge security boundaries while simplifying the UI.
- Never copy the exposed MCP credential into notes, logs, patches, or responses.

## notes for ko

- The screenshots match source-level evidence: the unwanted right rail and “Trace scope” text are hard-coded in the current OS traces shell, so this is not only an iPad rendering issue.

## improvements noticed

- The Observability page regression tests currently assert the launcher/modal/inspector cockpit contract; they need to protect the canonical table-only UX instead.

## issues and recovery

- The previous ephemeral worktree was gone, so `task.current` could not resolve the historical session. Recovery used `task.start` only after confirming PR #1794 and inspecting task-start behavior; it reused the existing remote branch/PR and restored the original task-session id without creating duplicates.
- First selective runtime-status parser expected older top-level version/channel fields and returned an empty safe projection. Follow-up inspected only the JSON shape, confirming the current command schema changed; no sensitive values were printed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/src/pages/os/observability/traces.astro`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_routes.sql`
- `packages/os/cloudflare/workspace-edge/migrations/0003_current_route_target_kinds.sql`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/deploy-cloudflare-worker.ts`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-stream.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/native-lifecycle-operation.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/scripts/verify-local-agents.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/workspace/scripts/trace-site-inspector/deploy.ts`
- `packages/workspace/scripts/trace-site-inspector/inspector.css`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/trace-site-inspector.test.ts`

## resumed operational evidence — 2026-08-10

- Interrupted snapshot publication is now proven **successful**. Remote D1 points `internal.consuelohq.com` at snapshot version `sha256-9e491b8df9c621fc`, and every R2 object referenced by that record exists with the exact expected SHA-256 content hash. No recovery republish of the old snapshot is needed.
- Remote D1 is active for `workspace_internal`; heartbeat has restored `defaultNodeId = node_F3Wsfd-vJrKkYlfi` and the local node target `connector_node_f3wsfd_vjrkkylfi` is connected. Gateway routes for traces, configuration/settings, environments, secrets, and artifacts are present and active.
- Current published content hashes match the handoff exactly: launcher `9e491b8d…b250`; traces `d3391b73…ec33`; configuration `e4c25623…4b37e`; tools `23949ae8…272`; environments `9fbf33ba…fc76c`; secrets `4a081b0a…f7aa`; artifacts `2f873e63…2863`; diffs `620a3aa8…d08e3`; docs `ca5ca147…9e1`.
- Workspace-edge has **not** been deployed for this August rollout. Latest deployment in the current 10-deployment history is `a32cdc48-ac50-4a47-b385-2948524c278f` from `2026-07-28T04:05:46.236272Z`. Deployment remains pending until corrected site content and route/runtime health are reconciled.
- Local gateway port `127.0.0.1:46321` is listening, but lifecycle status is currently **corrupt**, not healthy: channel `dev`, with reason `runtime bundle digest mismatch for scripts/lib/lifecycle/engine.ts`. Current status therefore cannot prove the prior 0.1.23 bundle identity. This must be repaired through the supported lifecycle path before rollout completion.
- D1 has a stale historical cloud-node inconsistency (record JSON says `connector_cloud_1` connected while its connector-table row is disconnected). Gateway-service routing has the restored local default node, so diagnose resolver behavior before deciding whether this is relevant; do not hand-edit routes.

- 2026-08-10 04:20:25 write: `packages/os/scripts/lib/observability-traces-site.ts`

- 2026-08-10 04:20:35 write: `packages/consuelo-website/src/pages/os/observability/traces.astro`

## correction pass — traces, runtime, credential hygiene

- Trace UX regression reproduced from source and the user screenshots. The published generator contained the retired hero/KPIs, “Live tracing cockpit”, modal launcher, persistent `Trace scope` rail, inspector, and click-to-open flow. This was not an iPad-only rendering issue.
- Recovered the established table model from the archived trace work instead of redesigning it: Search, 1-day window, direct rows, Time/Tool/Latency/Tokens/Branch/Input/Output/Trace/Status/Cost, and table footer. The new generated page removes cockpit, launcher, rail, inspector, and “Recent errors”.
- TDD evidence: `tests/observability-traces-site.test.ts` was changed first and failed on the old cockpit contract. After the generator/Astro port, `bunx vitest run tests/observability-traces-site.test.ts tests/sites-cli.test.ts` passed: 2 files, 13 tests.
- Trace backlog now uses the existing authenticated same-origin history contract on `/gateway/traces/recent` with `direction=older&cursor=latest&limit=100&includeRawPayload=true`, up to 3 pages/300 rows, rather than the dashboard-only recent-events shape. Live rows remain on `/gateway/traces/events`; SSE events trigger newest-history hydration and stable row de-duplication.
- Local runtime corruption was real: current 0.1.23 release failed integrity with `runtime bundle digest mismatch for scripts/lib/lifecycle/engine.ts`. A normal update check showed the current dev target is 0.1.24 / `sha256:d3ea9b9541455e13a3913917f25262e7ee94fb5ea846e4381c852b0331c8e9cf`.
- Used the supported detached native lifecycle updater rather than editing the runtime. Operation `native-1786335863426-d503a6ca-12d3-46f7-8f69-80648726402b` succeeded at `2026-08-10T04:24:42.274Z`. Current `consuelo status --json` is healthy: version 0.1.24, channel dev, bundle `sha256:d3ea9b9541455e13a3913917f25262e7ee94fb5ea846e4381c852b0331c8e9cf`; gateway port 46321 is listening.
- The exposed inherited credential was identified without reading its value. The loaded `com.consuelo.system` launchd job still carries the legacy environment key `WORKSPACE_MCP_TOKEN`. That key is absent from the current LaunchAgent plist, generated plist, and `~/.consuelo/.env`; current daemon wrappers explicitly unset it. The managed per-agent MCP credential file remains mode 0600 and contains five agent entries (`codex`, `claude`, `opencode`, `factory`, `gemini`) without exposing token IDs or bearer values.
- Because the exposed item is stale launchd process environment rather than a currently persisted Consuelo credential, the supported remediation is service re-provision/reload from the current scrubbed LaunchAgent definition, not manual token editing. After re-provision, verify the legacy env key is gone and re-run local MCP agent verification.

- 2026-08-10 04:35:12 apply-patch: `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- 2026-08-10 04:35:40 apply-patch: `packages/os/scripts/consuelo-reload.js`

- 2026-08-10 04:39:08 apply-patch: `packages/os/tests/install-edge-site-publisher.test.ts`

- 2026-08-10 04:39:30 apply-patch: `packages/os/scripts/lib/install-edge-site-publisher.ts`