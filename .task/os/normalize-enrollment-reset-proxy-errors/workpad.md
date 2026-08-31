# Normalize enrollment reset proxy errors

branch: `task/os/normalize-enrollment-reset-proxy-errors`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2198/normalize-enrollment-reset-proxy-errors
github pr: https://github.com/consuelohq/opensaas/pull/2198
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

- 2026-08-26 04:53:58 fs.write: `.task/os/normalize-enrollment-reset-proxy-errors/workpad.md`
- 2026-08-26 04:58:26 fs.write: `.task/os/normalize-enrollment-reset-proxy-errors/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 04:58:12 `review.run`: passed — OK

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

behavior under test: workspace-edge normalizes Device Authority legacy flat enrollment-reset failures into the repository-standard nested error contract while preserving upstream status and cache/security response headers.
existing local pattern: internal dashboard integration tests exercise the owner-only reset proxy end to end, and nearby workspace-edge handlers emit { error: { code, message } }.
new or changed tests: add a focused proxy regression for an upstream 409 flat error and assert the nested code/message, status preservation, and no-store/nosniff headers.
focused red command: bun test packages/os/tests/internal-dashboard-integration.test.ts --test-name-pattern "normalizes enrollment reset authority errors"
expected red failure: response.error is currently a string because the proxy forwards the upstream body unchanged, so nested code/message assertions fail.
no-test waiver: not applicable.

- 2026-08-26 04:53:58 append: `.task/os/normalize-enrollment-reset-proxy-errors/workpad.md`

## Implementation and validation evidence

- red: `bun test packages/os/tests/internal-dashboard-integration.test.ts --test-name-pattern "normalize authority errors"` failed because the proxy returned `{ error: "enrollment_owner_not_found" }` instead of the nested API contract.
- implementation: normalize legacy flat authority errors at Workspace Edge, preserve upstream status, return no-store/nosniff JSON, keep already-nested errors intact, and retain success bodies unchanged.
- green focused: 1 passed, 8 filtered, 21 assertions.
- green security/OAuth slice: Vitest 16 files, 160 tests passed, including dashboard, Device Authority, OAuth, approval hardening, release-security, and security scan contracts.
- syntax/type: `bun run typecheck` passed; `git diff --check` passed.
- review: `review.run --base origin/stream/os --no-tests` inspected 2 files with 0 issues, 0 blockers, and 0 documentation opportunities.
- unrelated runner note: direct `bun test` is not the package test target and lacks Vitest's `vi.unstubAllGlobals`; the same files pass under the declared `vitest run` package script.

- 2026-08-26 04:58:26 append: `.task/os/normalize-enrollment-reset-proxy-errors/workpad.md`
