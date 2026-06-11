# repair workspace edge signature contract

## Goal

Fix validated review feedback on the Cloudflare edge router contract in `stream/security` without widening scope.

## Findings verification

- CR-001 is valid in the current PR diff: `workspace-cloudflare-edge-router.ts` signs only inside `if (input.internalSigningSecret)`, so allowed routes can proxy when the secret binding is missing or empty. Because headers are cloned from the inbound request first, caller-provided `x-consuelo-edge-signature` can be preserved when no signing secret is configured.
- CR-002 is valid in the current PR diff: `cloudflare-edge-router.test.ts` only checks that `x-consuelo-edge-signature` matches `/^sha256=/`, so a placeholder signature would satisfy the contract.

## Test-first contract

Behavior under test:
- Allowed routes must fail closed and must not call `fetchUpstream` when the internal signing secret is missing or empty.
- Inbound `x-consuelo-edge-signature` must not be trusted or forwarded as-is.
- Signed routes must proxy with the exact expected HMAC for the fixture secret and canonical request fields.

Existing local pattern to follow:
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

New/changed tests:
- Add a missing/empty-signing-secret fail-closed edge-router contract test.
- Replace placeholder regex assertions with exact HMAC assertions.

Focused red command:

```bash
env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts
```

Expected red failure:
- missing/empty signing secret test fails because current implementation proxies allowed routes unsigned.

## Validation log

Pending.

- 2026-06-11 06:09:20 write: `.task/security/repair-workspace-edge-signature-contract/workpad.md`

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`

## workspace-owned: activity log

- 2026-06-11 06:09:20 fs.write: `.task/security/repair-workspace-edge-signature-contract/workpad.md`
- 2026-06-11 06:11:17 write: `.task/security/repair-workspace-edge-signature-contract/tmp-import.txt`
- 2026-06-11 06:11:17 fs.write: `.task/security/repair-workspace-edge-signature-contract/tmp-import.txt`
- 2026-06-11 06:11:43 patch lines 1-1: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:11:43 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:12:46 write: `.task/security/repair-workspace-edge-signature-contract/a.txt`
- 2026-06-11 06:12:46 fs.write: `.task/security/repair-workspace-edge-signature-contract/a.txt`
- 2026-06-11 06:12:50 patch lines 1-2: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:12:50 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:13:07 write: `.task/security/repair-workspace-edge-signature-contract/b.txt`
- 2026-06-11 06:13:07 fs.write: `.task/security/repair-workspace-edge-signature-contract/b.txt`
- 2026-06-11 06:13:13 patch lines 148-148: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:13:13 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:14:47 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:16:04 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:18:19 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:18:52 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:21:32 fs.patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-11 06:22:53 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-11 06:26:54 fs.trash: `.task/security/repair-workspace-edge-signature-contract/a.txt`
- 2026-06-11 06:27:03 fs.trash: `.task/security/repair-workspace-edge-signature-contract/b.txt`
- 2026-06-11 06:27:04 fs.trash: `.task/security/repair-workspace-edge-signature-contract/c.txt`
- 2026-06-11 06:27:04 fs.trash: `.task/security/repair-workspace-edge-signature-contract/d.txt`
- 2026-06-11 06:27:04 fs.trash: `.task/security/repair-workspace-edge-signature-contract/e.txt`
- 2026-06-11 06:27:04 fs.trash: `.task/security/repair-workspace-edge-signature-contract/tmp-import.txt`

## workspace-owned: files read

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-11 06:19:04 `env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts`: failed exit 1 trace: `trc_60a654134945`
  - output: )[33m;[39m [90m176| [39m [90m177| [39m [34mexpect[39m(response[33m.[39mstatus)[33m.[39m[34mtoBe[39m([34m503[39m)[33m;[39m [90m | [39m [31m^[39m [90m178| [39m [35mconst[39m body [33m=[39m ([35mawait[39m response[33m.[39m[34mjson[39m()) [35mas[39m { [90m179| [39m error[33m:[39m { code[33m:[39m string[33m;[39m message[33m:[39m string }[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-11 06:21:32 patch lines 181-181: `packages/os/tests/cloudflare-edge-router.test.ts`

- 2026-06-11 06:22:53 patch lines 56-56: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

## workspace-owned: validation evidence

- 2026-06-11 06:24:22 `checkFiles`: passed — OK
