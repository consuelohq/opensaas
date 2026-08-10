# Fix persistent OS runtime and connector LaunchAgent installation

branch: `task/security/fix-persistent-os-runtime-and-connector-launchagent-installation`
stream: `stream/security`
github pr: https://github.com/consuelohq/opensaas/pull/1483
started: 2026-07-14

## Acceptance criteria

- [x] Hosted installs promote executable OS source and dependencies into a versioned persistent runtime under `~/.consuelo/runtime/releases/`.
- [x] `runtime/current` resolves to the active persistent release and never to temporary source.
- [x] System and watchdog LaunchAgents are generated from persistent runtime paths.
- [x] Connector LaunchAgents under `~/.consuelo/node/security/generated/` are installed and bootstrapped.
- [x] Daemon installation fails closed unless local OS and the assigned connector transport become healthy.
- [ ] A clean MacBook install survives staging deletion and a user-session service restart.
- [ ] The assigned public connector serves MCP discovery after the release.
- [x] Security-stream guidance records how to distinguish an offline node from infrastructure failure.

## Plan

1. Reproduce temporary-runtime and missing-connector behavior with focused tests.
2. Add atomic runtime promotion and route daemon installation through the promoted runtime.
3. Use the flattened Consuelo home consistently for security, logs, generated plists, and service state.
4. Gate success on local and assigned-connector health.
5. Run focused and broader tests, strict review, verification, publish, release, and a clean MacBook loop.

## Discovery

- The MacBook system and watchdog LaunchAgents referenced a deleted `/var/folders/.../consuelo-os-source` tree and exited 127.
- The generated connector token and plist existed under the flattened home, but no connector LaunchAgent was installed and no cloudflared process was running.
- Local ports 46321, 8850, and 8960 were unreachable; the assigned public connector returned Cloudflare Error 1033.
- Central `os.consuelohq.com/health` remained green, so it was not a valid acceptance signal for the customer connector.
- Users do not need Cloudflare accounts or credentials. Consuelo owns connector provisioning and Cloudflare infrastructure.
- The MacBook is reachable over Tailscale SSH. Full Disk Access and Remote Management are not required.

## Test-first evidence

- Red command: `bun --cwd packages/os vitest run tests/bootstrap-source.test.ts tests/installer-runtime-dependencies.test.ts`.
- Initial result: 4 expected failures and 26 passes.
- Red failures covered missing runtime promotion, missing promotion ordering, and flattened connector discovery during install and uninstall.
- A later legacy-upgrade test also failed before removing the unsafe nested-runtime fallback.

## Files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/AGENTS.md`

## Validation evidence

- `bash -n` passed for all five modified shell scripts.
- Focused Vitest after implementation: 32/32 tests passed across `bootstrap-source.test.ts` and `installer-runtime-dependencies.test.ts`.
- Prettier reports the changed TypeScript and Markdown files unchanged.
- Package syntax/typecheck passed: `workspace script syntax checks passed`.
- `git diff --check` passed.
- Strict `review.run --base HEAD` reported zero blocking issues.
- Workspace `verify --base HEAD` passed and wrote a publish-valid stamp.
- Additional unaffected suites: install diagnostics 3/3, local agent connectivity 1/1, compact daemon output 6/6.
- Vitest cannot collect suites importing `bun:sqlite`; the committed TTY suite also has two assertions already stale on `HEAD`. Neither failure is introduced by this diff.
- Release and live MacBook proof remain in progress.

## Key decisions

- Preserve each hosted release under `runtime/releases/<sha256>` and atomically switch `runtime/current`.
- Keep local source development on its current repo path; only hosted source is promoted.
- Never activate the root of a legacy nested install as the runtime. Legacy installs also use their own `runtime/current` subtree.
- Discover generated connector plists from `node/security/generated`.
- Derive the opaque connector origin from the non-secret connector ID using the platform's existing SHA-256 contract.
- Treat assigned connector health, not central OAuth health, as the external installation gate.
- Roll back LaunchAgent cutover when either local or connector health fails.

## Issues and recovery

- One long workspace verification call returned HTTP 504 after shell syntax completed. Retrying the focused suite through the workspace facade completed normally.
- `local-os-port-cutover.test.ts` previously failed to collect in Vitest because that runner could not resolve `bun:sqlite`; this is an environment limitation, not a changed assertion. The live port cutover remains part of the MacBook acceptance loop.

## workspace-owned: validation evidence

- `bash -n` passed for all five modified shell scripts.
- Focused Vitest after implementation: 32/32 tests passed across `bootstrap-source.test.ts` and `installer-runtime-dependencies.test.ts`.
- Prettier reports the changed TypeScript and Markdown files unchanged.
- Broader installer tests, strict review, workspace verification, release, and live MacBook proof remain in progress.
- 2026-07-14 17:46:09 `review.run`: passed — OK
- 2026-07-14 17:46:34 `verify`: passed — OK
- 2026-07-14 17:48:06 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-persistent-os-runtime-and-connector-launchagent-installation/current.json`, `.task/security/fix-persistent-os-runtime-and-connector-launchagent-installation/session.json`, `.task/security/fix-persistent-os-runtime-and-connector-launchagent-installation/verify.json`, `.task/security/fix-persistent-os-runtime-and-connector-launchagent-installation/workpad.md`, `.task/tasks/security/fix-persistent-os-runtime-and-connector-launchagent-installation.json`, `packages/os/AGENTS.md`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/scripts/uninstall-system-daemons.sh`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
