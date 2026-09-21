# finish diffs cache freshness and ship

branch: `task/os/finish-diffs-cache-freshness-and-ship`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2524
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- Diffs list data and opened review/code content do not remain stale after upstream changes.
- The existing local/background cache design is preserved; refreshes happen locally rather than moving the steady-state cache to Cloudflare compute.
- First paint remains fast from cache, then stale data revalidates in the background without blocking the page.
- Inner diff pages progressively render useful shell/metadata before large file payloads finish.
- Mobile and desktop consume the same fresh cache contract; no separate stale mobile snapshot path.
- Focused cache/route/UI tests pass, and the behavior is smoke-tested before publish.
- Promote through stream/os, merge stream/os to main, run the canonical OS release/update path, and verify the local installed runtime is on the shipped version.

## Plan

1. Inspect the already-merged cache/progressive-loading task and current stream source rather than reimplementing it.
2. Reproduce the remaining stale path against the current task branch and identify whether the issue is code, cache invalidation, release state, or a mobile-specific endpoint.
3. Add or tighten one focused regression that fails for the remaining stale behavior.
4. Make the smallest fix that preserves the local stale-while-revalidate architecture and progressive UI.
5. Run focused green tests plus realistic local Diffs smoke validation on desktop/mobile-sized routes.
6. Review/verify against origin/stream/os, push/promote, merge stream/os to main, release/update, and verify runtime freshness.

## Test-first contract

behavior under test: Cached Diffs list/detail responses may be served immediately, but stale entries must schedule a deduplicated local background refresh and subsequent requests must observe the refreshed upstream state; mobile and desktop must share that contract.
existing local pattern: packages/os/scripts/server/services/diffs-local-cache.ts + diffs-gateway.ts own local stale-while-revalidate behavior; packages/os/scripts/server/routes/diffs.ts and packages/diff-cockpit/src/index.ts own list/detail progressive rendering.
new or changed tests: inspect existing diffs-local-cache / Hono route / diff-cockpit regression coverage first; add the narrowest missing stale-refresh or mobile-route regression.
focused red command: pending exact owning test selection after discovery.
expected red failure: current implementation returns or reuses stale cache state without guaranteeing an immediate deduplicated revalidation path for the affected request class, or a mobile/detail route bypasses the refreshed cache.
no-test waiver: not applicable.

- 2026-09-21 19:23:16 append: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 19:23:16 fs.write: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`
- 2026-09-21 19:28:38 fs.write: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`
- 2026-09-21 19:44:14 fs.write: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`
- 2026-09-21 19:45:07 fs.write: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/diff-cockpit/package.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/workspace-edge/README.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/server/routes/diffs.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/scripts/server/services/diffs-local-cache.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/diffs-hono-routes.test.ts`
- `packages/os/tests/diffs-local-cache.test.ts`
- `packages/os/tests/workspace-gateway-node-proxy.test.ts`
- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- `packages/workspace/scripts/os-release.ts`

## Investigation result

- Current source already contains the intended cache fix from merged PR #2491 and the focused cache/route/UI suites are green.
- Git ancestry proves the cache-fix commit is already present in origin/main, origin/canary, and origin/stream/os.
- Live authenticated mobile reproduction still renders the old 17d Stream/os rows even after 5 seconds.
- The live pulls API itself is current: a direct authenticated fetch returned PR #2524 and stream PR #2523 at the top.
- The live HTML/client is an older runtime: its inline readCachedIndex() returns localStorage indefinitely with no age check, while current source uses clientCacheTtlMs = 2 minutes and removes expired browser snapshots. Live API responses also lack the current x-consuelo-diffs-cache / ETag headers.
- Installed lifecycle status is 0.1.124 on canary. The previous update to 0.1.125 failed during rolling reload, which explains why merged source never reached the node/UI.
- Therefore no additional cache production edit is justified in this follow-up task. The remaining work is release convergence: ship current stream/os, install the exact released runtime, and browser-verify freshness/progressive rendering.

## Validation evidence

