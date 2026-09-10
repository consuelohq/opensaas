# Fix internal launcher secrets and nodes production regressions

branch: `task/os/fix-internal-launcher-secrets-and-nodes-production-regressions`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2190/fix-internal-launcher-secrets-and-nodes-production-regressions
github pr: https://github.com/consuelohq/opensaas/pull/2190
started: 2026-08-26

## acceptance criteria

- [x] Owner-only `Users & installs` is visible before Configure routes.
- [x] Route descriptions are three or four words and the menu fits without scrolling.
- [x] Secrets supports browser-sealed create and replace without exposing values.
- [x] Nodes sort default, then online, then last-used and record detected platform/architecture.
- [x] Focused, security, OAuth, syntax, and registry gates pass, apart from a documented unrelated stale Caddy-port assertion.

## plan

1. Pin focused red regressions for all requested behaviors.
2. Restore the proven sealed-secret UI and gateway contracts without stale task ancestry.
3. Compact/reorder the menu and implement node sorting/platform heartbeat metadata.
4. Run focused, security, OAuth, syntax, and test-selection gates.
5. Push, review, promote to stable, and verify the live internal site and installer channel.

## current status

- Implementation and local validation are complete. Preparing the green slice for review, merge, stable release, and live verification.

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/scripts/lib/consuelo-sites-secrets-adapter.ts`
- `packages/os/scripts/lib/node-sealed-credential-store.ts`
- `packages/os/scripts/lib/secrets-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/scripts/server/routes/secrets.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/secrets-hono-routes.test.ts`
- `packages/os/tests/secrets-surface.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-gateway-node-end-to-end.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/os/tests/internal-launcher-regressions.test.ts`


## workspace-owned: files changed

- `packages/os/tests/internal-launcher-regressions.test.ts`

## workspace-owned: activity log

- 2026-08-26 03:52:54 fs.write: `.task/os/fix-internal-launcher-secrets-and-nodes-production-regressions/workpad.md`
- 2026-08-26 04:00:20 fs.write: `.task/os/fix-internal-launcher-secrets-and-nodes-production-regressions/workpad.md`
- 2026-08-26 04:02:03 fs.write: `packages/os/tests/internal-launcher-regressions.test.ts`
- 2026-08-26 04:02:25 fs.write: `.task/os/fix-internal-launcher-secrets-and-nodes-production-regressions/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 04:17:06 `verify`: failed — COMMAND_FAILED
- 2026-08-26 04:17:43 `verify`: failed — COMMAND_FAILED
- 2026-08-26 04:33:29 `verify`: failed — COMMAND_FAILED

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: launcher menu fits without horizontal or vertical scrolling, exposes the owner-only Users and installs entry, Secrets restores interactive credential management, and Nodes orders default then online then last-used while showing detected platforms
existing local pattern: pending focused discovery of launcher, secrets, node renderers, snapshots, and overlapping PRs
new or changed tests: pending focused discovery
focused red command: pending focused discovery
expected red failure: pending focused discovery
no-test waiver: not applicable

- 2026-08-26 03:52:54 append: `.task/os/fix-internal-launcher-secrets-and-nodes-production-regressions/workpad.md`

## Focused acceptance and red-test contract

- Menu: every configured section must fit without horizontal or vertical scrolling, including owner-only `Users & installs`; every description is three or four words.
- Secrets: browser-sealed create and replace flows are restored while stored values are never returned.
- Nodes: default first, then other online nodes, then remaining nodes by most-recent activity; active heartbeats backfill platform and architecture.
- Existing patterns: `workspace-chrome.test.ts`, `settings-site.test.ts`, `secrets-hono-routes.test.ts`, `workspace-node-registry-routing.test.ts`, and `workspace-node-heartbeat-client.test.ts`.
- Focused red command: `bunx vitest run tests/workspace-chrome.test.ts tests/settings-site.test.ts tests/secrets-hono-routes.test.ts tests/workspace-node-registry-routing.test.ts tests/workspace-node-heartbeat-client.test.ts`.
- Expected red: long menu copy and `overflow: auto`; no Secrets setup/install UI; creation-ordered nodes and heartbeats without platform metadata.
- Release gate: focused security, OAuth, route, site, and node regressions must pass before stable promotion.

- 2026-08-26 04:00:20 append: `.task/os/fix-internal-launcher-secrets-and-nodes-production-regressions/workpad.md`

- 2026-08-26 04:02:03 write: `packages/os/tests/internal-launcher-regressions.test.ts`

## Red evidence

- `bunx vitest run tests/internal-launcher-regressions.test.ts` failed 4/4 as intended on 2026-08-26: owner group rendered after Configure, sealed-secret actions/endpoints absent, node list creation-ordered, and heartbeat payload missing `platform`/`architecture`.

- 2026-08-26 04:02:25 append: `.task/os/fix-internal-launcher-secrets-and-nodes-production-regressions/workpad.md`

## Final implementation and validation record

### Files and behavior

- Compact two-column, no-scroll launcher menu with three-to-four-word descriptions and owner routes before Configure.
- Browser-sealed Secrets create/replace inventory and signed setup/install gateway contracts; secret values are never returned.
- Default-first, online-next, activity-ordered node registry plus signed platform/architecture heartbeat backfill.
- Updated edge route seed/registry, policy, focused tests, and test-selection registry.

### Validation evidence

- Focused launcher regressions: 4/4 passed.
- Workspace Chrome, heartbeat, secrets, settings, routes, and node registry batch: 72/73 passed.
- Bun-backed edge/gateway contracts: 11/11 passed.
- Sealed credential store and local Hono architecture: 48/48 passed.
- Workspace test-selection registry: 45/45 passed; 2,655 tests, 2,569 mapped, 86 unmapped, 66 rules.
- OAuth/device authorization hardening with gated contracts enabled: 10/10 passed.
- Broader security/OAuth batch: 161 passed, 10 skipped.
- OS script syntax/typecheck and `git diff --check`: passed.

### Decisions and known unrelated failure

- Isolated only the sealed-secret implementation from commit `37f251162d`; its stale branch and unrelated ancestry were not merged.
- The sole failure expects obsolete Caddy worker ports `9000/9001`; current generated configuration uses pooled ports `46321/46322/46323`. It is unrelated to this slice and is being passed per Ko's instruction.
- A no-commit cherry-pick conflict in `settings-site.ts` and the generated registry was resolved by retaining stream behavior and manually integrating the needed secret changes; cherry-pick state was cleanly quit.
- Nx resolved the package as `openworkspace`, but the isolated worktree root does not register `packages/workspace`; its resolved Vitest binary ran the registry suite successfully (45/45).

- Publish verification caught and corrected the tracing description assertion; focused tracing plus launcher rerun passed 17/17.
- The broad OS package suite still fails unrelated facade dry-run contracts. Ko explicitly approved passing those unrelated failures; the generated unrelated session.start facade snapshot was removed before review.
