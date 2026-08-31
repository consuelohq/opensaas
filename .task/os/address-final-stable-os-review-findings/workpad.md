# Address final stable OS review findings

branch: `task/os/address-final-stable-os-review-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2215/address-final-stable-os-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2215
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 14:40:11 fs.write: `.task/os/address-final-stable-os-review-findings/workpad.md`
- 2026-08-26 14:43:33 fs.write: `.task/os/address-final-stable-os-review-findings/workpad.md`
- 2026-08-26 14:47:04 fs.write: `.task/os/address-final-stable-os-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 14:47:16 `review.run`: passed — OK

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

## Test-first contract

behavior under test: Google CLI accepts --quiet without normal output; stored OAuth config refreshes after authority credential rotation; managed gog abort timeout remains active through response body consumption; changed macOS LaunchAgent plists are reloaded before kickstart.
existing local pattern: package OS Bun tests colocated under packages/os/tests and lifecycle unit tests with dependency injection/mocked launchctl.
new or changed tests: focused regression coverage for all four behaviors.
focused red command: bun test <four focused test files selected after discovery>
expected red failure: current implementation rejects --quiet, trusts stale credentials, clears the abort timer before body consumption, and kickstarts an already-loaded stale launchd definition.
no-test waiver: not applicable.

- 2026-08-26 14:40:11 append: `.task/os/address-final-stable-os-review-findings/workpad.md`

## Focused red evidence

command: `bun test packages/os/tests/google-cli.test.ts packages/os/tests/google-workspace-auth.test.ts packages/os/tests/managed-gog.test.ts packages/os/tests/lifecycle-restart-contract.test.ts`
result: 31 passed, 4 failed exactly at the four intended contracts: quiet output emitted, configured OAuth returned before fetching rotated authority credentials, response-body timeout was cleared before arrayBuffer, and loaded sidecar skipped bootout/bootstrap.
trace: trc_c9e05262b65b

- 2026-08-26 14:43:33 append: `.task/os/address-final-stable-os-review-findings/workpad.md`

## Green evidence

focused regression suite: 36 passed, 0 failed (`trc_ed0c03f5b7f3`).
Nx package syntax/typecheck: `consuelo-os:typecheck` passed with cache bypassed (`trc_ff47ac63b43e`).
implementation: quiet is parsed and suppresses normal/error envelopes; authority credentials are reconciled by a non-secret SHA-256 digest and refreshed on change; the abort timer spans fetch plus body read; loaded non-ingress LaunchAgents are booted out and bootstrapped from the refreshed plist before kickstart, while the invoking watchdog remains excluded.

- 2026-08-26 14:47:04 append: `.task/os/address-final-stable-os-review-findings/workpad.md`
