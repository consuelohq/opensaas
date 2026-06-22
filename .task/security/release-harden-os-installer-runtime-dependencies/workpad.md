# release harden os installer runtime dependencies

branch: `task/security/release-harden-os-installer-runtime-dependencies`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1168/release-harden-os-installer-runtime-dependencies
github pr: https://github.com/consuelohq/opensaas/pull/1168
started: 2026-06-21

## acceptance criteria

- [x] Runtime downloads are bounded and retried.
- [x] SHA parsing is deterministic and tested.
- [x] Blank `CLOUDFLARED_BIN` cannot produce a blank launchd executable.
- [x] Direct daemon repair path is safe and tested.
- [x] Portless is optional; missing portless falls back to the regular local port and does not block bootstrap or daemon install.
- [x] PR check state inspected; `Workers Builds: opensaas` remains red and PR #1154 is not release-ready.
- [x] PR scope is audited.
- [x] Clean-machine install proof is explicitly listed as remaining release work.

## plan

1. Harden bootstrap network fetches and SHA parsing without changing installer architecture.
2. Fix cloudflared launchd executable normalization and direct portless repair fallback.
3. Add focused installer/runtime tests and release checklist docs.
4. Inspect PR check state and stream scope, then validate and publish.

## current status

- Optional portless fallback implementation is green in focused tests. Clean-machine baseline smoke still requires a real clean macOS profile/VM.

## files changed

- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/docs/installer-runtime-release-checklist.md`
- `packages/os/docs/security-tightening-evidence.md`
- `packages/os/docs/stream-security-pr-1154-scope-audit.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/start-portless-daemon.sh`
- `packages/os/tests/cloudflare-connector-transport-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`


## Server Automatically populates this section: files changed

- none yet

## Server Automatically populates this section: activity log

- none yet

## Server Automatically populates this section: validation evidence

- 2026-06-21 01:20:57 `review.run`: passed — OK
- 2026-06-21 01:21:28 `verify`: passed — OK
- 2026-06-21 02:25:38 `review.run`: passed — OK
- 2026-06-21 02:27:13 `verify`: passed — OK
- 2026-06-21 02:35:10 `verify`: passed — OK

## key decisions

- Public install no longer requires hosted portless artifacts; missing portless records `PORTLESS_ENABLED=0` and uses `http://127.0.0.1:8960`.
- Hosted portless artifacts remain available only for explicit optional/required portless install modes.
- Direct daemon repair generates the portless LaunchAgent only when portless is configured or discoverable.

## notes for ko

- Portless artifacts were verified live on 2026-06-21; all four URLs returned HTTP 404. This blocks only optional hosted portless install, not baseline OS launch.
- Clean-machine macOS smoke was not available yet from this environment.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```



## test-first contract: optional portless fallback

Behavior under test:
- Public bootstrap must not require, download, or persist portless when no executable is configured or discoverable.
- The local OS server and LaunchAgent install path must continue on the regular localhost port without a portless LaunchAgent.
- If portless is already configured or discoverable in direct repair mode, keep using it as an optional enhancement.

Existing local pattern to follow:
- Extend `packages/os/tests/installer-runtime-dependencies.test.ts` shell-contract tests.
- Keep daemon tests deterministic with temp homes and fake executables.

New or changed tests:
- Clean dry-run PATH reports `optional_missing` for portless and a null path.
- Existing `PORTLESS_BIN` reports `present`.
- Direct daemon dry-run skips the portless LaunchAgent when no portless is configured or installed.
- Direct daemon dry-run still includes portless when PATH lookup finds it.

Focused red command:
`CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/installer-runtime-dependencies.test.ts`

Expected red failure before implementation:
- Bootstrap still reports `would_install` and tries to make portless installer-managed.
- Daemon dry-run still emits `com.consuelo.portless.system` even when no portless executable exists.

## validation evidence

- Focused red test before implementation: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/installer-runtime-dependencies.test.ts` failed with bootstrap reporting `would_install` for portless and daemon dry-run emitting `com.consuelo.portless.system` when portless was absent.
- Focused optional-portless test: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/installer-runtime-dependencies.test.ts` passed, 12 tests.
- Shell syntax: `bash -n` passed for changed installer/daemon shell scripts.
- Static destructive/secret scan: passed with no findings for changed files.
- Focused runtime tests: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/installer-runtime-dependencies.test.ts tests/cloudflare-connector-transport-contract.test.ts` passed, 15 tests.
- Required workspace bootstrap contract: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/install-workspace-bootstrap-contract.test.ts` passed, 5 tests.
- Platform Cloudflare provisioning tests: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-provisioning-contract.test.ts tests/platform-cloudflare-provisioning-contract.test.ts tests/cloudflare-worker-deployment-contract.test.ts` passed, 26 tests.
- Typecheck: `bun run typecheck` from `packages/os` passed.
- Review: `review.run --no-tests` passed with 0 issues against `origin/stream/security`.
- Artifact verification: all four hosted portless URLs returned HTTP 404 on 2026-06-21; this is no longer a baseline launch blocker because portless is optional.
- PR #1154 checks: `Workers Builds: opensaas` is the only red check; external Cloudflare Workers build link, started/completed 2026-06-21T00:58:32Z.
- Scope audit: `origin/main...origin/stream/security` has 91 changed paths: 27 OS, 50 `.task`, 14 non-OS workspace/operator.

