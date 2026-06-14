# polish hosted installer workspace prompts

branch: `task/os/polish-hosted-installer-workspace-prompts`
stream: `stream/os`
task pr: https://github.com/consuelohq/opensaas/pull/992
started: 2026-06-13

## acceptance criteria

- Normal local installer asks `enter workspace name`, accepts a slug-like name such as `testing`, and derives `workspaceHost = testing.consuelohq.com` internally.
- Normal local installer does not ask for `Consuelo workspace URL` or `workspace short name`.
- CLI keeps a noninteractive `--workspace-name <name>` path for test/release smoke.
- Artifact storage prompt is removed from normal local onboarding; choosing local mode defaults artifact storage to local artifacts.
- Skills multiselect prompt explicitly says `select skills to enable — Use Space to select skills, press Enter to continue`.
- Device authorization contract uses the GitHub-style URL shape on `consuelohq.com`: browser verification at `/login/device`, device code start at `/login/device/code`, access-token polling at `/login/oauth/access_token`.
- Normal installer still does not pretend OAuth runs before the real website/control-plane endpoints exist.
- Preserve existing local install behavior and reviewability.

## exploration

- `stream.context` shows current `stream/os` includes the local/cloud installer flow task and the hosted installer workpad.
- `packages/workspace/SCRIPTS.md` confirms `os:release-install` is the hosted Worker release surface.
- `packages/os/scripts/install.ts` owns interactive installer prompts and CLI options.
- `packages/os/scripts/onboarding-flow.test.ts` owns source-level UX contracts.
- `packages/os/tests/oauth-device-onboarding-contract.test.ts` owns device authorization endpoint and state contracts.
- `packages/os/scripts/lib/workspace-device-authorization.ts` owns the local device authorization helper.
- GitHub official docs confirm device flow shape: verification URL `/login/device`, device-code start `POST /login/device/code`, token polling `POST /login/oauth/access_token`.

## Test-first contract

Behavior under test:
- The source contract fails if normal onboarding exposes URL/short-name prompts or artifact storage prompt.
- The source contract requires workspace name input, derived `consuelohq.com` host, default local artifacts, and explicit Space/Enter skill guidance.
- Device authorization contract fails if it uses `app.consuelohq.com` or non-GitHub-shaped endpoint paths.

Existing local pattern:
- `packages/os/scripts/onboarding-flow.test.ts` is a source-level UX contract.
- `packages/os/tests/oauth-device-onboarding-contract.test.ts` is an opt-in architecture contract for device authorization.

Focused red command:
```bash
bun --cwd packages/os test scripts/onboarding-flow.test.ts
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/oauth-device-onboarding-contract.test.ts
```

Expected red failure:
- Current installer still contains `Consuelo workspace URL`, `workspace short name`, `choose artifact storage`, and lacks `--workspace-name`.
- Current OAuth contract still points at `https://app.consuelohq.com/os/activate`.

## implementation plan

1. Update source/contract tests to encode the desired installer UX and OAuth endpoint shape.
2. Patch `install.ts` to derive `workspaceSlug` and `workspaceHost` from a single workspace name input; default artifact storage to local.
3. Patch device authorization helper or contract constants for the `consuelohq.com/login/...` endpoint shape.
4. Run focused red/green tests, CLI dry-run smoke, checkFiles, review, verify, push, promote.

