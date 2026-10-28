# installer diagnostics and node foundation

branch: `task/security/installer-diagnostics-and-node-foundation`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1361/installer-diagnostics-and-node-foundation
github pr: https://github.com/consuelohq/opensaas/pull/1361
started: 2026-07-03

## acceptance criteria

- [x] Temporary development diagnostics are enabled only by `CONSUELO_OS_DEV_DIAGNOSTICS=1` in the bootstrap pipe form: `curl -fsSL https://install.consuelohq.com/os | CONSUELO_OS_DEV_DIAGNOSTICS=1 bash`.
- [x] Normal `curl` install remains generic for all users and has no Ko-machine or testing URL assumptions.
- [x] Dev diagnostics are easy to remove before launch: one clear module/import boundary, one env flag, no product-path dependency on diagnostics.
- [x] Diagnostics write local redacted reports with bootstrap logs, step transitions, prompt decisions, environment summary, versions, paths, HTTP statuses, and worker states.
- [x] No diagnostic upload or background telemetry is enabled in this pass; reports stay local and redacted by default.
- [x] PTY installer harness proves hosted Clack runs under a real pseudo-terminal; source contracts catch the workspace-required prompt progression and daemon serialization regression before release.
- [x] Prompt skip bug is fixed: after Google approval and new workspace name, the installer serializes the interactive daemon decision and still has skills, agents, service, and health onboarding wired.
- [x] Flattened home foundation is introduced for new installs: `~/.consuelo/consuelo.yaml`, `runtime/`, `node/`, and `workspaces/<id>/shared/workspace.yaml`.
- [x] Legacy `~/.consuelo/os` installs remain readable/migratable without breaking existing users.
- [x] Node registry V1 exists: first install creates home node, later installs for same account register or reconnect nodes instead of asking for workspace name again.
- [x] Installer decision tree checks account/workspace/node state after auth: create workspace, join node, reconnect same node, or future replacement state.
- [x] Central MCP product URL remains `https://os.consuelohq.com/mcp`; `workspace.consuelohq.com` is never used as a generic placeholder.
- [x] Security rules and tests preserve narrow public auth/discovery endpoints and protected MCP behavior; no broad Cloudflare loosening.
- [ ] Release/live reinstall smoke still needs to happen after this branch is merged/released.

## plan

0. Dev-only diagnostics and installer harness: add local report writer, optional upload boundary, and PTY test harness for prompt progression.
1. Reproduce prompt skip with a failing PTY or harness test and fix it before broader node work.
2. Add flattened path/config foundation with typed YAML parsing and legacy compatibility.
3. Add account/workspace/node decision model and worker/client contracts for node registration/reconnect.
4. Wire installer to login first, then create/join/reconnect workspace node without asking workspace name unnecessarily.
5. Keep central MCP and Cloudflare/security behavior aligned with product URLs and protected routing.
6. Run focused and broader validation, update workpad, then push/promote/release when green.

## test-first contract

Behavior under test:
- First install with auth-first approval and `workspace_required` must continue through skills, agents, service, and health after the workspace name prompt.
- Dev diagnostics enabled by `CONSUELO_OS_DEV_DIAGNOSTICS=1` must record redacted step/prompt events and must be absent in normal installs.
- New install path must write flattened `~/.consuelo` config while preserving legacy `~/.consuelo/os` compatibility.
- Worker/device authority must distinguish first workspace install, existing workspace join, and same-node reconnect without using machine-specific hardcoded URLs.

Existing local patterns to follow:
- `packages/os/scripts/onboarding-flow.test.ts` for installer source contracts.
- `packages/os/tests/installer-onboarding-ui.test.ts` and `packages/os/scripts/install-tty.test.ts` for prompt/TTY behavior.
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts` for bootstrap/config contracts.
- `packages/os/tests/os-device-authority-worker.test.ts` and `packages/os/tests/oauth-device-http-client.test.ts` for device authority/client behavior.
- `packages/os/scripts/lib/consuelo-home.ts` and `packages/os/tests/consuelo-home-config.test.ts` for home/path config patterns.

New or changed tests:
- Add PTY/harness coverage for full onboarding after workspace-required auth approval.
- Add diagnostics tests for redaction, local report shape, and flag isolation.
- Add flattened path/config tests for new install and legacy compatibility.
- Add node registry worker/client tests for home-node create, join, and reconnect.
- Add security/URL tests preventing `workspace.consuelohq.com` placeholder regressions.

Focused red command:
- Start with `bun x vitest run scripts/install-tty.test.ts scripts/onboarding-flow.test.ts tests/install-workspace-bootstrap-contract.test.ts` after adding the failing prompt progression/diagnostics/path tests.

Expected red failure:
- Current installer/harness will not prove step progression after `workspace_required`; current paths still complete under legacy `~/.consuelo/os`; node registry contracts are absent.

No-test waiver:
- None. This is behavior and install infrastructure; use TDD.

## files changed

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install-tty.test.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/scripts/lib/install-diagnostics.ts`
- `packages/os/tests/install-diagnostics.test.ts`


## key decisions

