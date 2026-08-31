# Heatmap menu polish on current OS stream

branch: `task/os/heatmap-menu-polish-on-current-os-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2075/heatmap-menu-polish-on-current-os-stream
github pr: https://github.com/consuelohq/opensaas/pull/2075
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

- 2026-08-15 18:31:29 fs.write: `.task/os/heatmap-menu-polish-on-current-os-stream/workpad.md`
- 2026-08-15 18:39:59 fs.write: `.task/os/heatmap-menu-polish-on-current-os-stream/workpad.md`
- 2026-08-15 18:45:13 fs.write: `.task/os/heatmap-menu-polish-on-current-os-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 18:40:19 `review.run`: passed — OK
- 2026-08-15 18:40:46 `verify`: failed — COMMAND_FAILED
- 2026-08-15 18:42:03 `verify`: failed — COMMAND_FAILED
- 2026-08-15 18:45:06 `verify`: passed — OK

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

behavior under test: restore the shared workspace shell that was previously merged, keep Overview as the durable root, make the route picker typography stable across routes and fit Documentation on small viewports, point Documentation to https://docs.consuelohq.com/, port the Trace Burn hourly heatmap to Overview using live same-origin trace aggregates with cache/refresh/hover/focus/light-dark/reduced-motion behavior, and keep Tracing columns ordered Input -> Output -> Node -> Trace.
existing local pattern: PR #2039 established the shared workspace chrome/Overview shell; PR #2041 established the tracing integration; Trace Burn v38 assets provide the heatmap visual language and vendored GSAP.
new or changed tests: restore the critical workspace-shell tests from the known-good merged UI, then add explicit assertions for external documentation URL, stable title sizing/fit rules, heatmap markup and live aggregate transport/cache/theme/GSAP contract, and trace table column order.
focused red command: use the focused packages/os workspace-shell and observability test selection before implementation.
expected red failure: current stream has regressed to the old sidebar settings shell, lacks workspace-chrome.ts and the Overview heatmap, uses the wrong documentation/navigation contract, and renders Node before Input/Output in Tracing.
no-test waiver: not applicable.

## Recovery note

The shared stream/os worktree is dirty with another documentation task and unresolved files. This task was deliberately started from the remote stream ref in an isolated worktree; do not mutate, reset, or clean the shared stream worktree.

- 2026-08-15 18:31:29 append: `.task/os/heatmap-menu-polish-on-current-os-stream/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`

## Implementation + focused verification

- Restored stable shared chrome typography at the route-trigger layer so Overview, Tools, Tracing, and long labels share the same 12px mono title sizing; added ellipsis/min-width/mobile fitting rules.
- Changed Guides -> Documentation to the canonical external URL https://docs.consuelohq.com/ with target=_blank + noopener/noreferrer.
- Kept Overview as the ungrouped first/default configuration surface and renamed its visible title from Home to Overview.
- Ported the Trace Burn heatmap visual language into Overview as the primary surface: 7 calendar days x 24 local hours, recovered dark palette, intentional light palette, direct Calls/Tokens/Cost summary, focusable cells, hover/focus tooltip, vendored GSAP entrance animation, reduced-motion fallback, horizontal mobile containment.
- Wired the heatmap to the signed same-origin trace history endpoint with includeRawPayload=false. The gateway max window is 100, so the implementation pages up to 24 windows using nextCursor and stops once it crosses the seven-day cutoff. Aggregated (not raw) heatmap state is cached in sessionStorage for 30 seconds and refreshed every 30 seconds while visible.
- Preserved the Tracing table contract Input -> Output -> Node -> Trace.

Focused RED evidence before implementation: 6 failed / 24 passed because the current stream still rendered Home, /docs, unstable route typography, and no Overview heatmap.
Focused GREEN evidence after implementation: `bun --cwd packages/os test tests/settings-site.test.ts tests/observability-traces-site.test.ts tests/sites-cli.test.ts tests/launcher-nodes-materialization.test.ts` -> 4 files passed, 30/30 tests passed (trace trc_fb0f9a81f98a).

- 2026-08-15 18:39:59 append: `.task/os/heatmap-menu-polish-on-current-os-stream/workpad.md`

- 2026-08-15 18:43:50 apply-patch: `packages/os/tests/launcher-local-customization.test.ts`
- 2026-08-15 18:43:50 apply-patch: `packages/os/tests/install-state.test.ts`
- 2026-08-15 18:43:50 apply-patch: `packages/os/tests/local-agent-connectivity.test.ts`
- 2026-08-15 18:44:15 apply-patch: `packages/os/tests/install-state.test.ts`

Formal selection gate: explicit `verify --base origin/stream/os` passed with publishValid=true after updating the selected install/customization/connectivity assertions from Home to Overview. The full critical workspace-shell suite is now 71/71 green (trace trc_14297b2437e2), and formal verification passed (trace trc_869e65030bc9). Strict review remains 0 issues/blockers (trace trc_b9b60762f243).

- 2026-08-15 18:45:13 append: `.task/os/heatmap-menu-polish-on-current-os-stream/workpad.md`