- Shell syntax after optional-portless change: passed for six shell scripts.
- Optional-portless/connector tests: passed, 17 tests.
- Workspace bootstrap contract: passed, 5 tests.
- Typecheck after optional-portless change: passed.
- Docs scan: no stale required-portless baseline release-gate wording found.
- Review after optional-portless change: passed with 0 issues.
- Verify after optional-portless change: publish-valid; explicit tests above supplement zero-suite selection.
## Server Automatically populates this section: test selection

- changed files: `.task/security/release-harden-os-installer-runtime-dependencies/current.json`, `.task/security/release-harden-os-installer-runtime-dependencies/session.json`, `.task/security/release-harden-os-installer-runtime-dependencies/workpad.md`, `.task/tasks/security/release-harden-os-installer-runtime-dependencies.json`, `packages/os/README.md`, `packages/os/SCRIPTS.md`, `packages/os/docs/installer-runtime-release-checklist.md`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/docs/stream-security-pr-1154-scope-audit.md`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/lib/workspace-connector-transport.ts`, `packages/os/scripts/start-portless-daemon.sh`, `packages/os/tests/cloudflare-connector-transport-contract.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## wait log

Wait reason: PR #1154 checks reset after merging the task branch into `stream/security`; wait for initial CI/Workers status to settle.
Duration: poll every 20s for up to 60s.
Resume action: run `github pr.checks` for PR #1154.
Expected signal: zero pending checks and zero failed checks, or a concrete failed check to document.
Fallback: if checks remain pending after 60s, document pending state and do not mark release-ready.

Observed result: after one 20s poll, PR #1154 checks completed with 45 total checks, 1 failed, 0 pending. The failed check is `Workers Builds: opensaas`, Cloudflare build `558b0877-fe78-4549-9c4d-970bea3792ce`, started/completed 2026-06-21T01:22:37Z.
Next decision: do not mark release-ready; external Workers build remains red.


## hotfix: cloudflared upstream archive checksum drift

### Test-first contract

- Behavior under test: the hosted macOS installer should accept the currently served Cloudflare cloudflared 2026.6.1 Darwin archives for both amd64 and arm64.
- Existing pattern to follow: bootstrap source contract tests inspect the shell bootstrap script constants and installer runtime tests exercise checksum verification behavior.
- New or changed tests: add a bootstrap source contract asserting the pinned Darwin cloudflared archive checksums match the live release assets observed on 2026-06-22.
- Focused red command: bun --cwd packages/os test tests/bootstrap-source.test.ts
- Expected red failure: bootstrap still contains the old amd64/arm64 cloudflared checksum constants.
- Live evidence: GitHub release page text still lists the old checksums, but direct downloads from the release asset URLs hash to d7a66b525fe76820da6e5406611b61e48b40de682368ac00454d9158f085be4b for amd64 and f6d4c439c6c782b83264951d327989ce5e23373acc5942b872411601fedb020d for arm64. The extracted files are signed Mach-O binaries with TeamIdentifier 68WVV388M8.

### Red evidence

- bun --cwd packages/os test tests/bootstrap-source.test.ts failed with the new checksum contract before production changes: 1 failed / 5 passed.

### Implementation

- Updated only the Darwin cloudflared archive checksum constants in packages/os/scripts/bootstrap.sh for both amd64 and arm64 based on direct release asset downloads observed on 2026-06-22.

### Green evidence

- bun --cwd packages/os test tests/bootstrap-source.test.ts passed: 6 tests.
- bash -n packages/os/scripts/bootstrap.sh passed.
- CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/installer-runtime-dependencies.test.ts passed: 12 tests.
- Live release archive verification passed for both Darwin assets: amd64 d7a66b525fe76820da6e5406611b61e48b40de682368ac00454d9158f085be4b, arm64 f6d4c439c6c782b83264951d327989ce5e23373acc5942b872411601fedb020d. Each archive listed a `cloudflared` member.

## workspace-owned: validation evidence

- Focused red test before implementation: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/installer-runtime-dependencies.test.ts` failed with bootstrap reporting `would_install` for portless and daemon dry-run emitting `com.consuelo.portless.system` when portless was absent.
- Focused optional-portless test: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/installer-runtime-dependencies.test.ts` passed, 12 tests.
- Shell syntax: `bash -n` passed for changed installer/daemon shell scripts.
- Static destructive/secret scan: passed with no findings for changed files.
- Focused runtime tests: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/installer-runtime-dependencies.test.ts tests/cloudflare-connector-transport-contract.test.ts` passed, 15 tests.
- Required workspace bootstrap contract: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/install-workspace-bootstrap-contract.test.ts` passed, 5 tests.
- Platform Cloudflare provisioning tests: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-provisioning-contract.test.ts tests/platform-cloudflare-provisioning-contract.test.ts tests/cloudflare-worker-deployment-contract.test.ts` passed, 26 tests.
- Typecheck: `bun run typecheck` from `packages/os` passed.
- Review: `review.run --no-tests` passed with 0 issues against `origin/stream/security`.
- Artifact verification: all four hosted portless URLs returned HTTP 404 on 2026-06-21; this is no longer a baseline launch blocker because portless is optional.
- PR #1154 checks: `Workers Builds: opensaas` is the only red check; external Cloudflare Workers build link, started/completed 2026-06-21T00:58:32Z.
- Scope audit: `origin/main...origin/stream/security` has 91 changed paths: 27 OS, 50 `.task`, 14 non-OS workspace/operator.
- Shell syntax after optional-portless change: passed for six shell scripts.
- Optional-portless/connector tests: passed, 17 tests.
- Workspace bootstrap contract: passed, 5 tests.
- Typecheck after optional-portless change: passed.
- Docs scan: no stale required-portless baseline release-gate wording found.
- Review after optional-portless change: passed with 0 issues.
- Verify after optional-portless change: publish-valid; explicit tests above supplement zero-suite selection.
- 2026-06-22 23:40:21 `review.run`: passed — OK
- 2026-06-22 23:40:43 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/release-harden-os-installer-runtime-dependencies/current.json`, `.task/security/release-harden-os-installer-runtime-dependencies/session.json`, `.task/security/release-harden-os-installer-runtime-dependencies/verify.json`, `.task/security/release-harden-os-installer-runtime-dependencies/workpad.md`, `.task/tasks/security/release-harden-os-installer-runtime-dependencies.json`, `packages/os/README.md`, `packages/os/SCRIPTS.md`, `packages/os/docs/installer-runtime-release-checklist.md`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/docs/stream-security-pr-1154-scope-audit.md`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/lib/workspace-connector-transport.ts`, `packages/os/scripts/start-portless-daemon.sh`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/cloudflare-connector-transport-contract.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
