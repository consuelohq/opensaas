# address cloudflare edge provisioning nits

## Goal

Verify nitpick findings against current stream code, fix only still-valid items, keep scope small, and validate.

## Verification

- Router offline connector comment: valid. Added a short fail-closed/offline 503 comment above the redundant connector-status guard.
- Router edge metadata sanitization: valid. Build proxy now strips inbound Consuelo metadata before setting trusted values and computing the edge signature.
- Provisioning edge hostname config: valid. Added optional `edgeHostname`, defaulting to the current production hostname.
- Provisioning DNS label validation: valid. Workspace slug and connector label now enforce 1-63 chars, no leading/trailing hyphen, `[a-z0-9-]` only.
- Provisioning local service URL config: valid. Added optional `localServiceUrl`, defaulting to `http://localhost:3000`.
- Edge-router `beforeEach`: skipped. Current tests use per-test arrays and inline stubs, not shared Vitest mocks; `vi.clearAllMocks()` would be a no-op import.

## Test-first contract

Behavior under test:
- Service-upstream routes do not forward caller-provided connector metadata.
- Provisioning apply uses caller-provided edge hostname for workspace DNS CNAME content.
- Provisioning apply uses caller-provided local service URL, defaulting only when omitted.
- Provisioning rejects labels with leading/trailing hyphen or length greater than 63.

## Files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`

## Validation

- Red opt-in router + provisioning contracts failed as expected: 3 failed / 8 passed. Trace `trc_cdd6d316e41a`.
- Opt-in router + provisioning contracts passed: 2 files / 11 tests. Trace `trc_ff8fa37325ae`.
- Opt-in full Cloudflare contract trio passed: 3 files / 16 tests. Trace `trc_54017d7ef49e`.
- Default-gated targeted contracts skipped 16 tests. Trace `trc_22ad1f9f2e5c`.
- Syntax check for edge router passed. Trace `trc_274a15e84cc1`.
- Diff inspection: 4 files changed, 89 insertions, 8 deletions. Trace `trc_ea39ce82279a` and detailed diff trace `trc_3d784ac4bf42`.
- Review gate passed with 0 issues. Trace `trc_afdf4bb76ab7`.
- Verify gate passed and wrote publish-valid stamp. Trace `trc_061409a64fd5`.

- 2026-06-11 07:06:24 write: `.task/security/address-cloudflare-edge-provisioning-nits/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`

## workspace-owned: activity log

- 2026-06-11 07:06:24 fs.write: `.task/security/address-cloudflare-edge-provisioning-nits/workpad.md`

## workspace-owned: validation evidence

- 2026-06-11 07:07:13 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/address-cloudflare-edge-provisioning-nits/current.json`, `.task/security/address-cloudflare-edge-provisioning-nits/evidence-log.json`, `.task/security/address-cloudflare-edge-provisioning-nits/read-log.json`, `.task/security/address-cloudflare-edge-provisioning-nits/session.json`, `.task/security/address-cloudflare-edge-provisioning-nits/verify.json`, `.task/security/address-cloudflare-edge-provisioning-nits/workpad.md`, `.task/tasks/security/address-cloudflare-edge-provisioning-nits.json`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
