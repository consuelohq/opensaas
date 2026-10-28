# salvage sites launcher public route

branch: `task/security/salvage-sites-launcher-public-route`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1355/salvage-sites-launcher-public-route
github pr: https://github.com/consuelohq/opensaas/pull/1355
started: 2026-07-03

## acceptance criteria

- [x] Salvage the useful, non-conflicting part of stale PR #1322 without carrying over obsolete assumptions.
- [x] Keep `sites.consuelohq.com` as a public site snapshot host covered by OS Cloudflare router regression tests.
- [x] Make the public Sites root launcher reuse the OS shared launcher renderer so launcher copy and layout have one source of truth.
- [x] Preserve generated Sites server hotkeys and route aliases for `/office`, `/observability`, `/tracing`, and `/diffs`.
- [x] Read local launcher data from the new `~/.consuelo` layout first, with legacy fallbacks and central `https://os.consuelohq.com/mcp` fallback.

## plan

1. Inspect stale PR #1322 and compare against current `main`.
2. Add regression tests for public Sites snapshot routing and shared launcher wiring.
3. Update `office.ts` to render the public Sites launcher from `launcher-onboarding.ts`.
4. Run focused workspace and OS tests, plus a Bun runtime smoke for `office.ts`.
5. Push task PR, promote to stream/main, and release the Cloudflare snapshot if the merged change affects published launcher output.

## current status

- Implementation complete in the task worktree.
- Focused workspace launcher test is green.
- OS Cloudflare edge-router contract is green.
- `bun run office help` runtime smoke is green.
- Task still needs review/verify, push, merge/promotion, and release decision.

## files changed

- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/workspace/scripts/office.ts`
- `packages/workspace/tests/office-theme.test.js`


## workspace-owned: files changed

- none

## workspace-owned: activity log

- Inspected PR #1322 and confirmed it was stale/conflicting and did not contain the auth-first installer change.
- Confirmed current `main` already has most launcher copy updates and public host route groundwork.
- Created task branch `task/security/salvage-sites-launcher-public-route` from `main` against `stream/security`.
- Added tests first; workspace launcher test failed before implementation on missing shared renderer wiring.
- Implemented shared launcher wiring in `office.ts` and updated stale source-string tests to encode the new single-source renderer contract.

## workspace-owned: validation evidence

- Red test before implementation: `cd packages/workspace && bun run test -- tests/office-theme.test.js` failed because `office.ts` did not import `renderLauncherOnboarding`.
- `cd packages/workspace && bun run test -- tests/office-theme.test.js` passed: 15 tests.
- `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/cloudflare-edge-router.test.ts` passed: 19 tests.
- `cd packages/workspace && bun run office help` passed and printed the Consuelo design help output.

## key decisions

- PR #1322 is superseded by this task branch instead of resolving its conflicts directly; the task branch carries only the relevant launcher/public-route work on top of current `main`.
- The public Sites launcher should reuse `packages/os/scripts/lib/launcher-onboarding.ts` so launcher copy, link labels, workspace wording, and local-agent status do not drift between OS and Sites.
- The installer auth-first flow remains separate work; this task does not change installer onboarding order.

## notes for ko

- This fixes/salvages the launcher/public Sites part. It does not make the installer authenticate before workspace naming.
- The public snapshot route test is regression coverage for the Cloudflare path Ko was questioning.
- Release is likely needed after merge because `office.ts` affects the generated/public Sites launcher snapshot.

## improvements noticed

- `packages/workspace/package.json` still has `name: "openworkspace"`; Ko asked to hand that to a separate agent later.
- `sitesLauncherMcpUrl` currently reads legacy `config.json` for workspace host. Future YAML config migration should move this to the approved `~/.consuelo/consuelo.yaml` / workspace shared config path when that data is written there.

## issues and recovery

- Two edit scripts failed because literal test strings containing `${...}` were evaluated by the patch script. Recovery: switched to range-based replacement and reran focused tests.
- One workpad read script tried to scan a JSON file as a directory. No repo files changed; recovered with a direct file read.

---

## publish checklist

```bash
bun run task:push -- --message "fix(security): salvage sites launcher public route" --changed
bun run task:pr
bun run task:finish
```
