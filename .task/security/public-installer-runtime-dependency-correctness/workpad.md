# public installer runtime dependency correctness

branch: `task/security/public-installer-runtime-dependency-correctness`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1159/public-installer-runtime-dependency-correctness
github pr: https://github.com/consuelohq/opensaas/pull/1159
started: 2026-06-20

## acceptance criteria

- [x] Public bootstrap has an explicit dependency contract for macOS system tools, installer-managed runtime binaries, package-managed dependencies, and operator-only Cloudflare tooling.
- [x] Clean-machine dry-run reports Bun, portless, and cloudflared dependency handling without relying on `/opt/homebrew/bin` or `/usr/local/bin`.
- [x] Portless is installed/discovered in bootstrap, persisted as `PORTLESS_BIN`, and required before daemon install.
- [x] Cloudflared is installed/discovered in bootstrap, persisted as `CLOUDFLARED_BIN`, and used for tunnel LaunchAgents without requiring Cloudflare login/admin authority.
- [x] Daemon install/uninstall dry-runs include workspace, portless, watchdog, and dynamic cloudflared services where applicable.
- [x] Cloudflared generated plist filenames are label-derived to avoid duplicate LaunchAgents.
- [x] Platform/admin Cloudflare WAF provisioning remains explicit operator tooling and dry-run plans before reading account credentials.

## plan

1. Add TDD coverage for clean-machine dependency handling and daemon dry-runs.
2. Implement bootstrap runtime binary resolution/install/persistence for Bun, portless, and cloudflared.
3. Wire persisted binary paths through daemon launchers and generated plists.
4. Fix dynamic cloudflared LaunchAgent filename/label coherence and install/uninstall discovery.
5. Preserve the public installer boundary from Cloudflare account/WAF authority.
6. Run focused tests, safety/secret scans, typecheck, review, verify, push, and promote to `stream/security`.

## current status

- Post-merge focused installer suite is passing: 5 files, 23 tests.
- Standalone workspace bootstrap contract is passing: 1 file, 5 tests.
- Platform Cloudflare provisioning boundary tests are passing: 2 files, 22 tests.
- OS package typecheck is passing.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/scripts/start-portless-daemon.sh`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/cloudflare-connector-transport-contract.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`

## Server Automatically populates this section: files changed

- none yet

## Server Automatically populates this section: activity log

- 2026-06-20 03:00:49 fs.read: `CODING-STANDARDS.md`
- 2026-06-20 03:02:17 fs.read: `packages/os/scripts/bootstrap.sh`
- 2026-06-20 03:02:18 fs.read: `packages/os/scripts/uninstall-system-daemons.sh`
- 2026-06-20 03:02:19 fs.read: `packages/os/scripts/install-system-daemons.sh`
- 2026-06-20 03:02:20 fs.read: `packages/os/scripts/generate-system-daemons.sh`
- 2026-06-20 03:02:32 fs.read: `packages/os/scripts/start-portless-daemon.sh`
- 2026-06-20 03:02:33 fs.read: `packages/os/scripts/workspace-watchdog.sh`
- 2026-06-20 03:02:34 fs.read: `packages/os/scripts/start-consuelo-daemon.sh`
- 2026-06-20 03:02:35 fs.read: `packages/os/scripts/lib/workspace-connector-transport.ts`
- 2026-06-20 03:02:50 fs.read: `packages/os/scripts/lib/install-state.ts`
- 2026-06-20 03:02:54 fs.read: `packages/os/scripts/lib/install-state.ts`
- 2026-06-20 03:03:11 fs.read: `packages/os/tests/cloudflare-connector-transport-contract.test.ts`
- 2026-06-20 03:03:12 fs.read: `packages/os/tests/bootstrap-source.test.ts`
- 2026-06-20 03:03:13 fs.read: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- 2026-06-20 03:03:14 fs.read: `packages/os/tests/install-cloudflare-provisioning-contract.test.ts`
- 2026-06-20 03:03:22 fs.read: `packages/os/scripts/lib/install-cloudflare-provisioning.ts`
- 2026-06-20 03:03:23 fs.read: `packages/os/package.json`
- 2026-06-20 03:03:24 fs.read: `packages/os/scripts/install.ts`
- 2026-06-20 03:05:07 fs.read: `packages/os/scripts/lib/install-state.ts`
- 2026-06-20 03:05:13 fs.read: `packages/os/scripts/install.ts`
- 2026-06-20 03:05:51 fs.read: `packages/os/tests/safe-temp-cleanup.ts`
- 2026-06-20 03:14:04 fs.read: `packages/os/scripts/lib/sites.ts`
- 2026-06-20 03:14:18 fs.read: `packages/os/scripts/lib/sites.ts`
- 2026-06-20 03:19:55 fs.read: `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`

