# stabilize configuration shell and redesign tools

branch: `task/os/stabilize-configuration-shell-and-redesign-tools`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2030/stabilize-configuration-shell-and-redesign-tools
github pr: https://github.com/consuelohq/opensaas/pull/2030
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-08-15 05:31:26 fs.write: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`
- 2026-08-15 05:49:05 fs.write: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`
- 2026-08-15 05:51:19 fs.write: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`
- 2026-08-15 06:14:40 fs.write: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`
- 2026-08-15 06:16:52 fs.write: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

## workspace-owned: validation evidence

- none yet

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

behavior under test:
1. `internal.consuelohq.com/` must resolve to the Nodes configuration view, never the legacy launcher/home shell.
2. Configuration navigation between Overview, Nodes, Tools, and Secrets must preserve one shared observability-style chrome shell and swap only the body without a blank/loading flash.
3. Tracing/Observability must use the same chrome shell and expose the same clickable route switcher; the title control opens an accessible route popover for Tracing, Nodes, Tools, Overview, and Secrets.
4. Tools must retain disabled tools in a visible Disabled/Available state with an explicit re-enable/reinstall action; disabling cannot make a tool disappear from management.
5. The Tools view must support useful filtering/toggling while presenting status/distribution with Tufte-style direct labeling, minimal chrome, accessible dark-mode contrast, and responsive behavior.
6. Release/update/restart regressions must not be able to restore the legacy launcher or stale configuration shell. Tests must be wired into a critical focused selection rule so these surfaces fail loudly in CI.

existing local pattern: reuse the existing Observability/Tracing chrome implementation and existing internal Configuration route handlers/components rather than introducing a parallel visual system.
new or changed tests: add/extend route-shell source/DOM contracts, default-route contract, tools disable/re-enable visibility contract, and test-selection ownership for every affected shell/default-route source.
focused red command: run the smallest existing internal dashboard/configuration/observability tests plus the new contracts before production edits.
expected red failure: current default `/` renders the legacy launcher; current Configuration routes render their own sidebar/loading shell; disabled tools disappear from the active list; Tracing title is not a shared route switcher.
no-test waiver: not applicable.

- 2026-08-15 05:31:26 append: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

## Root cause and regression evidence

The old launcher was not a cache or random rollback. `start-consuelo-daemon.sh` intentionally runs `sites refresh --json` on daemon startup, while `packages/os/scripts/lib/sites.ts` still rendered `renderLauncherOnboarding(...)` into the workspace root. So every update/restart could deterministically overwrite the newer root with the retired Welcome launcher. The previous auth/Caddy regression tests did not cover this Sites root materialization path.

RED / GREEN:
- Shared shell/root/UI RED: `trc_b3111d7362c1` — root still rendered the launcher; Configuration still used the left sidebar; Tracing had no shared route switcher.
- Disabled-tool RED: `trc_68ade0297bcd` — a disabled facade tool disappeared from `buildSettingsSnapshot`, exactly explaining why it could not be re-enabled in the UI.
- Disabled-tool GREEN: `trc_5112c87b8d9a` — management snapshot now reads the complete manifest and applies overlay enabled state per item; all 8 Settings Site tests pass.
- Test-selection RED: `trc_2da76f3e96db` — no critical focused owner existed for the internal workspace shell/root surfaces.
- Test-selection focused GREEN: `trc_5e121c0ed589`; full 37-contract GREEN: `trc_b3b177fec1a1`.
- Critical workspace shell suite GREEN: `trc_2cc933fafa48` (69 tests after the disabled-item addition in the selected-suite run).
- Full changed-file selected-suite GREEN: `trc_31010e2f12a4` — all critical selected suites passed with no failed suites; no broad `@consuelo/os` package fallback was selected.

Implementation:
- Workspace root now renders the Nodes route directly on every Sites materialization/refresh. The daemon-to-Sites causal contract asserts startup refresh remains wired to a root renderer that cannot import or emit the legacy launcher.
- Configuration and Tracing use one shared macOS-style chrome component and one accessible route popover for Tracing, Nodes, Tools, Overview, and Secrets.
- Configuration route shells reserve their final body geometry immediately and hydrate in place; visible transient loading panels were removed while screen-reader loading state remains.
- Tools is now one management inventory with a direct-label availability graphic, search, surface/state/category filters, and explicit Disable/Re-enable toggles. Disabled entries remain in the snapshot and say `Available to re-enable`.
- Static browser probes verified the same route menu on Tools (`trc_13d8de06c9c9`), Nodes (`trc_3aed6a70d59a`), and Tracing (`trc_a89a795ac452`).

