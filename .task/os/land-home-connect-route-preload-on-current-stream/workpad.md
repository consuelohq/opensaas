# Land Home Connect route preload on current stream

branch: `task/os/land-home-connect-route-preload-on-current-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2054/land-home-connect-route-preload-on-current-stream
github pr: https://github.com/consuelohq/opensaas/pull/2054
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 08:50:10 `verify`: passed — OK

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

behavior under test: Current stream should expose Home at /configuration while keeping Nodes at /; add Connect cards for ChatGPT/Claude, Artifacts and Code routes, current managed-cloud prices, same-origin route prefetch, and a short-lived non-raw trace preview so Tracing paints immediately. The orange active/focus treatment must not use the square outline.
existing local pattern: shared workspace navigation lives in `packages/os/scripts/lib/workspace-chrome.ts`; configuration/Nodes surfaces live under `settings-site.ts` and isolated Nodes helpers; Trace Burn live client owns trace loading; device-authority release publishes workspace shells and managed-cloud runtime configuration.
new or changed tests: focused settings-site, observability-traces-site, managed-cloud pricing, release-contract, and local-agent/Nodes-root contracts as required by the current stream implementation.
focused red command: `bun --cwd packages/os test tests/settings-site.test.ts tests/observability-traces-site.test.ts`
expected red failure: stream/os still renders Overview as `/`, lacks Connect/Artifacts/Code and prefetch behavior, and tracing starts with no prefetched feed.
no-test waiver: not applicable.

Recovery context: PR #2043 contains the previously verified implementation but has real code conflicts against stream/os. Per parallel-agent conflict policy, do not resolve it in place. PR #2048 was clean and merged as a supported recovery step, but current stream still lacks the requested Home/Connect/preload behavior. This task starts from current stream and reimplements the behavior against current code.

## Implementation / validation update

- Home/Connect/prefetch RED: `trc_8559350d3ecb`; focused Home + Trace GREEN before the Nodes assertions: `trc_5b59134889bd`. Current Home is `/configuration` while `/` remains the Home workspace-root alias.
- Added Artifacts (`/artifacts`) and Code (`/diffs`) to Observe, ChatGPT/Claude connector cards in Connect before Guides, same-origin route prefetch on idle/menu intent, and a 20s size-bounded non-raw trace preview in sessionStorage. The route trigger keeps the orange treatment but replaces the square focus outline with an inset underline/background.
- Compact Nodes RED: `trc_74b5628eea0e`; GREEN after isolating `nodes-site.ts`: `trc_9c4f13c4d615`. The Nodes page is searchable/row-based and never says `Price available soon`; it fails closed as `Unavailable` when a current quote cannot load.
- Google pricing module RED: `trc_8387105b42c3`; public-pricing tests GREEN: `trc_682c6db60275`. Live official Google page parse is GREEN: `trc_21b0a8b79870`, including current supported-region E2/disk/snapshot/NAT/egress inputs and five derived checkout quotes per region.
- Release pricing RED: `trc_df051aab00b5`; current release contracts GREEN 17/17: `trc_303fe7626712`. Device Authority now deploys versioned pricing vars, redacts their payloads from command logs, and preserves the current authenticated Hono route-refresh flow.
- Release dry run GREEN: `trc_17941bfd623a`; all 10 site snapshots materialize, pricing vars are present/redacted, Wrangler bundles cleanly, and route refresh is planned.
- Test-selection RED: `trc_5b453d43d897`; extended the existing critical managed-cloud rule to own `nodes-site.ts` and Google pricing files, regenerated the registry, focused GREEN `trc_b56ff8cf12a2`, full registry GREEN `trc_28a7d64d0580`.
- The current stream had a deterministic failure in the independent-agent persistence fixture because it depended on transient local node-route readiness. Rebuilt that one test around a deterministic MCP fixture without production behavior changes; local-agent GREEN 14/14: `trc_681d7dc9ebdb`.
- Full internal workspace-shell suite GREEN 71/71: `trc_ee27e6aad092`. Full current selected task suite GREEN with no failures: `trc_745984da9f60` (release, shell, managed cloud 104/104, Worker 31/31, selection/CI contracts).
- Syntax GREEN: `trc_632410d9c52b`.

## Final verify / ship status

- Formal verify GREEN: `trc_6aebd4d543d4` against `origin/stream/os` — review 0 findings, DB guard 0 risks/findings, all selected suites passed, `publishValid: true`.
- Stream sync preflight is currently blocked by unrelated concurrent work in the shared `stream/os` worktree (`trc_abc3f67d99cd`), including a real unresolved conflict in `packages/os/tests/native-lifecycle-endpoint.test.ts`. Per conflict policy this task does not resolve or overwrite another task's changes.