## Server Automatically populates this section: validation evidence

- 2026-06-20 03:01Z static destructive/secret baseline scan over installer/daemon files: scoped temp cleanup and daemon `exec` handoff only; no literal destructive shell payloads in the installer path.
- 2026-06-20 03:13Z `bash -n scripts/bootstrap.sh scripts/generate-system-daemons.sh scripts/install-system-daemons.sh scripts/uninstall-system-daemons.sh scripts/start-portless-daemon.sh scripts/start-consuelo-daemon.sh scripts/workspace-watchdog.sh`: pass.
- 2026-06-20 03:16Z `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/bootstrap-source.test.ts tests/installer-runtime-dependencies.test.ts tests/cloudflare-connector-transport-contract.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/install-cloudflare-provisioning-contract.test.ts`: 5 files, 22 tests passed before merging `origin/stream/security`.
- 2026-06-20 03:19:11 `review.run`: passed — OK before merging `origin/stream/security`.
- 2026-06-20 03:19:24 `verify --base origin/stream/security`: failed because the task branch was started from `main`, so stream workspace-agent changes appeared in the reverse diff and selected unrelated workspace task-session tests.
- 2026-06-20 03:22Z merged `origin/stream/security` into the task branch and resolved the renamed `platform-cloudflare-provisioning-contract.test.ts` conflict.
- 2026-06-20 03:24Z post-merge static destructive/secret scan over changed OS files: no destructive payloads in tests; reviewed hits are scoped installer cleanup, generated artifact cleanup, and dry-run subprocess execution. Fake Cloudflare fixture values were shortened to avoid token-like scanner noise.
- 2026-06-20 03:24Z `bash -n packages/os/scripts/bootstrap.sh packages/os/scripts/generate-system-daemons.sh packages/os/scripts/install-system-daemons.sh packages/os/scripts/uninstall-system-daemons.sh packages/os/scripts/start-portless-daemon.sh`: pass.
- 2026-06-20 03:25Z `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/bootstrap-source.test.ts tests/installer-runtime-dependencies.test.ts tests/cloudflare-connector-transport-contract.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/platform-cloudflare-provisioning-contract.test.ts`: 5 files, 23 tests passed.
- 2026-06-20 03:25Z `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/install-workspace-bootstrap-contract.test.ts`: 1 file, 5 tests passed.
- 2026-06-20 03:25Z `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/platform-cloudflare-provisioning-contract.test.ts tests/cloudflare-provisioning-contract.test.ts`: 2 files, 22 tests passed.
- 2026-06-20 03:26Z `bun run typecheck` from `packages/os`: pass (`workspace script syntax checks passed`).
- 2026-06-20 03:29Z full diff against `origin/stream/security` after neutralizing unrelated branch-shape files: scoped to task metadata and OS installer/runtime dependency files.
- 2026-06-20 03:31Z `verify --base origin/stream/security`: pass, publish-valid stamp written. Because HEAD still contained pre-commit branch-shape files, verify selected inherited workspace suites as well; all selected suites passed.
- 2026-06-20 03:27:50 `review.run`: passed — OK
- 2026-06-20 03:30:14 `review.run`: passed — OK
- 2026-06-20 03:31:20 `verify`: passed — OK

