# Handle browser containment and noninteractive approvals

branch: `task/os-computer-use/handle-browser-containment-and-noninteractive-approvals`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2817
started: 2026-11-18

## acceptance criteria

- [x] Block domain-allowlisted persistent browser actions before creating local state.
- [x] Allow status and close with no browser profile launch, while preserving action confirmation requirements.
- [x] Use structured approval results for noninteractive OS calls.

## plan

1. Reproduce the three policy regressions, implement provider preflight and scoped close, then validate and publish.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- Three focused tests failed before the change. The OS adapter now reports the incompatible persistent profile explicitly and preserves confirmation requirements across a non-TTY provider connection.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-computer-use): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: fail closed before opening a persistent browser under an incompatible domain allowlist; keep structured confirmation metadata on the piped transport even when interactive prompt mode is set on the node.
existing local pattern: operator policy allowlist, typed facade outcomes and named-session close.
new or changed tests: computer-use.test.ts preflight, mode flags, safe close and provider environment.
focused red command: cd packages/os && bun x vitest run tests/computer-use.test.ts
expected red failure: confirmation-interactive env is passed to a non-TTY and allowlists reach the native runner with an incompatible profile.
no-test waiver: not applicable.

- 2026-11-18 22:58:07 append: `.task/os-computer-use/handle-browser-containment-and-noninteractive-approvals/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 22:58:07 fs.write: `.task/os-computer-use/handle-browser-containment-and-noninteractive-approvals/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 22:59:22 `review.run`: failed — COMMAND_FAILED
- 2026-11-18 22:59:48 `review.run`: passed — OK
- 2026-11-18 23:00:29 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
