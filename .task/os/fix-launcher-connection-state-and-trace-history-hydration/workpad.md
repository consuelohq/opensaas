# fix launcher connection state and trace history hydration

branch: `task/os/fix-launcher-connection-state-and-trace-history-hydration`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2374
started: 2026-09-03

## acceptance criteria

- [x] Authenticated configuration failures are reported separately from sign-out, recover automatically, and retain useful history.
- [x] Persisted trace history hydrates before live polling and retries after an initial snapshot failure.
- [x] Home can read redacted historical trace data and keeps the seven-day aggregate visible while live updates are unavailable.
- [x] Existing workspace route rows update without conflicting with the D1 route registry's composite uniqueness constraint.

## plan

1. Reproduce the public route, history authorization, Home state, and Tracing hydration failures.
2. Add focused regression tests around each boundary.
3. Patch the D1 update path, redacted history contract, Home state/cache behavior, and inspector hydration loop.
4. Rebuild the shipped inspector and verify both worker bundles plus the OS runtime archive.
5. Push, merge to the OS stream, release canary, update this Mac, and run authenticated live acceptance.

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- focused contract tests under `packages/os/tests/`

## key decisions

- Known-existing D1 route rows use `UPDATE`; inserts remain reserved for absent rows.
- `includeRawPayload=false` returns an allowlisted redacted history row instead of a 403.
- Home retains a cached aggregate as explicitly historical data while connectivity is degraded.
- Tracing does not advance to live-only polling until the persisted snapshot has hydrated successfully.

## notes for ko

- Focused regressions: 38/38 passed.
- Broader OS boundary suite: 146/146 Vitest checks and 19/19 Bun checks passed.
- Syntax check, workspace-edge dry run, device-authority dry run, and a 558-file runtime archive build/verification passed.

## improvements noticed

- `runtime-bundle:verify` requires an explicit archive; built a temporary test archive first and verified that artifact.
- Some OS tests import `bun:test`; they must run with `bun test`, not Vitest.

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

- Behavior under test:
  - A signed workspace-node heartbeat with a proven MCP route must keep the current node's D1 presence projection fresh when full route reconciliation is temporarily degraded, while preserving retryability.
  - A persisted trace-history request with `includeRawPayload=false` must be authorized and return redacted rows for the Home heatmap.
  - Home must distinguish an authenticated workspace whose node/upstream is temporarily unavailable from a signed-out workspace, retain the last historical aggregate across reload, and expose live-update degradation without replacing history with a trustworthy-looking zero.
- Existing local patterns:
  - `packages/os/tests/workspace-node-registry-routing.test.ts`
  - `packages/os/tests/trace-sites-history-endpoint-contract.test.ts`
  - `packages/os/tests/settings-site.test.ts`
  - `packages/os/tests/observability-traces-site.test.ts`
- New or changed tests: focused regressions in the files above, narrowed to the owned route, history, and UI contracts.
- Focused red command: run the affected OS Bun tests from the repository root.
- Expected red:
  - reconciliation failure currently prevents the D1 node-presence projection from refreshing;
  - redacted history is currently validated as though raw payload were requested;
  - Home currently collapses all configuration failures into sign-in/offline copy and silently renders a zero heatmap after a failed history fetch.
- No-test waiver: not applicable.

## workspace-owned: files changed

- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/cloudflare/os-device-authority/.wrangler` (deleted)
- `packages/os/cloudflare/workspace-edge/.wrangler/cache/wrangler-account.json` (deleted)

## workspace-owned: activity log

- 2026-09-04 14:50:12 fs.write: `.task/os/fix-launcher-connection-state-and-trace-history-hydration/workpad.md`
- 2026-09-04 14:50:16 fs.trash: `packages/os/cloudflare/workspace-edge/.wrangler/cache/wrangler-account.json`
- 2026-09-04 15:11:24 fs.trash: `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/cloudflare/os-device-authority/.wrangler`

## workspace-owned: files read

- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/.task/os/fix-launcher-connection-state-and-trace-history-hydration/workpad.md`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/package.json`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/scripts/build-runtime-bundle.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/scripts/lib/settings-site.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/tests/observability-traces-site.test.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/tests/settings-site.test.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-os-fix-launcher-connection-state-and-trace-history-hydration/packages/os/tests/trace-sites-history-endpoint-contract.test.ts`

## workspace-owned: validation evidence

- 2026-09-04 15:15:07 `review.run`: passed — OK
- 2026-09-04 15:16:07 `review.run`: passed — OK
- 2026-09-04 15:16:58 `verify`: passed — OK
- 2026-09-04 15:17:26 `verify`: passed — OK
- 2026-09-04 15:29:09 `review.run`: passed — OK
