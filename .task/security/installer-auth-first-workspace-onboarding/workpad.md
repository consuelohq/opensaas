# installer auth first workspace onboarding

branch: `task/security/installer-auth-first-workspace-onboarding`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1359/installer-auth-first-workspace-onboarding
github pr: https://github.com/consuelohq/opensaas/pull/1359
started: 2026-07-03

## acceptance criteria

- [x] Installer prompts for Consuelo authorization before asking for a workspace name in the interactive local flow.
- [x] Existing approved device login workspace bootstrap data selects the workspace and skips the workspace-name prompt.
- [x] If device login is unavailable or approved login does not include workspace bootstrap data, installer falls back to the current local workspace-name/create flow without weakening security.
- [x] Non-interactive flags keep working for release scripts and dry runs.
- [x] Focused tests cover prompt order, existing-workspace skip, and fallback behavior before production changes ship.

## plan

1. Inspect current installer and device-login/bootstrap contracts.
2. Add failing tests that encode auth-first prompt order and workspace-name fallback behavior.
3. Refactor installer prompt flow to resolve mode, attempt device auth, derive workspace from approved bootstrap when available, then prompt for workspace name only when needed.
4. Run focused OS installer tests and update evidence.
5. Review diff, then push/promote through the task workflow if green.

## current status

- Implemented auth-first installer flow: local interactive setup attempts device authorization before prompting for a workspace name.
- Implemented worker `workspace_required` state for verified accounts that do not yet have an OS workspace.
- Fixed the live app/backend bridge path at `/login/device/approve`: signed Google approval now binds the account first, then waits for device-key-bound workspace selection instead of trying route registration with a missing workspace.
- Preserved legacy/pre-auth workspace fields and fallback local workspace-name flow for unavailable device auth and non-interactive paths.

## files changed

- .task/security/installer-auth-first-workspace-onboarding/workpad.md
- packages/os/cloudflare/os-device-authority/src/index.ts
- packages/os/scripts/install.ts
- packages/os/scripts/lib/workspace-device-authorization.ts
- packages/os/scripts/lib/workspace-device-login-client.ts
- packages/os/scripts/onboarding-flow.test.ts
- packages/os/tests/install-workspace-bootstrap-contract.test.ts
- packages/os/tests/oauth-device-http-client.test.ts
- packages/os/tests/oauth-device-page-contract.test.ts
- packages/os/tests/os-device-authority-worker.test.ts

## workspace-owned: files changed

- none outside the auth-first OS installer/device-authority scope

## workspace-owned: activity log

- 2026-07-03: Started task from `stream/security` on `task/security/installer-auth-first-workspace-onboarding`.
- 2026-07-03: Confirmed old prompt order in `packages/os/scripts/install.ts` and old assertion in `packages/os/scripts/onboarding-flow.test.ts`.
- 2026-07-03: Identified unsafe placeholder risk: worker defaults omitted workspace fields to `workspace.consuelohq.com`; auth-first fix must remove that behavior.
- 2026-07-03: Added optional-workspace device-code start and `/login/device/workspace` selection endpoint guarded by device public key proof.
- 2026-07-03: Added account-workspace reuse so later installs for the same verified account can skip the workspace-name prompt.
- 2026-07-03: Fixed app-backed `/login/device/approve` to return `workspace_required` for auth-first grants instead of failing route setup.

## workspace-owned: validation evidence

- `bun x vitest run tests/os-device-authority-worker.test.ts` -> 15 passed.
- `bun x vitest run tests/oauth-device-http-client.test.ts tests/os-device-authority-worker.test.ts scripts/onboarding-flow.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/oauth-device-onboarding-contract.test.ts tests/oauth-device-page-contract.test.ts tests/os-device-approval-auth-hardening-contract.test.ts tests/installer-onboarding-ui.test.ts scripts/install-tty.test.ts` -> 50 passed, 20 skipped by contract env gates.
- `bun run typecheck` in `packages/os` -> workspace script syntax checks passed.
- `git diff --check` -> clean.
- 2026-07-03 12:07:11 `review.run`: passed — OK
- 2026-07-03 12:07:26 `verify`: failed — COMMAND_FAILED
- 2026-07-03 12:08:48 `verify`: passed — OK

## key decisions

- Keep this task scoped to installer identity/workspace order. Full runtime relocation from legacy `~/.consuelo/os` to `~/.consuelo/runtime/current` remains separate unless needed for this flow.
- Preserve fallback: local install can still continue if device auth is unavailable, but that fallback must happen after trying identity first.
- Never use `workspace.consuelohq.com` as a generic auth-first placeholder; that is a private workspace/MCP surface. Missing workspace in device auth must mean `workspace_required` until a verified account picks or reuses a workspace.

## notes for ko

- This fixes the specific live failure signal: seeing `enter workspace name` immediately after dependencies. After release, the installer should attempt browser authorization first.
- `workspace.consuelohq.com` remains private; this task does not use it as the public OS auth/MCP placeholder.
- Cloudflare security rules were not loosened. The code path keeps the auth endpoints on central OS device-authority and workspace MCP routing behind account/device proof plus route registration.

## improvements noticed

- The current test suite only string-checks the old behavior; add a small pure planning helper if needed so the prompt order is behavior-tested instead of only text-tested.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): authenticate installer before workspace naming" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/security/installer-auth-first-workspace-onboarding/current.json`, `.task/security/installer-auth-first-workspace-onboarding/session.json`, `.task/security/installer-auth-first-workspace-onboarding/workpad.md`, `.task/tasks/security/installer-auth-first-workspace-onboarding.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/workspace-device-authorization.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/oauth-device-http-client.test.ts`, `packages/os/tests/oauth-device-page-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
