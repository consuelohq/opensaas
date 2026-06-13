# Fix device approval review comments

branch: `task/os/fix-device-approval-review-comments`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1016/fix-device-approval-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1016
started: 2026-06-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: activity log

- 2026-06-13 15:22:31 fs.write: `packages/os/scripts/lib/workspace-device-login-client.ts`
- 2026-06-13 15:23:14 fs.write: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-06-13 15:26:41 fs.write: `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- 2026-06-13 15:34:22 fs.write: `.task/os/fix-device-approval-review-comments/workpad.md`

## workspace-owned: validation evidence

- 2026-06-13 15:28:58 `review.run`: passed — OK
- 2026-06-13 15:32:19 `review.run`: passed — OK
- 2026-06-13 15:33:10 `verify`: passed — OK
- 2026-06-13 15:37:22 `verify`: passed — OK

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

- 2026-06-13 15:22:31 write: `packages/os/scripts/lib/workspace-device-login-client.ts`

- 2026-06-13 15:23:14 write: `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-06-13 15:26:41 write: `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/fix-device-approval-review-comments/current.json`, `.task/os/fix-device-approval-review-comments/session.json`, `.task/os/fix-device-approval-review-comments/verify.json`, `.task/os/fix-device-approval-review-comments/workpad.md`, `.task/os/implement-device-approval-auth-hardening/current.json`, `.task/os/implement-device-approval-auth-hardening/evidence-log.json`, `.task/os/implement-device-approval-auth-hardening/read-log.json`, `.task/os/implement-device-approval-auth-hardening/session.json`, `.task/os/implement-device-approval-auth-hardening/verify.json`, `.task/os/implement-device-approval-auth-hardening/workpad.md`, `.task/tasks/os/fix-device-approval-review-comments.json`, `.task/tasks/os/implement-device-approval-auth-hardening.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/tests/oauth-device-http-client.test.ts`, `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## review-comment fix summary

- Verified both PR #1013 review findings were valid.
- Fixed CR-001 by making `/login/device/approve` ignore raw `x-consuelo-account-*` headers and require a signed `x-consuelo-account-assertion` verified with `OS_DEVICE_AUTH_ASSERTION_SECRET`.
- Added regression coverage that forged allowed account headers cannot approve and the grant remains pending.
- Fixed CR-002 by retaining install-session device key material in the client and adding a signed device-key proof to `/login/oauth/access_token` polling.
- Updated the authority to verify proof payload/signature against the stored device public key before returning bootstrap material.
- Added regression coverage that an approved device code cannot be redeemed without matching proof and that valid proof succeeds.

## validation evidence

- Focused authority/client/onboarding tests: `trc_036bde2732ec` — 5 passed, 5 skipped.
- Opt-in hardening contract: `trc_507a6efb37e1` — 5 passed.
- Default hardening contract run: `trc_afa913dc3b2a` — skipped by default, exit 0.
- OS syntax/typecheck: `trc_54f3e495cf16` — passed.
- Review gate: `trc_9c3165583718` — 0 blocking issues.
- Verify gate: `trc_3e62e8c26ccb` — publish-valid.

- 2026-06-13 15:34:22 append: `.task/os/fix-device-approval-review-comments/workpad.md`
