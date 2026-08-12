# roll out observability gateway and internal workspace surfaces

branch: `task/os/roll-out-observability-gateway-and-internal-workspace-surfaces`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1794/roll-out-observability-gateway-and-internal-workspace-surfaces
github pr: https://github.com/consuelohq/opensaas/pull/1794
started: 2026-08-11
resumed task session: `tsk_4e5fd8c23e86`

## acceptance criteria

- [ ] `/observability/traces` uses the exact established Trace Burn Intelligence v38 table experience as its canonical UI source, with only the transport/security adaptation required for the internal workspace. Do not redesign or approximate it.
- [ ] Initial route is table-first: no Observability hero/KPIs, no “Live tracing cockpit”, no launcher/modal interaction, no visible detail/sidebar rail until a row is selected, no retired top search toolbar, and no retired rows-per-page pagination chrome.
- [ ] Canonical table behavior and presentation are preserved, including its column layout, filters affordance, trace count, row selection/detail behavior, responsive behavior, and near-live updates.
- [ ] Trace history/backlog loads through authenticated same-origin gateway routes and live rows continue arriving without exposing a local/Tailnet/tunnel address to the browser.
- [ ] `/observability`, `/environments`, `/configuration`, `/tools`, `/artifacts`, `/diffs`, `/docs`, and `/secrets` resolve through the intended internal workspace snapshot/routes.
- [ ] `/secrets` works for the authenticated workspace session and exposes metadata only: never secret values, ciphertext, fingerprints, local addresses, Tailnet addresses, or tunnel origins.
- [ ] Unauthenticated gateway requests fail closed; authenticated browser E2E succeeds.
- [ ] Current local Consuelo runtime is healthy on the intended dev bundle and the gateway remains local-only.
- [ ] Current R2 snapshot/version is known; D1 points at the intended snapshot; heartbeat restores `node_F3Wsfd-vJrKkYlfi` as default with active node/connector/gateway routes after any publication.
- [ ] Production workspace-edge deployment ID/timestamp is recorded after state reconciliation.
- [ ] The previously exposed inherited MCP bearer credential remains retired via the supported repair/re-provision path without repeating its value; configured MCP agents are revalidated.
- [ ] Exact operational evidence is recorded here and PR #1794 is finished only after every rollout condition is proven.

## plan

1. Recover the exact Trace Burn Intelligence v38 source and generated shell that previously ran at `/office/trace-burn-intelligence`; treat that as canonical instead of the current OS reimplementation.
2. Audit the canonical archive/assets for embedded trace payloads, local/Tailnet/tunnel addresses, or sensitive data before reusing bytes.
3. Add a focused OS regression test that fails unless `/observability/traces` matches the canonical table-first contract and excludes the reimplemented cockpit/search/pagination UI.
4. Port/copy the canonical TraceSite implementation into OS ownership with the smallest transport adaptation needed for same-origin `/gateway/traces/*` history/live data. Preserve canonical visual/interaction code rather than recreating it.
5. Reconcile any lost prior rollout fixes (aggregate immutable snapshot versioning and lifecycle credential scrub) against the current task branch and re-add only if absent, with focused tests.
6. Determine whether the interrupted corrected snapshot publication completed by inspecting current R2 + D1 before any publish retry.
7. Publish corrected snapshots/routes only if needed; wait at least 35 seconds; prove heartbeat restored default node, active node target, connector route, and gateway routes.
8. Deploy workspace-edge through the typed deployment facade; record deployment ID/timestamp.
9. Run authenticated and unauthenticated browser E2E for required routes, live trace backlog/update behavior, secrets metadata contract, and browser leak checks.
10. Revalidate local MCP agents, run review/verify, update this workpad, push PR #1794, and finish the rollout task.

## Test-first contract

