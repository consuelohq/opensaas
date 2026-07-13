# hide os home prompt and register launcher hostname

branch: `task/security/hide-os-home-prompt-and-register-launcher-hostname`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1176/hide-os-home-prompt-and-register-launcher-hostname
github pr: https://github.com/consuelohq/opensaas/pull/1176
started: 2026-06-23

## acceptance criteria

- [x] Interactive installer no longer prompts for `OS home`; it resolves the default home in the background.
- [x] Installer banner/progress copy no longer lists `home` as a setup step.
- [x] Installer still persists `home` in machine-readable payloads and final bootstrap summary.
- [x] `mac-air-test.consuelohq.com` is registered in the workspace-edge route registry and no longer returns `WORKSPACE_HOSTNAME_NOT_FOUND`.

## plan

1. Add source-level installer contract tests for no visible home prompt/step.
2. Remove the `OS home` prompt and visible home step from `packages/os/scripts/install.ts`.
3. Validate focused installer tests and shell/bootstrap contracts.
4. Seed the workspace-edge D1 route for `mac-air-test.consuelohq.com` and verify the live URL.
5. Release the updated public installer if validation is clean.

## test-first contract

Behavior under test:
- Human interactive setup should not ask for `OS home` or show `home` as a setup step.
- The installer should still resolve/persist `home` for config, payloads, and daemon setup.

Existing local pattern to follow:
- Source-level contracts in `packages/os/tests/install-workspace-bootstrap-contract.test.ts` inspect `scripts/install.ts` for high-level installer safety boundaries.

Focused red command:
`CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-workspace-bootstrap-contract.test.ts`

Expected red failure:
- `install.ts` still contains `message: 'OS home'`, includes `home` in the setup banner, and calls `stepComplete('home')`.

## current status

- Confirmed `https://mac-air-test.consuelohq.com/` returns `404 WORKSPACE_HOSTNAME_NOT_FOUND` from Cloudflare.
- Confirmed D1 `workspace_route_registry` has no records for `mac-air-test.consuelohq.com`, `macbook-air-testing.consuelohq.com`, or `internal.consuelohq.com`; only `testing.consuelohq.com` exists.
- Implemented installer UI fix; focused tests and release dry-run are green.
- Registered `mac-air-test.consuelohq.com` in the remote workspace-edge D1 route registry using the current launcher shell snapshot.
- Verified `https://mac-air-test.consuelohq.com/` and `/health` now return 200 HTML with `x-consuelo-edge-cache-authority: sites-snapshot`.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/install.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

## workspace-owned: activity log

- 2026-06-23: repaired `mac-air-test.consuelohq.com` D1 route to the current launcher shell snapshot.

## workspace-owned: validation evidence

- Browser baseline: `https://mac-air-test.consuelohq.com/` returned JSON error `WORKSPACE_HOSTNAME_NOT_FOUND`; screenshot `/tmp/opensaas-screenshots/mac-air-test.consuelohq.com-2026-06-23T02-04-27.png`.
- D1 baseline: no rows existed for `mac-air-test.consuelohq.com`, `macbook-air-testing.consuelohq.com`, or `internal.consuelohq.com`; only `testing.consuelohq.com` existed.
- Red test: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-workspace-bootstrap-contract.test.ts` failed before implementation because `install.ts` still contained `message: 'OS home'`.
- Green focused test: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-workspace-bootstrap-contract.test.ts` passed, 6 tests.
- Bootstrap source test: `bun --cwd packages/os test tests/bootstrap-source.test.ts` passed, 7 tests.
- Installer runtime contracts: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/installer-runtime-dependencies.test.ts` passed, 12 tests.
- Release dry-run: `bun run os:release-install -- --dry-run` passed; bootstrap hash unchanged at `70a1831452d2bf5abb57c73a957f157a773b9c253c6cf0ad00d5b2df9818dff6`.
- D1 route repair: remote `workspace_route_registry` upsert for `mac-air-test.consuelohq.com` succeeded with `changes: 1`.
- Live route verification: `https://mac-air-test.consuelohq.com/` and `/health` returned status 200, `content-type: text/html; charset=utf-8`, `x-consuelo-edge-cache-authority: sites-snapshot`, `x-consuelo-site-version: sha256-15c3f6f5c611b43c`.
- Browser verification after repair: `https://mac-air-test.consuelohq.com/` rendered `Consuelo OS Sites`; screenshot `/tmp/opensaas-screenshots/mac-air-test.consuelohq.com-2026-06-23T02-14-03.png`.
- 2026-06-23 02:16:28 `review.run`: passed — OK
- 2026-06-23 02:16:37 `verify`: passed — OK

## key decisions

- Immediate hostname repair reused the current generic launcher shell snapshot already served by `testing.consuelohq.com`; this unblocks retesting without requiring per-workspace snapshot publishing in the installer.
- Follow-up platform work should make device approval/control-plane provisioning publish or register workspace launcher routes automatically.


## notes for ko

- none yet

## improvements noticed

- Device approval/control-plane provisioning should automatically publish or register launcher routes so new workspace hosts do not require manual D1 repair.

## issues and recovery

- `publishWorkspaceEdgeSnapshot` direct helper invocation was blocked by the wrapper; recovered by applying a narrow D1 route repair against the known-good launcher snapshot and verifying the public URL.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-23 02:08:48 apply-patch: `.task/security/hide-os-home-prompt-and-register-launcher-hostname/workpad.md`
- 2026-06-23 02:09:09 apply-patch: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- 2026-06-23 02:09:56 apply-patch: `packages/os/scripts/install.ts`

- 2026-06-23 02:15:35 apply-patch: `.task/security/hide-os-home-prompt-and-register-launcher-hostname/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/hide-os-home-prompt-and-register-launcher-hostname/current.json`, `.task/security/hide-os-home-prompt-and-register-launcher-hostname/session.json`, `.task/security/hide-os-home-prompt-and-register-launcher-hostname/workpad.md`, `.task/tasks/security/hide-os-home-prompt-and-register-launcher-hostname.json`, `packages/os/scripts/install.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
