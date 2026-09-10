# fix PR 2310 current-head timeout and security scope reviews

branch: `task/os/fix-pr-2310-current-head-timeout-and-security-scope-reviews`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2331/fix-pr-2310-current-head-timeout-and-security-scope-reviews
github pr: https://github.com/consuelohq/opensaas/pull/2331
started: 2026-08-31

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

- 2026-08-31 19:53:29 fs.write: `.task/os/fix-pr-2310-current-head-timeout-and-security-scope-reviews/workpad.md`
- 2026-08-31 20:01:10 fs.write: `.task/os/fix-pr-2310-current-head-timeout-and-security-scope-reviews/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 20:00:46 `review.run`: passed — OK

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

behavior under test: task guidance uses the OS facade's millisecond timeout contract, and security.scan remains behind an execution-capable OAuth scope rather than tool:*:read.
existing local pattern: source/fixture parity tests cover task guidance; tool-scope authorization has focused operation classification tests.
new or changed tests: add/adjust focused assertions for timeout units and security.scan scope before production edits.
focused red command: run the smallest matching packages/os test files after locating their exact names.
expected red failure: existing guidance contains 600/300/120 timeout literals and security.scan is classified as tool:*:read.
no-test waiver: not applicable.

- 2026-08-31 19:53:29 append: `.task/os/fix-pr-2310-current-head-timeout-and-security-scope-reviews/workpad.md`

- 2026-08-31 19:57:43 apply-patch: `packages/os/tests/session-integration-guidance.test.ts`
- 2026-08-31 19:57:43 apply-patch: `packages/os/tests/mcp-central-proxy-scope.test.ts`
- 2026-08-31 19:58:43 apply-patch: `packages/os/scripts/lib/tool-scope-authorization.ts`
- 2026-08-31 19:58:43 apply-patch: `packages/os/tests/mcp-central-proxy-scope.test.ts`

## Current result

- Red: `bun --cwd packages/os test tests/session-integration-guidance.test.ts tests/mcp-central-proxy-scope.test.ts` failed exactly because short timeout literals remained and `security.scan` resolved to `tool:security.scan:read` (`trc_ffc7e21f537e`).
- Implementation: standardized task skill and migration fixture timeout examples to millisecond literals; added an explicit central execution-only facade set and routed `security.scan` to `mcp:call`.
- Green: 22 focused tests across session guidance, central proxy scope, authorization, and skill migration (`trc_985a95247b12`).
- Syntax/type gate: `bun run --cwd packages/os typecheck` passed (`trc_c96cf9887183`).
- Diff inspected with `git.diff` (`trc_014ccc3f422c`).
- Strict review against exact base `9adb2e12a92ad4e50949b07ef0b0059a87a93843`: 0 blocking issues (`trc_a0333b5bfc62`).
- Files changed: task skill + mirrored fixture; tool scope authorization; central proxy and guidance regressions.
- Nonblocking review note: public bundled-skill docs mapping did not change; this is internal execution-contract correction and not needed for the canary hotfix.

- 2026-08-31 20:01:10 append: `.task/os/fix-pr-2310-current-head-timeout-and-security-scope-reviews/workpad.md`