- Diagnostics may be Ko/dev-machine tailored only when explicitly enabled by `CONSUELO_OS_DEV_DIAGNOSTICS=1` and must be easy to remove before launch.
- Normal install must stay generic and user-ready; no hardcoded test machine URLs, workspace hosts, or Ko-specific assumptions.
- Do not start with containers for the macOS installer bug; use a Mac PTY harness because the failure includes `script`, prompts, LaunchAgents, clipboard/open URL, and local HOME behavior.
- No background telemetry in normal installs. Temporary dev upload is opt-in through the diagnostics flag and redacted by default.

## notes for Ko

- The immediate known bug is the installer appeared to skip from workspace name to completion after Google approval. We need a reproducible harness before patching blindly.
- Flattening did not ship in the prior auth-first branch; this task must make it explicit and tested.

## validation evidence

- Green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run scripts/onboarding-flow.test.ts tests/install-diagnostics.test.ts tests/install-state.test.ts tests/os-device-authority-worker.test.ts tests/cloudflare-provisioning-contract.test.ts` from `packages/os`.
  - 5 files passed, 73 tests passed.
- Green: `bun test scripts/install-tty.test.ts` from `packages/os`.
  - 9 tests passed, including the macOS PTY `--check-tty` smoke.
- Green: `bun run typecheck` from `packages/os`.
  - Workspace script syntax checks passed.
- Green: focused device-authority suite after central MCP additions.
  - `bun x vitest run tests/os-device-authority-worker.test.ts` passed 20 tests.
- Green: `review.run --base HEAD` through the workspace facade.
  - 0 blocking issues, 0 pre-existing issues in the scoped review summary.
- Green: `verify --base HEAD` through the workspace facade.
  - publish-valid stamp written to `.task/security/installer-diagnostics-and-node-foundation/verify.json`.
- Earlier broad `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test` still failed in unrelated existing suites and mutated a facade snapshot; the snapshot was restored to `HEAD`. Failing suites seen there: task-hook workflow/manifest/dispatcher, media package boundaries, os-raw-steering, and trace-sites live endpoints.

## issues and recovery

- Full package test run has unrelated pre-existing failures outside this branch's touched installer/device/security path. Do not use that broad failure as branch-specific evidence until those suites are repaired.
- No background telemetry was added. Temporary diagnostics are local-only under `CONSUELO_OS_DEV_DIAGNOSTICS=1` and can be removed by deleting `install-diagnostics.ts`, its import, and bootstrap dev-log helpers.
- Central `os.consuelohq.com/mcp` is now a real protected route in device authority: OAuth resource stays central, verified Google account resolves the workspace internally, and requests proxy through the signed connector route from D1.


## Red Test Evidence

- `bun x vitest run scripts/onboarding-flow.test.ts tests/install-diagnostics.test.ts` initially failed because `scripts/lib/install-diagnostics.ts` did not exist.
- The same red run caught the daemon prompt serialization bug: `install.ts` serialized `options.installDaemons` instead of the interactive `installDaemons` decision.
- The same red run caught the hosted bootstrap still defaulting to `~/.consuelo/os` instead of flattened `~/.consuelo`.

- 2026-07-03 19:09:40 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- 2026-07-03 19:09:59 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- 2026-07-03 19:10:21 apply-patch: `packages/os/scripts/install-tty.test.ts`
- 2026-07-03 19:12:16 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`

## workspace-owned: validation evidence

- Green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run scripts/onboarding-flow.test.ts tests/install-diagnostics.test.ts tests/install-state.test.ts tests/os-device-authority-worker.test.ts tests/cloudflare-provisioning-contract.test.ts` from `packages/os`.
  - 5 files passed, 73 tests passed.
- Green: `bun test scripts/install-tty.test.ts` from `packages/os`.
  - 9 tests passed, including the macOS PTY `--check-tty` smoke.
- Green: `bun run typecheck` from `packages/os`.
  - Workspace script syntax checks passed.
- Green: focused device-authority suite after central MCP additions.
  - `bun x vitest run tests/os-device-authority-worker.test.ts` passed 20 tests.
- Earlier broad `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test` still failed in unrelated existing suites and mutated a facade snapshot; the snapshot was restored to `HEAD`. Failing suites seen there: task-hook workflow/manifest/dispatcher, media package boundaries, os-raw-steering, and trace-sites live endpoints.
- 2026-07-03 19:31:20 `review.run`: passed — OK
- 2026-07-03 19:33:08 `review.run`: passed — OK
- 2026-07-03 19:34:01 `verify`: failed — COMMAND_FAILED
- 2026-07-03 19:35:14 `verify`: passed — OK
- 2026-07-03 19:35:38 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/installer-diagnostics-and-node-foundation/current.json`, `.task/security/installer-diagnostics-and-node-foundation/session.json`, `.task/security/installer-diagnostics-and-node-foundation/verify.json`, `.task/security/installer-diagnostics-and-node-foundation/workpad.md`, `.task/tasks/security/installer-diagnostics-and-node-foundation.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install-tty.test.ts`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/consuelo-home.ts`, `packages/os/scripts/lib/install-diagnostics.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/scripts/lib/workspace-device-authorization.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/install-diagnostics.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