- Behavior under test: the generated OS traces route is structurally and behaviorally the canonical v38 Trace Burn table, not the newer cockpit approximation; it uses same-origin gateway transport and contains no browser-visible private network origin or secret material.
- Behavior under test: every Trace Burn snapshot route requires a workspace session so the browser cannot render a public shell whose authenticated `/gateway/traces/*` reads all fail with 401.
- Behavior under test: publishing a new immutable Site snapshot must preserve the existing workspace control-plane routing state (`defaultNodeId`, `nodeTargets`, and existing `os-connector` routes) instead of replacing the D1 hostname row with a Site-only record and taking the active connector offline.
- Existing local pattern: `packages/workspace/tests/trace-site-inspector.test.ts` protects the v38 deployment contract and explicitly removes the retired cockpit, `.trxToolbar`, “Search traces...”, “Rows per page”, and page-number pagination while preserving filters + trace count.
- Existing local pattern: `upsertWorkspaceNodeTargetInD1` merges node targets/routes into an existing D1 record; publication must preserve that state across a Site release rather than recreating the hostname row from defaults.
- Canonical source: tracked `packages/workspace/scripts/trace-site-inspector/*` plus Ko’s generated local archive `packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/index.html` (v38 assets). The generated archive must be sanitized before any bytes are reused.
- New/changed tests: keep `packages/os/tests/observability-traces-site.test.ts` for exact v38 parity; add route-seed coverage proving all `traces` snapshot aliases are `workspace-session`; add publisher coverage proving a publication merges a pre-existing node/default/connector record and that unauthenticated trace verification is treated as expected private access rather than a public 200 contract.
- Focused red commands: `bunx vitest run tests/workspace-edge-route-seed-contract.test.ts` and `bunx vitest run tests/install-edge-site-publisher.test.ts` from `packages/os` with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`.
- Expected red failures: Trace Burn aliases are currently generated with `auth: 'public'`; the publisher currently writes a fresh Site-only `INSERT OR REPLACE` D1 record without first preserving live node/connector state, and its verifier expects child trace snapshots to be anonymously readable.

## current status

- OS connector is back after Ko’s `consuelo restart`; `os.get_steering` and subsequent single typed OS calls succeed.
- Existing PR #1794 is still open at head `fdc11ef62b7c644f8348bba2a46acd1e73abbf98`, base `stream/os`. No duplicate task/PR was created.
- `task.current` had no mounted session after restart, so `task.start` reattached the exact existing branch/PR with `createdBranch=false`, `createdPr=false`, `createdWorktree=true`, restoring `tsk_4e5fd8c23e86`.
- The old Tailscale preview URL currently returns connection refused after restart; this does not remove the canonical source because its tracked implementation and generated local archive remain on disk.
- Canonical generated archive exists in Ko’s main working copy, size 69,217 bytes, SHA-256 `4984c99d5db2c892feaa4d6a309070a88774badb5118bd85182bc7e646b6951f`. It contains the final v38 table shell: `.trxShell.closed`, exact columns `Time / Tool / Latency / Tokens / Branch / Input / Output / Trace / Status / Cost`, `data-trace-rows`, filters + trace count footer, and v38 inspector assets. It has no `.trxToolbar`, no “Search traces...”, and no “Rows per page”.
- Tracked v38 implementation has the long incremental history Ko referenced, including `b07a0ab5df` rebuild inspector, `963802f830` improve trace table inspector, `798b612250` keep trace surface visible, `a690e293a9` near-live traces, and `dd93b3f6ee` stabilize near-live trace history.
- Current OS generator is definitively a separate reimplementation: hero/KPIs, “Live tracing cockpit”, launcher/modal, search toolbar, split rail, and pagination are hard-coded in `packages/os/scripts/lib/observability-traces-site.ts`.
- Live runtime diagnosis now proves the empty Trace Burn page is an auth-routing bug, not missing trace data: `/Users/kokayi/.consuelo/node/db/traces.db` exists, is ~207 MB, and contains 20,165 `tool_traces` rows through the current session, while the browser receives 401 for both the initial `direction=older` history request and every `direction=newer` poll.
- The trace snapshot itself is currently public, so an unauthenticated browser can load the correct v38 shell and then silently render zero rows because the v38 runtime intentionally catches history/poll transport failures. `/gateway/traces/*` is correctly workspace-session protected.
- The repeated connector loss during snapshot publication is also explained: `install-edge-site-publisher.ts` executes Site-only route SQL that uses `INSERT OR REPLACE` for `workspace_route_registry`. That replacement omits the existing `defaultNodeId`, `nodeTargets`, and `/gtm`/`/mcp` connector routes, so subsequent gateway resolution loses the active node until restart/heartbeat repairs control-plane state.
- A second, independent cause of the apparent “OS crashes” was the local Caddy ingress transport: generated config imposed `response_header_timeout 15s` (plus 60s read/write limits) while valid OS tools can run for minutes. Caddy therefore returned 504 at ~15.0s while the Bun daemon kept running and completed the work behind the failed client call.
- `security-gateway.ts` now leaves only the 5s connect/dial timeout and delegates request execution deadlines to the application/tool layer. The live installed Caddyfile was minimally patched, validated, and only the Caddy LaunchAgent was restarted. A 17-second MCP `wait` call then completed successfully through the same ingress path, proving the old 15s cutoff is gone.
- The live exact-v38 publish completed despite the caller-side timeout: remote D1 now points Trace aliases at `sha256-15102de522ff36e1`, requires `workspace-session`, retains the active default node + node target, and retains active `/gtm` + `/mcp` connector routes. Publish log verifies 9 uploads, one route update, 6 expected private-site 401s (launcher + five Trace aliases), 7 public snapshot 200s, and no failure.
- The real canonical trace DB is healthy and non-empty. The production local backend reads the current `/Users/kokayi/.consuelo/node/db/traces.db` directly: a `cursor=latest` history read returned 20 rich rows and a valid older cursor. Existing fresh-home persistence coverage also proves the first successful tool call creates/persists the canonical trace DB and is immediately readable through the Trace Sites backend; a missing DB remains a valid empty pre-first-trace state.

## files changed

- `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/workpad.md`
- `packages/os/assets/observability-traces-v38/base.css` (deleted)
- `packages/os/assets/observability-traces-v38/gsap.js` (deleted)
- `packages/os/assets/observability-traces-v38/inspector.css` (deleted)
- `packages/os/assets/observability-traces-v38/inspector.js` (deleted)
- `packages/os/assets/observability-traces-v38/mobile.css` (deleted)
- `packages/os/assets/observability-traces-v38/scroll.js` (deleted)
- `packages/os/assets/observability-traces-v38/table-overview.js` (deleted)
- `packages/os/assets/observability-traces-v38/template.html` (deleted)
- `packages/os/assets/vendor/observability-traces-v38/base.css`
- `packages/os/assets/vendor/observability-traces-v38/gsap.js`
- `packages/os/assets/vendor/observability-traces-v38/inspector.css`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/assets/vendor/observability-traces-v38/mobile.css`
- `packages/os/assets/vendor/observability-traces-v38/scroll.js`
- `packages/os/assets/vendor/observability-traces-v38/table-overview.js`
- `packages/os/assets/vendor/observability-traces-v38/template.html`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: files changed

- `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/workpad.md`
- `packages/os/assets/observability-traces-v38/base.css` (deleted)
- `packages/os/assets/observability-traces-v38/gsap.js` (deleted)
- `packages/os/assets/observability-traces-v38/inspector.css` (deleted)
- `packages/os/assets/observability-traces-v38/inspector.js` (deleted)
- `packages/os/assets/observability-traces-v38/mobile.css` (deleted)
- `packages/os/assets/observability-traces-v38/scroll.js` (deleted)
- `packages/os/assets/observability-traces-v38/table-overview.js` (deleted)
- `packages/os/assets/observability-traces-v38/template.html` (deleted)
- `packages/os/assets/vendor/observability-traces-v38/base.css`
- `packages/os/assets/vendor/observability-traces-v38/gsap.js`
- `packages/os/assets/vendor/observability-traces-v38/inspector.css`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/assets/vendor/observability-traces-v38/mobile.css`
- `packages/os/assets/vendor/observability-traces-v38/scroll.js`
- `packages/os/assets/vendor/observability-traces-v38/table-overview.js`
- `packages/os/assets/vendor/observability-traces-v38/template.html`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: activity log

- 2026-08-11 22:12:02 fs.write: `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/workpad.md`
- 2026-08-11 22:14:03 fs.write: `packages/os/tests/observability-traces-site.test.ts`
- 2026-08-11 22:15:47 fs.write: `packages/os/scripts/lib/observability-traces-site.ts`
- 2026-08-11 23:43:11 fs.write: `packages/os/assets/vendor/observability-traces-v38/base.css`
- 2026-08-11 23:43:12 fs.write: `packages/os/assets/vendor/observability-traces-v38/gsap.js`
- 2026-08-11 23:43:12 fs.write: `packages/os/assets/vendor/observability-traces-v38/inspector.css`
- 2026-08-11 23:43:12 fs.write: `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- 2026-08-11 23:43:13 fs.write: `packages/os/assets/vendor/observability-traces-v38/mobile.css`
- 2026-08-11 23:43:13 fs.write: `packages/os/assets/vendor/observability-traces-v38/scroll.js`
- 2026-08-11 23:43:14 fs.write: `packages/os/assets/vendor/observability-traces-v38/table-overview.js`
- 2026-08-11 23:43:14 fs.write: `packages/os/assets/vendor/observability-traces-v38/template.html`
- 2026-08-11 23:43:40 fs.trash: `packages/os/assets/observability-traces-v38/base.css`
- 2026-08-11 23:43:40 fs.trash: `packages/os/assets/observability-traces-v38/gsap.js`
- 2026-08-11 23:43:41 fs.trash: `packages/os/assets/observability-traces-v38/inspector.css`
- 2026-08-11 23:43:41 fs.trash: `packages/os/assets/observability-traces-v38/inspector.js`
- 2026-08-11 23:43:41 fs.trash: `packages/os/assets/observability-traces-v38/mobile.css`
- 2026-08-11 23:43:41 fs.trash: `packages/os/assets/observability-traces-v38/scroll.js`
- 2026-08-11 23:43:42 fs.trash: `packages/os/assets/observability-traces-v38/table-overview.js`
- 2026-08-11 23:43:42 fs.trash: `packages/os/assets/observability-traces-v38/template.html`
- 2026-08-12 00:13:02 fs.trash: `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/staged-home`
- maintained by tooling

## workspace-owned: validation evidence

- 2026-08-11 23:42:01 `review.run`: passed — OK
- 2026-08-11 23:44:07 `review.run`: passed — OK
- 2026-08-12 00:13:59 `review.run`: passed — OK

## key decisions

- The Trace Burn Intelligence v38 implementation is the source of truth. Port/copy it; do not visually re-create it.
- Keep production OS independent of deprecated `packages/workspace` at runtime. Reuse means migrating the exact implementation/assets into OS ownership or packaging them self-contained, not introducing a runtime dependency on the deprecated package.
- Never copy real trace seed payloads from the generated archive into source or an edge snapshot. Only reusable shell/assets may move after a private-data/leak audit.
- Do not retry snapshot publication until current R2/D1 state is known.
- Never repeat the previously exposed credential value.

## notes for ko

- You were right about the source: the exact table is still present locally and the tracked v38 deployment contract literally strips the cockpit/search/pagination pieces that showed up in the OS reimplementation.
- The only adaptations that should survive the port are production transport/auth/security boundaries; the table UI itself should remain the existing one.

## improvements noticed

- The traces UI should have one canonical source instead of a second hand-maintained OS copy; this task should leave parity protected by tests so the two cannot drift again.

## issues and recovery

- 2026-08-11 follow-up from Ko screenshots: exact v38 Trace Burn shell is visible but remains at `0 traces`, while Tools/Environments/Secrets render their public static shells and then show the generic `Configuration unavailable` state. The installed local runtime is already healthy/current on dev `0.1.26` (`updateAvailable: false`), and the canonical local trace DB is non-empty, so this is not a user-update problem.
- Current local request logs contain no `/gateway/traces`, `/gateway/configuration`, `/gateway/environments`, or `/gateway/secrets` request from the failing browser session. That means the failure is occurring at the workspace edge/session boundary before the request reaches the home node.
- Test-first follow-up contract: (1) private workspace state shells (`traces`, `configuration`, `tools`, `environments`, `secrets`, plus launcher) must require `workspace-session` so an unauthenticated/stale session cannot render a misleading shell whose API is guaranteed to fail; (2) the v38 red window control must navigate back to the launcher `/` without modifying the byte-locked vendor assets; (3) authenticated gateway history must continue to read the canonical trace DB and unauthenticated access must fail closed.
- Root cause for the authenticated-but-unavailable private APIs was a stale production `consuelo-workspace-edge` Worker. Its last production deployment was `a32cdc48-ac50-4a47-b385-2948524c278f` at `2026-07-28T04:05:46.236272Z`, while the node-scoped gateway proxy signing implementation (`nodeSigningMasterSecret`, `nodeConnector`, `buildGatewayNodeProxyRequest`) landed in workspace-edge/router source after that deployment. The home node and device authority were current, so the stale edge Worker could serve/session-gate Site HTML but could not proxy current signed gateway requests to the home node correctly.
- Direct signed tunnel probes using the installed node-scoped edge credential (never printed) proved the home-node path itself is healthy: `/gateway/configuration/snapshot` 200, `/gateway/environments/snapshot` 200, `/gateway/secrets/bindings` 200, and `/gateway/traces/recent?...includeRawPayload=true` 200 with 5 rows + a next cursor. Only status/count/key names were emitted; no secret or trace payload values were printed.
- Production workspace-edge was deployed through the repository release-readiness wrapper (`bun run cloudflare:workspace-edge:deploy`) after confirming no typed Cloudflare deployment tool exists. Deployment `1cfa50c2-3fbe-47a7-9de3-6d227272dd67`, version `99f2ca97-9274-4482-ae29-43fd06919dbf`, is 100% active from `2026-08-12T00:09:47.243216Z`.
- Private Site route auth is now consistent with private gateway auth: `/`, all five Trace aliases, `/configuration`, `/tools`, `/environments`, and `/secrets` require `workspace-session`. `/artifacts`, `/diffs`, and `/docs` remain public. Unauthenticated HTML requests to all private shells now 302 to `os.consuelohq.com`; the four checked private gateway APIs return 401 `workspace_session_required`; public Artifacts/Diffs/Docs remain HTTP 200.
- Final Site snapshot publish is `sha256-0cadcd0798397856`. Trace content hash is `b1e42eeb7559043ab6d11eafe82f946eb1935ecec1e5a0c3146c2aab62de94a7`; all other surface content hashes are unchanged from the prior verified snapshot. A read-back of all 9 unique R2 objects matched every expected SHA-256. D1 points every Site route at the new version, the default node remains present/fresh, and active `/gtm` + `/mcp` connector routes are preserved.
- The first red-button implementation accidentally selected the v38 backdrop because both the backdrop and the red window button carry `data-close-traces`. A real headless Chrome click test exposed the strict two-element match. The implementation now targets `button[data-close-traces]`; the unit test is green and a real Chrome click navigated `/observability` -> `/` and displayed the launcher. Vendor v38 files remain byte-identical.
- Real-browser Trace rendering was independently exercised against the canonical production `traces.db` through the actual local read backend: the generated v38 page made 5 history requests, rendered 25 row elements, and reported a non-zero count (`60`) in headless Chrome. This isolates any former `0 traces` state to the edge/proxy/session path rather than the UI renderer or database.
- Final focused verification after the follow-up fixes: 36/36 gateway publisher/route/Trace tests pass, `bun run typecheck` passes, and strict workspace review reports 0 blockers. The full `verify` wrapper was intentionally not rerun because it unconditionally invokes automatic test selection, whose `@consuelo/os` package suite would include `security-gateway.test.ts`; that file contains destructive-literal temp cleanup (`rmSync`) and steering requires exact target preflight before execution. Publication therefore uses the user's standing rollout approval plus the focused green evidence instead of bypassing the safety rule.
- Two large `batch` discovery calls returned transient MCP network errors after restart. Single typed OS calls are healthy, so recovery is to continue with focused single calls rather than treating the connector as down.
- The old Tailscale preview process on port 53935 is not listening after restart (`ERR_CONNECTION_REFUSED`). Canonical tracked source and generated local archive are still available for direct inspection.
- Runtime browser reproduction: `https://internal.consuelohq.com/trace-burn-intelligence` returned the correct v38 document with HTTP 200 while its same-origin trace history calls returned 401. This is the concrete failure to drive the next test-first fix.
- Publication recovery rule: do not run another live Site publish until the publisher has a regression test proving it preserves existing node/connector state; the old blind D1 replace is the mechanism that severed the OS session.
- Relevant verification is green when run with the runtime each test actually requires: 79 gateway/publisher/security/Trace Site tests pass under Bun-backed Vitest, and all 8 trace-persistence tests pass under the normal Vitest harness (their fixture launches Bun itself). `bunx --bun vitest` is intentionally not used for `trace-persistence.test.ts` because Vite/Bun currently mis-interops with the repo’s Zod import before test collection; this is a runner issue, not a product failure.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/src/pages/os/observability/traces.astro`
- `packages/os/SCRIPTS.md`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/security/web-auth-contract.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/package.json`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/deploy-cloudflare-worker.ts`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/artifacts-legacy-contract.test.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/trace-site-inspector/pagination-browser.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`

- 2026-08-12 00:15:33 apply-patch: `.task/os/roll-out-observability-gateway-and-internal-workspace-surfaces/workpad.md`