- 2026-06-13 05:16:06 write: `.task/os/polish-hosted-installer-workspace-prompts/workpad.md`

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`

## workspace-owned: activity log

- 2026-06-13 05:16:06 fs.write: `.task/os/polish-hosted-installer-workspace-prompts/workpad.md`
- 2026-06-13 05:16:38 write: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-13 05:16:38 fs.write: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-13 05:18:08 write: `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- 2026-06-13 05:18:08 fs.write: `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- 2026-06-13 05:19:01 fs.write: `packages/os/scripts/install.ts`
- 2026-06-13 05:19:02 fs.write: `packages/os/scripts/lib/workspace-device-authorization.ts`
- 2026-06-13 05:19:17 fs.patch: `packages/os/scripts/lib/workspace-device-authorization.ts`
- 2026-06-13 05:20:24 fs.patch: `packages/os/scripts/lib/workspace-device-authorization.ts`
- 2026-06-13 05:25:01 fs.write: `.task/os/polish-hosted-installer-workspace-prompts/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-13 05:18:17 `bun --cwd packages/os test scripts/onboarding-flow.test.ts`: failed exit 1 trace: `trc_e6e6fcf39546`
  - output: for a name and derives slug plus host … [90m 30| [39m [34mexpect[39m(install)[33m.[39m[34mtoContain[39m([32m'workspaceName'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 31| [39m [34mexpect[39m(install)[33m.[39m[34mtoContain[39m([32m'--workspace-name'[39m)[33m;[39m [90m 32| [39m [34mexpect[39m(install)[33m.[39m[34mtoContain[39m([32m"message: 'enter workspace name'"[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-13 05:18:30 `env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/oauth-device-onboarding-contract.test.ts`: failed exit 1 trace: `trc_13627c7388e9`
  - output: test.ts:[2m80:11[22m[39m [90m 78| [39m [90m 79| [39m [35mif[39m (missingExports[33m.[39mlength [33m>[39m [34m0[39m) { [90m 80| [39m [35mthrow[39m [35mnew[39m [33mError[39m( [90m | [39m [31m^[39m [90m 81| [39m `workspace device authorization contract module is missing expor… [90m 82| [39m )[33m;[39m [90m [2m❯[22m tests/oauth-device-onboarding-contract.test.ts:[2m187:7[22m[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: files read

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`

- 2026-06-13 05:20:24 patch lines 94-96: `packages/os/scripts/lib/workspace-device-authorization.ts`

## workspace-owned: TDD green evidence

- 2026-06-13 05:20:33 `bun --cwd packages/os test scripts/onboarding-flow.test.ts`: passed exit 0 trace: `trc_927a64fc732f`
  - output: → tmux: opensaas-os-polish-hosted-installer-workspace-prompts-f211d6bf $ vitest run scripts/onboarding-flow.test.ts
- 2026-06-13 05:20:40 `env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/oauth-device-onboarding-contract.test.ts`: passed exit 0 trace: `trc_fc72e0618cf7`
  - output: → tmux: opensaas-os-polish-hosted-installer-workspace-prompts-f211d6bf $ vitest run tests/oauth-device-onboarding-contract.test.ts

## workspace-owned: validation evidence

- 2026-06-13 05:22:09 `checkFiles`: passed — OK
- 2026-06-13 05:24:08 `review.run`: passed — OK
- 2026-06-13 05:24:23 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/polish-hosted-installer-workspace-prompts/current.json`, `.task/os/polish-hosted-installer-workspace-prompts/evidence-log.json`, `.task/os/polish-hosted-installer-workspace-prompts/read-log.json`, `.task/os/polish-hosted-installer-workspace-prompts/session.json`, `.task/os/polish-hosted-installer-workspace-prompts/workpad.md`, `.task/tasks/os/polish-hosted-installer-workspace-prompts.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/workspace-device-authorization.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final implementation notes

- Replaced normal workspace identity setup with one prompt: `enter workspace name`.
- A name like `testing` now derives `workspaceName = testing`, `workspaceSlug = testing`, and `workspaceHost = testing.consuelohq.com`.
- Added `--workspace-name <name>` for noninteractive smoke tests.
- Kept advanced `--workspace-url` and `--workspace-slug` parsing for compatibility, but removed those from normal help and prompts.
- Removed the artifact storage prompt; local mode defaults to local artifacts.
- Updated skills prompt copy to include Space and Enter instructions.
- Exported Consuelo OAuth-device endpoint constants using the GitHub-style device-flow shape on `consuelohq.com`: `/login/device`, `/login/device/code`, and `/login/oauth/access_token`.
- Device authorization helper defaults to the Consuelo device verification URL when no verification URL is passed.
- Normal installer still does not run fake OAuth before the real website/control-plane endpoint exists.

## validation evidence

- Red onboarding UX contract: `trc_e6e6fcf39546`.
- Red OAuth-device contract: `trc_13627c7388e9`.
- Green onboarding UX contract: `trc_927a64fc732f` — 12 tests passed.
- Green OAuth-device contract: `trc_fc72e0618cf7` — 5 tests passed.
- Green combined focused suite: `trc_6e32084a72a1` — 17 tests passed.
- Installer dry-run with workspace name: `trc_1a9ebaa5f41b` — `--workspace-name testing` derived `testing.consuelohq.com`, kept local artifacts, and produced no activation field.
- Residual-string search: `trc_7dfcd97f1fb6`.
- Changed-file syntax: `trc_4cad88e8685f`.
- Package type/syntax: `trc_44c3590f6ea3`.
- Whitespace diff check: `trc_87df734aec27`.
- Review: `trc_a2da43bed442` — 0 issues.
- Verify: `trc_378c10c1317e` — publish-valid true.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`

## release note

After this lands in `main`, publish the hosted installer with the existing `os:release-install` operator command, then verify hosted install asks for `enter workspace name`, accepts `testing`, and derives `testing.consuelohq.com` internally.

- 2026-06-13 05:25:01 append: `.task/os/polish-hosted-installer-workspace-prompts/workpad.md`