## key decisions

- Portless has no usable public package/artifact reference in this repo, and web search did not surface a public install target. The installer treats it as a Consuelo-hosted runtime artifact under `https://install.consuelohq.com/os/bin/portless/darwin-<arch>/portless` with mandatory SHA-256 metadata from `CONSUELO_PORTLESS_SHA256` or `<url>.sha256`.
- Cloudflared uses a pinned official Cloudflare release (`2026.6.1`) with published darwin arm64/amd64 SHA-256 checksums and installs into `~/.consuelo/os/bin/cloudflared` when a reusable binary is absent.
- Bootstrap persists `BUN_BIN`, `PORTLESS_BIN`, and `CLOUDFLARED_BIN` to `~/.consuelo/os/.env`; generated LaunchAgents read that file at runtime.
- `PORTLESS_ALLOW_PATH_LOOKUP=1` is now the explicit opt-in for daemon PATH fallback. Normal public install uses the persisted absolute `PORTLESS_BIN`.
- Cloudflared plist names now derive from the actual launchd label, for example `com.consuelo.os.cloudflared.<connector-id>.plist`, preventing repeated installs from creating label/file drift.

## LaunchAgent command audit

- `scripts/start-consuelo-daemon.sh`: invokes `/bin/bash` from plist and then `BUN_BIN` when configured; fallback PATH remains for legacy/manual use. `BUN_BIN` is installer-managed and persisted by bootstrap.
- `scripts/start-portless-daemon.sh`: invokes `/bin/bash` from plist and then `PORTLESS_BIN`; portless is installer-managed and persisted by bootstrap. PATH fallback requires `PORTLESS_ALLOW_PATH_LOOKUP=1`.
- `scripts/workspace-watchdog.sh`: invokes expected macOS tools `curl`, `lsof`, and `launchctl`; those are classified as expected system tools.
- Generated cloudflared plist: invokes the resolved `CLOUDFLARED_BIN`; cloudflared is installer-managed and persisted by bootstrap. It consumes a scoped tunnel token file and does not require Cloudflare login/admin credentials.
- `scripts/install-system-daemons.sh`: uses expected macOS tools `launchctl`, `plutil`, `lsof`, `curl`, and shell utilities; installs workspace, portless, watchdog, and discovered cloudflared LaunchAgents.
- `scripts/uninstall-system-daemons.sh`: uses expected macOS `launchctl` and shell utilities; removes workspace, portless, watchdog, and any installed/generated dynamic cloudflared LaunchAgents.

## notes for ko

- Public install no longer requires Wrangler, Cloudflare account credentials, account ID, zone ID, ruleset ID, R2 authority, or D1 authority.
- Platform/admin WAF provisioning remains in explicit operator tooling. The dry-run path now returns `planned` before reading `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN`.

## improvements noticed

- The previous SQLite lazy-import fix from the last task was missing because this task started from `main`; it was carried forward here so install-state contract tests can import without top-level `bun:sqlite` resolution. After merging `origin/stream/security`, a duplicate lazy-import block was removed from `sites.ts`.

## issues and recovery

- Bash 3.2 with `set -u` treats empty arrays as unbound in some expansions; daemon scripts now use nounset-safe cloudflared array iteration.
- Merging `origin/stream/security` replayed the old install-provisioning test name into the renamed platform provisioning test. The resolved contract keeps the platform naming and adds the dry-run-before-account-authority assertion there.
- Because the task branch started from `main`, HEAD carried unrelated workspace-agent changes compared to `origin/stream/security`. Those paths were restored to the stream base in the working tree so the PR diff is scoped to OS installer correctness.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## Server Automatically populates this section: files read

