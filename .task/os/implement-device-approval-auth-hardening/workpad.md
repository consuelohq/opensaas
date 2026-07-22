# implement device approval auth hardening

## objective

Implement the opt-in OS device approval auth hardening contract without weakening assertions.

## test-first contract

Behavior under test:

- Device-code creation requires a local device public key.
- Browser approval requires an account/session-backed stronger auth method.
- Anonymous approval leaves grants pending.
- Password/username approval is rejected.
- Approved bootstrap is bound to the submitted public key thumbprint.
- Bootstrap responses do not emit username/password/basic-auth credential material.

Existing pattern:

- `packages/os/cloudflare/os-device-authority/src/index.ts` owns the `os.consuelohq.com` GitHub-style device flow.
- `packages/os/scripts/lib/workspace-device-login-client.ts` owns installer HTTP client shape.

Focused red command:

`CONSUELO_RUN_OS_DEVICE_AUTH_HARDENING_CONTRACTS=1 bun --cwd packages/os test tests/os-device-approval-auth-hardening-contract.test.ts`

Expected red failure:

Current implementation accepts missing public key and anonymous approval.

## validation plan

- Opt-in hardening suite.
- Existing default OS tests without env flag.
- Existing worker tests.
- Review and verify.

- 2026-06-13 13:39:41 write: `.task/os/implement-device-approval-auth-hardening/workpad.md`

## files changed

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: activity log

- 2026-06-13 13:39:41 fs.write: `.task/os/implement-device-approval-auth-hardening/workpad.md`
- 2026-06-13 13:41:29 fs.write: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-13 14:36:09 fs.write: `packages/os/scripts/lib/workspace-device-login-client.ts`
- 2026-06-13 14:36:47 fs.write: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-06-13 14:37:25 fs.write: `packages/os/tests/oauth-device-http-client.test.ts`
- 2026-06-13 14:46:27 fs.write: `.task/os/implement-device-approval-auth-hardening/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/package.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: validation evidence

- 2026-06-13 14:43:11 `review.run`: passed — OK
- 2026-06-13 14:45:21 `review.run`: passed — OK
- 2026-06-13 14:45:33 `verify`: passed — OK
- 2026-06-13 14:46:50 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/implement-device-approval-auth-hardening/current.json`, `.task/os/implement-device-approval-auth-hardening/evidence-log.json`, `.task/os/implement-device-approval-auth-hardening/read-log.json`, `.task/os/implement-device-approval-auth-hardening/session.json`, `.task/os/implement-device-approval-auth-hardening/verify.json`, `.task/os/implement-device-approval-auth-hardening/workpad.md`, `.task/tasks/os/implement-device-approval-auth-hardening.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/tests/oauth-device-http-client.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## implementation summary

- Hardened `/login/device/code` to require `device_public_key_jwk` and store a `dpk_` thumbprint.
- Hardened `/login/device/approve` to fail closed without account/session headers and to accept only stronger methods: `google`, `passkey`, `magic_link`, `hardware_key`, `admin_invite`.
- Rejected password/basic-style approval methods with `stronger_auth_required`.
- Kept anonymous approval from mutating pending grants.
- Returned key-bound bootstrap fields while keeping username/password/basic-auth credential material out of approval and bootstrap responses.
- Updated installer HTTP client to generate an Ed25519 public key and send it during device-code creation.
- Updated existing worker and HTTP-client tests to match hardened semantics.

## validation evidence

- Red contract before implementation: `trc_14c83612d5e0` — 4 expected hardening failures.
- Opt-in hardening contract green: `trc_0126002a7d8e` — 4 passed.
- Related default worker/client/onboarding tests green: `trc_c30045c735fd` — 5 passed, 5 skipped.
- Default hardening contract run without env flag: `trc_4aa4b0b53870` — skipped by default, exit 0.
- OS syntax/typecheck: `trc_b7745d6409a7` — passed.
- Review gate: `trc_fcdb579d2742` — 0 blocking issues.
- Verify gate: `trc_6dd1dc360238` — publish-valid.

## package-wide test note

- Full `bun --cwd packages/os test` was attempted (`trc_db6562893e81`) and failed in unrelated existing package areas, including missing Bun module resolution for `bun:test`/`bun:sqlite`, artifact snapshot/content expectations, facade fixture drift, and script parity inventory mismatches. The run also wrote unrelated generated files, which were reverted before verification.

- 2026-06-13 14:46:27 append: `.task/os/implement-device-approval-auth-hardening/workpad.md`
