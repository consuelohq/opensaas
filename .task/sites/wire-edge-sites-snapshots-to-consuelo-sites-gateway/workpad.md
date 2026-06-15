# wire edge Sites snapshots to Consuelo Sites Gateway

branch: `task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1048/wire-edge-sites-snapshots-to-consuelo-sites-gateway
github pr: https://github.com/consuelohq/opensaas/pull/1048
started: 2026-06-14

## acceptance criteria

- [x] Confirm local `main` includes merged OS edge work and Sites gateway work from #1020 and #1022.
- [x] Read local primary edge, registry, publisher, gateway, trace adapter, read, and live endpoint files.
- [x] Read relevant local workpads when present.
- [x] Inspect PR metadata/diffs/comments for #1020 and #1022 as context only.
- [x] Add failing integration coverage for `/traces` as site snapshot and `/gateway/traces/*` as Consuelo Sites Gateway route.
- [x] Ensure `/traces` is never seeded or routed as an OS connector by default.
- [x] Ensure edge route registry can represent Consuelo Gateway service routes without leaking backend implementation targets.
- [x] Ensure Trace gateway descriptors align with edge route records for public and gateway route families.
- [x] Ensure install edge snapshot publish verifies both `/` and `/traces`, with snapshot authority and version headers.
- [x] Preserve platform safety reserved-host behavior before cache/D1 lookup.
- [x] Ensure browser-facing responses do not expose local DB, local agent, cloud runner, trace file, raw internal service, implementation path, or backend target.
- [x] Run requested focused tests and typecheck.
- [x] Run review/verify and publish branch.

## summary

Wired the Cloudflare workspace edge route model, seed defaults, router behavior, and install snapshot publisher so hosted Sites and the Consuelo Sites Gateway compose as one product path.

The key product invariant is now explicit in tests and code:

| Workspace route | Edge owner | Product target |
| --- | --- | --- |
| `/` | Cloudflare workspace edge | `site-snapshot` hosted Sites shell |
| `/traces` | Cloudflare workspace edge | `site-snapshot` hosted Trace Site shell |
| `/gateway/traces` | Cloudflare workspace edge | `consuelo-gateway-service` descriptor for `trace-sites-read-layer` |
| `/gateway/traces/events` | Cloudflare workspace edge | `consuelo-gateway-service` descriptor for `trace-sites-live-endpoints` |
| `/mcp` | Cloudflare workspace edge | OS connector, when connector inputs are present |

## context read

Local source of truth read:

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/lib/consuelo-sites-gateway.ts`
- `packages/os/scripts/lib/consuelo-sites-gateway-registry.ts`
- `packages/os/scripts/lib/consuelo-sites-gateway-types.ts`
- `packages/os/scripts/lib/consuelo-sites-gateway-policy.ts`
- `packages/os/scripts/lib/consuelo-sites-trace-adapter.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`

Workpads read when present:

- `.task/os/wire-install-edge-site-snapshot-publish/workpad.md`
- `.task/os/add-workspace-platform-safety-block-page/workpad.md`

Requested Sites workpad paths were not present locally in this branch:

- `.task/sites/consuelo-sites-gateway-contract-service/workpad.md`
- `.task/sites/refactor-consuelo-sites-gateway-core-trace-adapter/workpad.md`

PR metadata/diffs/comments inspected for context only:

- #1020: merged into `main`, OS Cloudflare edge/snapshot/platform safety context.
- #1022: merged into `main`, Sites Gateway/Trace adapter context.

Local `main` inclusion confirmation: this task started from `main`; the local source files from both streams are present and match the merged ownership split that this task wires together.

## TDD red/green notes

Red command:

```bash
env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-sites-gateway-integration.test.ts
```

Initial red failures proved the integration gap:

- Seeded root route was still `app`/`service-upstream` instead of `sites`/`site-snapshot`.
- No `consuelo-gateway-service` route target existed; `/gateway/traces/*` fell through to proxy/error behavior.
- Edge seed records had no Trace gateway targets aligned with Trace adapter descriptors.
- Install publish route SQL contained only `/`, and edge verification checked only root.

Green command after wiring:

```bash
env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-sites-gateway-integration.test.ts
```

Result: 6 pass, 0 fail.

## implementation notes

- Added `consuelo-gateway-service` route target type to both D1 route registry and Cloudflare edge router models.
- Allowed route records to use `public` auth for public Site snapshots while preserving required auth for gateway/control routes.
- Added edge router handling for gateway-service targets that returns a safe Consuelo Gateway descriptor response instead of proxying to raw backend targets.
- Updated edge seed defaults to:
  - `/` -> `site-snapshot`
  - `/traces` -> `site-snapshot`
  - `/gateway/traces/events` -> `consuelo-gateway-service` / `trace-sites-live-endpoints`
  - `/gateway/traces` -> `consuelo-gateway-service` / `trace-sites-read-layer`
  - `/mcp` -> `os-connector` when connector inputs are provided
- Updated install edge snapshot plan to include `/traces` and Trace gateway route records in D1 `record_json`.
- Updated install edge publish verification to require both `https://<workspaceHost>/` and `https://<workspaceHost>/traces` to resolve to the published snapshot version through `x-consuelo-edge-cache-authority: sites-snapshot`.
- Made Consuelo Sites Gateway registration implementation-target checks case-insensitive.

## boundary guarantees

- `/traces` is a browser-facing Site shell route, not an OS connector route.
- `/gateway/traces/*` is represented as a symbolic Consuelo Gateway service route, not a raw upstream/backend target.
- Browser-facing gateway responses expose only `publicBoundary`, workspace identity, service name, and public/gateway route families.
- Tests assert browser-facing responses do not expose local trace DB, local agent, cloud runner, trace file, raw internal service, implementation path, backend target, direct backend target, tunnel origin, upstream URL, SQLite, or `.db` details.
- Platform safety reserved-host behavior still runs before cache and D1 lookup.
- Trace read/live remain registered adapters under the generic Consuelo Sites Gateway.

## files changed

- `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/workpad.md`
- `.task/tasks/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway.json`
- `packages/os/scripts/lib/consuelo-sites-gateway-registry.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: files changed

- `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/workpad.md`
- `.task/tasks/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway.json`
- `packages/os/scripts/lib/consuelo-sites-gateway-registry.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## workspace-owned: validation evidence

CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/install-edge-site-publisher.test.ts tests/install-workspace-bootstrap-contract.test.ts
bun test tests/consuelo-sites-gateway.test.ts
bun test tests/consuelo-sites-trace-adapter.test.ts
bun test tests/trace-sites-gateway-contract.test.ts
bun test tests/trace-sites-gateway-read-layer.test.ts
bun test tests/trace-sites-gateway-live-endpoints.test.ts
bun run typecheck
```
Results:
- `tests/workspace-edge-sites-gateway-integration.test.ts`: 6 pass, 0 fail.
- `tests/workspace-hostname-edge-router.test.ts`: 4 pass, 0 fail.
- `tests/install-edge-site-publisher.test.ts` + `tests/install-workspace-bootstrap-contract.test.ts`: 8 pass, 0 fail.
- `tests/consuelo-sites-gateway.test.ts`: 11 pass, 0 fail.
- `tests/consuelo-sites-trace-adapter.test.ts`: 3 pass, 0 fail.
- `tests/trace-sites-gateway-contract.test.ts`: 20 pass, 0 fail.
- `tests/trace-sites-gateway-read-layer.test.ts`: 10 pass, 0 fail.
- `tests/trace-sites-gateway-live-endpoints.test.ts`: 6 pass, 0 fail.
- `bun run typecheck`: passed, `workspace script syntax checks passed`.
- `verify`: passed, publish-valid stamp written to `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/verify.json`; review ran static rules, eslint, typecheck, and spec compliance with 0 blocking issues.
Additional focused checks:
```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts tests/cloudflare-edge-router.test.ts
```
Result: 22 pass, 0 fail.
Note: running the Trace live-endpoints test through the package `vitest run` script could not resolve Bun's `bun:sqlite` builtin. The requested native `bun test` command resolves it and passed.
- 2026-06-15 00:08:53 `review.run`: passed — OK
- 2026-06-15 00:08:53 `review.run`: passed — OK
- 2026-06-15 00:08:54 `review.run`: passed — OK
- 2026-06-15 00:11:43 `verify`: passed — OK
- 2026-06-15 00:12:11 `verify`: passed — OK

## out of scope

- Full Trace ingest/store/live product vertical slice.
- Local off-network installer/settings work.
- Cloud runner provisioning.
- UI polish.
- Animation/motion work.
- Commercial-tier/pricing language.
- Hardcoded Consuelo-only bypasses.
- Fixture/product-path rewrites outside the route ownership integration.

## publish checklist

```bash
bun run task:push -- --message "test(sites): wire edge snapshots to sites gateway" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-15 00:06:04 write: `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/workpad.md`

## workspace-owned: activity log

- 2026-06-15 00:06:04 fs.write: `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/workpad.md`

## workspace-owned: test selection

- changed files: `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/current.json`, `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/evidence-log.json`, `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/read-log.json`, `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/session.json`, `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/verify.json`, `.task/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway/workpad.md`, `.task/tasks/sites/wire-edge-sites-snapshots-to-consuelo-sites-gateway.json`, `packages/os/scripts/lib/consuelo-sites-gateway-registry.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