- `CODING-STANDARDS.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/start-portless-daemon.sh`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/cloudflare-connector-transport-contract.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- `packages/os/package.json`
- `packages/os/scripts/install.ts`
- `packages/os/tests/safe-temp-cleanup.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`

## Server Automatically populates this section: test selection

- changed files: `.task/security/public-installer-runtime-dependency-correctness/current.json`, `.task/security/public-installer-runtime-dependency-correctness/evidence-log.json`, `.task/security/public-installer-runtime-dependency-correctness/read-log.json`, `.task/security/public-installer-runtime-dependency-correctness/session.json`, `.task/security/public-installer-runtime-dependency-correctness/workpad.md`, `.task/tasks/security/public-installer-runtime-dependency-correctness.json`, `.task/tasks/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands.json`, `.task/tasks/workspace-agents/harden-explore-metadata-handling.json`, `.task/tasks/workspace-agents/keep-office-links-in-same-tab.json`, `.task/tasks/workspace-agents/revert-sites-launcher-link-behavior.json`, `.task/tasks/workspace-agents/workpad-read-log-label.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/current.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/evidence-log.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/read-log.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/session.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/verify.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`, `.task/workspace-agents/harden-explore-metadata-handling/current.json`, `.task/workspace-agents/harden-explore-metadata-handling/evidence-log.json`, `.task/workspace-agents/harden-explore-metadata-handling/read-log.json`, `.task/workspace-agents/harden-explore-metadata-handling/session.json`, `.task/workspace-agents/harden-explore-metadata-handling/verify.json`, `.task/workspace-agents/harden-explore-metadata-handling/workpad.md`, `.task/workspace-agents/keep-office-links-in-same-tab/current.json`, `.task/workspace-agents/keep-office-links-in-same-tab/session.json`, `.task/workspace-agents/keep-office-links-in-same-tab/verify.json`, `.task/workspace-agents/keep-office-links-in-same-tab/workpad.md`, `.task/workspace-agents/revert-sites-launcher-link-behavior/current.json`, `.task/workspace-agents/revert-sites-launcher-link-behavior/session.json`, `.task/workspace-agents/revert-sites-launcher-link-behavior/verify.json`, `.task/workspace-agents/revert-sites-launcher-link-behavior/workpad.md`, `.task/workspace-agents/workpad-read-log-label/current.json`, `.task/workspace-agents/workpad-read-log-label/evidence-log.json`, `.task/workspace-agents/workpad-read-log-label/read-log.json`, `.task/workspace-agents/workpad-read-log-label/session.json`, `.task/workspace-agents/workpad-read-log-label/verify.json`, `.task/workspace-agents/workpad-read-log-label/workpad.md`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/explore.js`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`, `packages/os/scripts/lib/task-meta.js`, `packages/os/scripts/lib/workspace-connector-transport.ts`, `packages/os/scripts/start-portless-daemon.sh`, `packages/os/scripts/uninstall-system-daemons.sh`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/cloudflare-connector-transport-contract.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`, `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`, `packages/os/tests/task-meta.test.js`, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/code-call.ts`, `packages/workspace/scripts/explore.js`, `packages/workspace/scripts/lib/task-meta.js`, `packages/workspace/scripts/lib/task-workpad.js`, `packages/workspace/scripts/office.ts`, `packages/workspace/scripts/task-start.js`, `packages/workspace/tests/code-call.test.ts`, `packages/workspace/tests/office-theme.test.js`, `packages/workspace/tests/task-meta.test.ts`, `packages/workspace/tests/task-workpad.test.js`, `packages/workspace/tests/task-workpad.test.ts`, `packages/workspace/tests/trace-watch.test.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `workspace-task-session`, `trace-watch`, `workspace-audit-docs`
- selected suites: `workspace task session tests`, `trace watch build`, `workspace audit tests`
- run results: `workspace task session tests` passed, `trace watch build` passed, `workspace audit tests` passed
- failed suites: none
