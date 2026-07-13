# add device approval auth hardening contracts

## acceptance criteria

- Add opt-in contract tests for future OS device approval hardening.
- Default package tests remain green.
- Explicit hardening contracts require device public key binding and authenticated approval.

## test-first contract

Focused red command uses the explicit hardening env flag with `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`.

Expected red failures on current implementation:

- device-code start does not require a local device public key
- browser approval accepts an anonymous request
- approved bootstrap lacks a device key thumbprint

Default run should skip these contracts.

- 2026-06-13 13:02:42 write: `.task/os/add-device-approval-auth-hardening-contracts/workpad.md`

## files changed

- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`

## workspace-owned: files changed

- `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`

## workspace-owned: activity log

- 2026-06-13 13:02:42 fs.write: `.task/os/add-device-approval-auth-hardening-contracts/workpad.md`
- 2026-06-13 13:05:37 write: `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- 2026-06-13 13:05:37 fs.write: `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- 2026-06-13 13:07:12 fs.write: `.task/os/add-device-approval-auth-hardening-contracts/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-13 13:06:15 `python3 -c import os, subprocess
os.environ['CONSUELO_RUN_OS_DEVICE_AUTH_HARDENING_CONTRACTS']='1'
raise SystemExit(subprocess.run(['bun','--cwd','packages/os','test','tests/os-device-approval-auth-hardening-contract.test.ts'], env=os.environ).returncode)`: failed exit 1 trace: `trc_f626a93a1a3f`
  - output: 0m171| [39m }))[33m;[39m [90m172| [39m [90m173| [39m [34mexpect[39m(response[33m.[39mstatus)[33m.[39m[34mtoBe[39m([34m403[39m)[33m;[39m [90m | [39m [31m^[39m [90m174| [39m [35mawait[39m [34mexpect[39m(response[33m.[39m[34mjson[39m())[33m.[39mresolves[33m.[39m[34mtoMatchObject[39m({ [90m175| [39m error[33m:[39m [32m'stronger_auth_required'[39m[33m,[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: validation evidence

- 2026-06-13 13:06:55 `checkFiles`: passed — OK
- 2026-06-13 13:10:06 `review.run`: passed — OK
- 2026-06-13 13:10:39 `verify`: passed — OK

## validation evidence

- Default contract run: `trc_626f5e60ae5b` — skipped by default, exit 0.
- Explicit hardening contract run: `trc_f626a93a1a3f` — red as intended, 4 failures defining follow-up work.
- Existing worker + default hardening suite: `trc_879b3d249199` — 1 passed, 4 skipped.
- Syntax check: `trc_a5e5ad935e39` — passed.

## follow-up implementation agent target

Run the opt-in contract with `CONSUELO_RUN_OS_DEVICE_AUTH_HARDENING_CONTRACTS=1`. Implement until the four tests pass without weakening assertions.

- 2026-06-13 13:07:12 append: `.task/os/add-device-approval-auth-hardening-contracts/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/add-device-approval-auth-hardening-contracts/current.json`, `.task/os/add-device-approval-auth-hardening-contracts/evidence-log.json`, `.task/os/add-device-approval-auth-hardening-contracts/read-log.json`, `.task/os/add-device-approval-auth-hardening-contracts/session.json`, `.task/os/add-device-approval-auth-hardening-contracts/workpad.md`, `.task/tasks/os/add-device-approval-auth-hardening-contracts.json`, `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