- 2026-08-15 05:49:05 append: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

## Final verification before publication

- Strict review passed with zero findings and zero documentation opportunities: `trc_94cd38985556`.
- Full formal verify is publish-valid: `trc_43841dffdb11`. It reran the critical registry-selected suites, review checks, and DB guard with no failures.
- Browser interaction probes confirmed the centered page-title route control is keyboard/ARIA-addressable and expands to Tracing, Nodes, Tools, Overview, and Secrets on both Tools and Tracing.

Acceptance status:
- [x] Root launcher regression reproduced and causally tied to daemon Sites refresh.
- [x] `/` converges to Nodes on repeated Sites refresh and cannot import the retired launcher renderer.
- [x] Shared Observability-style chrome replaces the Configuration sidebar and is reused on Tracing.
- [x] Visible transient loading cards removed; route bodies hydrate in their final frame.
- [x] Disabled tools remain visible and re-enableable; regression starts RED and passes GREEN.
- [x] Tufte-style Tools inventory, filters, direct-label availability graphic, and responsive controls implemented.
- [x] Loud critical exclusive test-selection gate added and validated.
- [x] Strict review and formal verify passed.
- [ ] Push exact candidate, merge to main preserving ancestry, publish canary, update this node, then prove root survives an additional restart.

- 2026-08-15 05:51:19 append: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

## Second durability boundary: edge snapshot release ordering

Live validation found a separate reason the authenticated browser could still see an old launcher even after the local root was fixed: the release-managed browser shells are immutable R2 snapshots. Main push production release `31868042036` failed in the Workspace Edge D1 migration with Cloudflare error 7403 before `os:release-device-auth` ran, so the new launcher/root, Tracing, Tools, Nodes, Overview, and Secrets snapshots were never published and the device-authority default snapshot pointer never moved. A device-auth-only release succeeded and published `sha256-963d3434209a6505`; subsequent node heartbeats report `routeReady:true`, which runs the route reconciliation that refreshes release-managed site snapshot pointers.

behavior under test:
- Release-managed workspace shell snapshots must publish before unrelated Workspace Edge D1 migration/deploy work can fail. This keeps the authenticated browser shell current even when an independent edge migration has a credential/platform failure.
- Overall release must still fail loudly if the Workspace Edge release fails; this only changes independent-surface ordering, not error suppression.

new/changed regression:
- Production release contract must require `os:release-device-auth` before `os:release-workspace-edge` in the all-surfaces orchestrator.
expected RED: current test/order explicitly requires Workspace Edge before Device Authority.

- 2026-08-15 06:14:40 append: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

## Edge snapshot release-order RED / GREEN

- RED `trc_1605a6622b32`: the production release contract proved `os:release-device-auth` still ran after Workspace Edge, so a D1 migration failure could strand the authenticated browser on an older immutable workspace snapshot.
- Implementation `trc_1655fe633cf3`: all-surfaces release now publishes/deploys Device Authority and the canonical workspace snapshots before Workspace Edge D1 migration/deploy. Workspace Edge remains later and still fails the overall release loudly if unhealthy.
- Focused GREEN `trc_ce0ff8762369`; full critical selected suites GREEN `trc_0b55eda9ec43` (21 release freshness tests, 3 production release tests, Workspace Edge dry-run; no failed suites).
- Strict review clean `trc_58cf00edb152`; formal verify publish-valid `trc_76d1aed1a702`.
- Live repair already published canonical browser snapshots `sha256-963d3434209a6505` via device-auth-only production release `31868856717` (`trc_439bc356a029`, identifiers `trc_f5e5442581f0`). Current node heartbeats are online with `routeReady:true` (`trc_ba4f4fcaeac9`), which exercises route reconciliation with the new default snapshot pointer.

Acceptance:
- [x] Browser snapshot failure path explained and reproduced from production run ordering.
- [x] New release ordering covered by a RED-before-code regression.
- [x] Snapshot publication no longer depends on unrelated D1 migration success.
- [x] Workspace Edge errors remain loud/fatal after independent snapshots are safely published.
- [x] Review and formal verify green.

- 2026-08-15 06:16:52 append: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`