- Correct focused run: (cd packages/os && bun run test -- tests/diffs-local-cache.test.ts tests/diffs-hono-routes.test.ts tests/diffs-coderabbit-review-contract.test.ts) => 3 files / 16 tests passed.
- Diff Cockpit package: (cd packages/diff-cockpit && bun run test) => 42 passed / 0 failed.
- Live API proof: /gateway/diffs/repositories/consuelohq/opensaas/pulls returned current PRs #2524, #2523, #2517, #2516.
- Live DOM proof: still displayed Stream/os #2400/#2387 as 17d old after retry/settle.
- Live client-source proof: readCachedIndex() has no TTL check, while current repository source does.
- Lifecycle proof: installed 0.1.124; attempted target 0.1.125 failed because the worker pool did not complete rolling reload.

## Test-first contract resolution

No production edit is required in this follow-up task, so no new RED test is appropriate. The original cache task already recorded RED -> GREEN evidence. This task is a release/runtime convergence diagnosis and uses the existing focused suites plus live browser/API evidence as validation.

- 2026-09-21 19:28:38 append: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`

## Follow-up: conditional revalidation through Workspace Edge

Live verification on 0.1.126 found one remaining cache-efficiency defect after the stale-data fix shipped: the Diffs API now emits ETags, but a second browser request carrying If-None-Match still receives 200 instead of 304.

Root cause is now traced to the actual /gateway/diffs route family. Diffs is a consuelo-gateway-service route, and buildGatewayNodeProxyRequest() deliberately reconstructs a narrow safe header set (accept, content-type, last-event-id). That drops If-None-Match before the request reaches the local Hono Diffs route, so its existing 304 logic cannot run.

### Revised test-first contract

behavior under test: authenticated consuelo-gateway-service GETs must preserve the safe conditional request validator If-None-Match so local read endpoints such as /gateway/diffs can return 304 instead of resending an unchanged JSON payload.
existing local pattern: buildGatewayNodeProxyRequest() allowlists browser-to-node headers before signing and proxying; response status/headers pass through unchanged.
new regression: workspace-gateway-node-proxy.test.ts will route a Diffs GET with If-None-Match through the real D1/router path and make the mock node return 304 only when the validator survives.
focused RED command: bun --cwd packages/os run test tests/workspace-gateway-node-proxy.test.ts
expected RED failure: forwarded If-None-Match is null and the response remains 200 rather than 304.
smallest production fix: add if-none-match to the existing safe request-header allowlist; do not forward cookies/auth headers or broaden the proxy contract.

- 2026-09-21 19:44:14 append: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`

- 2026-09-21 19:44:21 apply-patch: `packages/os/tests/workspace-gateway-node-proxy.test.ts`
- 2026-09-21 19:44:40 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
### Conditional revalidation RED -> GREEN

- RED: workspace-gateway-node-proxy.test.ts failed exactly as expected: forwarded if-none-match was null.
- Production change: added only if-none-match to buildGatewayNodeProxyRequest()'s existing safe request-header allowlist.
- GREEN: workspace-gateway-node-proxy.test.ts 8/8 passed.
- Focused cache regression set: workspace gateway + local cache + Diffs Hono + CodeRabbit contract = 24/24 passed.
- Diff Cockpit package suite = 42/42 passed.
- Security boundary remains narrow: browser cookies and arbitrary headers are still not forwarded to gateway-node services.

- 2026-09-21 19:45:07 append: `.task/os/finish-diffs-cache-freshness-and-ship/workpad.md`

## workspace-owned: validation evidence

- Correct focused run: (cd packages/os && bun run test -- tests/diffs-local-cache.test.ts tests/diffs-hono-routes.test.ts tests/diffs-coderabbit-review-contract.test.ts) => 3 files / 16 tests passed.
- Diff Cockpit package: (cd packages/diff-cockpit && bun run test) => 42 passed / 0 failed.
- Live API proof: /gateway/diffs/repositories/consuelohq/opensaas/pulls returned current PRs #2524, #2523, #2517, #2516.
- Live DOM proof: still displayed Stream/os #2400/#2387 as 17d old after retry/settle.
- Live client-source proof: readCachedIndex() has no TTL check, while current repository source does.
- Lifecycle proof: installed 0.1.124; attempted target 0.1.125 failed because the worker pool did not complete rolling reload.
- 2026-09-21 19:47:26 `verify`: failed — COMMAND_FAILED
