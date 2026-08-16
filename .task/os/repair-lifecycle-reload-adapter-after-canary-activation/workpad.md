# repair lifecycle reload adapter after canary activation

branch: `task/os/repair-lifecycle-reload-adapter-after-canary-activation`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2109/repair-lifecycle-reload-adapter-after-canary-activation
github pr: https://github.com/consuelohq/opensaas/pull/2109
started: 2026-08-16

## acceptance criteria

- [x] Automatic rollback can target an older immutable runtime whose installer predates newer reconciliation flags.
- [x] Caddy worker topology is derived from canonical supervisor state, never the request worker's slot environment.
- [x] Caddy config changes are applied without restarting the Caddy LaunchAgent or requiring the disabled admin API.
- [x] Focused lifecycle, ingress, and Caddy reconciliation regressions are green.
- [ ] Strict review and formal task verification pass.
- [ ] Fix is merged, runtime is published/promoted, local canary update converges, and post-restart health is verified.

## plan

1. Reproduce rollback failures against installed immutable releases.
2. Add focused RED contracts for old-installer compatibility and worker-bound Caddy topology.
3. Implement bounded compatibility and canonical topology reconciliation.
4. Validate focused lifecycle/ingress/Caddy suites, then strict review and formal verification.
5. Merge to stream/main, publish/promote runtime, update local canary, restart, and smoke-test.

## current status

- Implementation complete and focused tests green; proceeding through strict review/verification and release.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 03:11:29 fs.write: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`
- 2026-08-16 03:14:02 fs.write: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`
- 2026-08-16 03:14:40 fs.write: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`
- 2026-08-16 03:16:13 fs.write: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`
- 2026-08-16 03:19:16 fs.write: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`
- 2026-08-16 03:20:43 fs.write: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:20:08 `review.run`: passed — OK
- 2026-08-16 03:20:30 `verify`: passed — OK
- 2026-08-16 03:20:56 `verify`: passed — OK

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

behavior under test: A signed canary update must activate and reload the installed runtime using only arguments supported by the bundled canonical `scripts/consuelo-reload.js`; same-version/update reconciliation must not fail with an unsupported `--definitions-only` option, and the lifecycle status must converge to a healthy installed runtime after activation.
existing local pattern: `createReloadServiceController` owns macOS reload orchestration and invokes the release-bundled `scripts/consuelo-reload.js`; lifecycle tests use injected process runners so destructive host actions can be validated without executing them.
new or changed tests: add a focused lifecycle/service contract that reproduces the stale/unsupported reload-argument failure and proves the active release path calls only the canonical adapter commands supported by the bundled script. Add a bundle/distribution assertion if the bug is caused by stale generated runtime content.
focused red command: inspect target test sources for destructive literals first, then run only the focused lifecycle/service test that contains no destructive/system-modifying literals.
expected red failure: current release activation path selects or materializes a reload invocation inconsistent with the bundled adapter, reproducing the unsupported option observed in lifecycle operation `native-1786847715545-23bc54f1-2caa-4323-a74c-d68ea9fbe7c6`.
no-test waiver: not applicable.

- 2026-08-16 03:11:29 append: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`

## RED evidence

- Installed canary target `sha256:10f0a7e...` supports `--definitions-only` in `scripts/install-system-daemons.sh`.
- Activation journal shows previous release `sha256:6173bf1a...`; that immutable release's installer does not support `--definitions-only`.
- Automatic rollback switches `runtime/current` back to the previous release and then calls `service.restart({ runtimeRoot: previousReleasePath, allowDestructiveFallback: true })`. The current controller unconditionally passes `--definitions-only` to the target installer, so rollback to the older release fails before reload.
- Focused RED: `bun test packages/os/tests/lifecycle-restart-contract.test.ts` => 17 pass / 1 fail. New regression `keeps rollback compatible with an older runtime installer that predates definitions-only refresh` rejects exactly at `controller.restart(...)`.

- 2026-08-16 03:14:02 append: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`

## Implementation and GREEN evidence

- `createReloadServiceController.restart()` remains strict for normal activation/reconciliation.
- Only when the caller has already opted into destructive fallback (automatic rollback/repair) and the target immutable installer specifically rejects the newer definitions-only capability do we retain the already-installed LaunchAgent definitions and continue through the target release's Caddy/reload path.
- This is safe for the compatibility case because generated LaunchAgent ProgramArguments are rooted at the stable `~/.consuelo/runtime/current` symlink, which has already been repointed before rollback restart.
- Focused GREEN: `bun test packages/os/tests/lifecycle-restart-contract.test.ts` => 18 pass / 0 fail.

- 2026-08-16 03:14:40 append: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`

## Caddy rollback durability

- A concurrent canary `0.1.54` activation reached a second rollback failure: `Caddy worker upstreams do not match the ready worker pool.`
- The reconciliation migration only restarted Caddy when the generated Caddyfile changed. That misses the already-reproduced state where disk config is correct but the running Caddy process still has stale config in memory.
- Added RED contract requiring reconciliation to reapply the Caddyfile through Caddy's live reload API even when disk content is unchanged, and forbidding LaunchAgent kickstart for this config-only operation.
- Implemented managed-binary `caddy reload --config <Caddyfile> --adapter caddyfile --force` when the Caddy LaunchAgent is loaded. This is the semantic zero-downtime config update path; no process restart is used.
- Focused GREEN: lifecycle restart + ingress continuity => 21 pass / 0 fail.

- 2026-08-16 03:16:13 append: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`

## Worker-bound Caddy topology root cause

- Live supervisor snapshot is canonical base `46321`, desired workers `2`, ready ports `46321/46322`.
- Live generated Caddyfile had `46322/46323`.
- Root cause: Caddy reconciliation derived topology from `process.env.CONSUELO_OS_PORT`. Lifecycle executes inside an HA worker, so when worker-1 handles the request its slot port (`46322`) was mistaken for the pool base. The generated Caddy topology therefore depended on which worker received the lifecycle call.
- Added RED regression with canonical snapshot base `48100` plus request-worker env port `48101`; before fix reconciliation incorrectly produced `48101/48102`.
- Fixed reconciliation to prefer validated supervisor snapshot (`node/runs/os-worker-pool.json`) for pool base/count, falling back to environment only during cold setup.
- Managed Caddy intentionally has `admin off`; CLI `caddy reload` cannot work. Verified live LaunchAgent accepts `launchctl kill SIGUSR1 gui/501/com.consuelo.caddy`, so the migration now uses the config-file reload signal instead of restarting Caddy or depending on the admin API.
- Focused GREEN: Caddy reconciliation + lifecycle restart + ingress continuity => 23 pass / 0 fail.

- 2026-08-16 03:19:16 append: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`

## Review and verification

- Strict review (`origin/main`, no duplicate tests): 0 blocking issues, 0 task issues; one non-blocking docs opportunity because lifecycle code changed. No public CLI/config semantics changed, so no user-facing documentation update is required for this reliability-only patch.
- Formal task verification passed with `publishValid=true`; migration/db risk scan reported warnings only and no findings.
- Live recovery probe using the task migration corrected the Mac Caddyfile from the worker-bound `46322/46323` topology to canonical `46321/46322` and signaled the loaded Caddy LaunchAgent without restarting ingress.

- 2026-08-16 03:20:43 append: `.task/os/repair-lifecycle-reload-adapter-after-canary-activation/workpad.md`
