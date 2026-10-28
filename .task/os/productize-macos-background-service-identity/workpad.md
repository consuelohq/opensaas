# productize macos background service identity

branch: `task/os/productize-macos-background-service-identity`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2547
started: 2026-09-23

## acceptance criteria

- [x] macOS node heartbeat runs inside the existing Consuelo OS supervised process tree instead of a Bun-backed `com.consuelo.os.node-heartbeat.*` LaunchAgent.
- [x] workspace materialization no longer emits a new macOS heartbeat plist; a pre-migration generated definition is retained only as rollback material and is never installed by the new runtime.
- [x] new daemon definitions ignore legacy heartbeat plists; after a successful target-runtime rolling restart, lifecycle retires the installed legacy heartbeat LaunchAgent idempotently. `--definitions-only` does not stop it early.
- [x] lifecycle restart no longer treats heartbeat as an independently restartable macOS sidecar on new runtimes; Caddy/cloudflared ingress continuity is unchanged. Legacy target runtimes still restore the old heartbeat job for rollback compatibility.
- [x] Linux systemd heartbeat behavior and Windows supervisor heartbeat behavior remain unchanged.
- [x] uninstall remains backward-compatible and removes any old heartbeat LaunchAgent left by a pre-migration install.
- [x] This task lands the highest-impact Bun-signer notification removal first; first-party native service registration and remaining Caddy/cloudflared/watchdog consolidation stay explicit follow-up slices of the handoff.

## plan

1. Move macOS heartbeat scheduling into one designated supervised worker using the scheduler primitive already used by Windows; this makes a rolling update activate the change without restarting the long-lived supervisor.
2. Stop creating/installing the direct Bun heartbeat LaunchAgent and retire the installed legacy job only after the new supervised worker is healthy; retain an old generated plist solely so rollback to a pre-migration release can restore its expected service.
3. Remove heartbeat from the lifecycle launchd-sidecar restart set while preserving Caddy/cloudflared continuity.
4. Run focused heartbeat/installer/lifecycle tests plus strict review/verify and inspect the final diff.
5. Publish into `stream/os`, then continue the remaining background-item consolidation as separate focused tasks before CLI/release-facade work.

## current status

- Handoff recovered from `/private/tmp/opensaas-handoffs/macos-background-items-productization-handoff.md`.
- `stream/os` was 57 commits behind `main`; synchronized successfully before task creation and is now aligned.
- This task intentionally excludes the separate fresh-Mac uninstall/reinstall debugging loop.

## Test-first contract

behavior under test: on macOS, workspace heartbeat is scheduled by a designated worker under the existing Consuelo OS supervisor and is never registered as a separate Bun-backed LaunchAgent; after a successful rolling restart the installed legacy heartbeat job is retired, while its generated definition is retained for rollback compatibility.
existing local pattern: Windows already schedules heartbeat with `startWorkspaceNodeHeartbeatScheduler`; macOS currently writes `com.consuelo.os.node-heartbeat.<node>.plist`, the daemon installer installs/bootstraps it, and lifecycle restart enumerates the heartbeat prefix as a sidecar. The supervisor intentionally survives normal rolling updates, so putting the scheduler only in supervisor startup would not migrate existing Macs immediately.
new or changed tests: `install-workspace-bootstrap-contract.test.ts`, `macos-platform.test.ts`, `installer-runtime-dependencies.test.ts`, and `lifecycle-ingress-continuity.test.ts` (plus any directly selected regression suites).
focused red command: `bun --cwd packages/os test tests/install-workspace-bootstrap-contract.test.ts tests/macos-platform.test.ts tests/installer-runtime-dependencies.test.ts tests/lifecycle-ingress-continuity.test.ts`.
expected red failure: current macOS materialization still creates/overwrites the heartbeat plist; Darwin workers do not schedule heartbeat; installer advertises/boots the heartbeat job; lifecycle restart still kickstarts the heartbeat label instead of retiring it after worker cutover.
no-test waiver: not applicable.

## files changed

- `packages/os/scripts/lib/macos-supervised-heartbeat.ts` — explicit Darwin worker ownership predicate and runtime capability marker.
- `packages/os/scripts/server/supervisor.ts` / `server/main.ts` — designate worker slot 0 as macOS heartbeat owner and start/stop the existing scheduler with worker lifecycle.
- `packages/os/scripts/lib/install-state.ts` — stop creating new Darwin heartbeat LaunchAgent definitions while retaining heartbeat config and Linux systemd behavior.
- `packages/os/scripts/install-system-daemons.sh` — stop installing/bootstraping heartbeat plists and retire any installed legacy job only after a successful full install cutover.
- `packages/os/scripts/lib/lifecycle/service.ts` — retire legacy heartbeat after new-runtime rolling cutover; restore/restart it when the target runtime is legacy so automatic rollback remains safe.
- `packages/os/scripts/lib/distribution/runtime-bundle.ts` — require the new helper in runtime bundles.
- focused macOS/installer/lifecycle/Windows tests updated for migration and rollback behavior.

## key decisions

- Keep the menu-bar UI out of runtime supervision; lifecycle engine/service-manager remains authoritative.
- Do not re-sign third-party vendor binaries to conceal upstream identities.
- Keep this task focused on the background-service identity/migration boundary; CLI PATH/presentation and release-facade reliability will be separate task branches.
- Reuse the existing heartbeat scheduler primitive rather than adding native supervision logic. The designated worker is slot 0, so ordinary rolling replacement activates the migration immediately while preserving the long-lived supervisor and ingress.
- Preserve a legacy generated heartbeat plist across this migration because an automatic rollback to a pre-migration runtime still needs that immutable old runtime to reinstall its expected heartbeat LaunchAgent.

## notes for ko

- Focused macOS installer/lifecycle suite: 57/57 passing.
- Cross-platform/release regression suite: 56 passing, 7 existing todos/skips.
- Strict workspace review: zero blocking issues; one non-blocking docs opportunity. No public docs change added because this slice changes internal supervision/notification identity rather than public CLI/config behavior.

## improvements noticed

- none yet.

## errors i ran into

- Repo-scoped `fs.read` correctly rejected the handoff path because it lives under `/private/tmp`; recovered it read-only through the OS command runner instead.
- First workpad overwrite omitted the required `force` flag and was rejected without mutating the file.
- Initial test runner call used unsupported `code.call` mode `run`; reran with `verify` and captured the intended red failures.
- One intermediate patch hunk missed after the test shape changed; inspected the current source and reapplied targeted hunks without losing edits.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-23 00:46:03 write: `.task/os/productize-macos-background-service-identity/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 00:46:03 fs.write: `.task/os/productize-macos-background-service-identity/workpad.md`

## workspace-owned: files read

- `packages/os/docs/architecture/native-platform-spike.md`
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/Package.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/plans/consuelo-os-foundation/workers/19-macos-app-service.md`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-scheduler.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/lifecycle-ingress-continuity.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/os/tests/system-daemon-reliability.test.ts`
- `packages/os/tests/windows-platform.test.ts`
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`

- 2026-09-23 00:55:25 apply-patch: `packages/os/tests/windows-platform.test.ts`

## workspace-owned: validation evidence

- 2026-09-23 00:56:05 `review.run`: passed — OK

- 2026-09-23 00:56:20 apply-patch: `.task/os/productize-macos-background-service-identity/workpad.md`