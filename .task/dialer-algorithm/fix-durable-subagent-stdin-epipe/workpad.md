# fix durable subagent stdin epipe

branch: `task/dialer-algorithm/fix-durable-subagent-stdin-epipe`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2141/fix-durable-subagent-stdin-epipe
github pr: https://github.com/consuelohq/opensaas/pull/2141
started: 2026-08-16

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

- 2026-08-16 06:41:44 fs.write: `.task/dialer-algorithm/fix-durable-subagent-stdin-epipe/workpad.md`
- 2026-08-16 06:45:44 fs.write: `.task/dialer-algorithm/fix-durable-subagent-stdin-epipe/workpad.md`
- 2026-08-16 06:46:38 fs.write: `.task/dialer-algorithm/fix-durable-subagent-stdin-epipe/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:46:08 `review.run`: passed — OK
- 2026-08-16 06:46:31 `verify`: passed — OK
- 2026-08-16 06:46:53 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- none yet

## Test-first contract

behavior under test: the durable subagent process runner must tolerate a child process closing stdin early; an `EPIPE` while writing/ending stdin must not become an unhandled process error or crash the selected OS durable-subagent test suite.
existing local pattern: the repository already hardens child-process pipe teardown in `packages/os/scripts/lib/code-call/process.ts`; follow that pattern rather than inventing provider-specific logic.
new or changed tests: add a focused regression around `runProcessWithTimeout`/the durable subagent runner using a child that exits before a large stdin payload can be consumed, and preserve the existing durable subagent runtime contracts.
focused red command: run the new early-exit stdin regression in the OS durable-subagent test surface before implementation.
expected red failure: the test process reports an unhandled `write EPIPE` from `packages/os/scripts/lib/subagent/runtime.ts` at `child.stdin.end(...)`, matching GitHub checks `Consuelo / verify` and `Consuelo / workspace contracts`.
no-test waiver: not applicable.

## Acceptance criteria

- [ ] Early child stdin closure cannot emit an unhandled `EPIPE` from the durable subagent runtime.
- [ ] Existing Grok provider-completion validation and executable-discovery isolation remain unchanged and green; no Grok/subagent invocation is used for review or validation.
- [ ] Focused durable-subagent runtime tests reproduce RED before the fix and pass GREEN afterward.
- [ ] Strict review is clean and the task is promoted to `stream/dialer-algorithm` only.

## Plan

1. Inspect the existing child-process pipe hardening pattern and the durable runner tests.
2. Add the deterministic early-exit stdin RED regression.
3. Apply the minimum generic stdin error handling in `runtime.ts`.
4. Run focused durable-subagent tests plus type/static validation and strict review.
5. Push PR #2141 and promote to `stream/dialer-algorithm`; do not merge to `main` from this task.

- 2026-08-16 06:41:44 append: `.task/dialer-algorithm/fix-durable-subagent-stdin-epipe/workpad.md`

## Implementation and validation update

- The first indirect large-instruction regression was rejected because Grok stdin carries only the staged instruction path/guidance, not the file contents; it did not exercise the CI failure and was removed.
- Corrected RED: direct `runSubagentProcess` regression with a local Node child that closes fd 0 immediately and an 8 MiB stdin payload. Before implementation the test failed because the runner was not exported for direct contract testing.
- Implementation: `runSubagentProcess` now owns `child.stdin` errors. Expected `EPIPE` and `ERR_STREAM_DESTROYED` are ignored as normal child-exit pipe teardown; unexpected stdin errors become an explicit failed runner result. Child close/timeout semantics remain authoritative.
- Focused GREEN: EPIPE regression 1/1 passed.
- Durable subagent runtime contracts GREEN: 4 files, 52/52 tests passed using local fake providers only; no live Grok/subagent invocation.
- `packages/os` syntax/typecheck GREEN: `workspace script syntax checks passed`.

### Current status

- [x] Early child stdin closure cannot emit an unhandled `EPIPE` from the durable subagent runtime.
- [x] Existing Grok provider-completion validation and executable-discovery isolation remain unchanged and green; no Grok/subagent invocation was used.
- [x] Focused durable-subagent runtime tests are green after the corrected RED contract.
- [ ] Strict review clean.
- [ ] Push PR #2141 and promote to `stream/dialer-algorithm`.

- 2026-08-16 06:45:44 append: `.task/dialer-algorithm/fix-durable-subagent-stdin-epipe/workpad.md`

## Final validation

- Strict review: 2 implementation files, 0 findings, 0 blockers.
- Canonical verify: passed, publish-valid, zero DB risks/findings.
- Final task implementation files: `packages/os/scripts/lib/subagent/runtime.ts`, `packages/os/tests/subagent-runner-termination.test.ts`.
- [x] Strict review clean.
- [x] Canonical verify publish-valid.
- [ ] Push PR #2141 and promote to `stream/dialer-algorithm`.

## Notes for Ko

- No Grok/subagent reviewer was invoked. All validation used deterministic local child processes/fake providers and repository review/verify.
- This is generic child-process hardening, not a Dialer algorithm change: expected pipe closure after an early child exit is treated as normal teardown, while unexpected stdin errors still fail intentionally.

- 2026-08-16 06:46:38 append: `.task/dialer-algorithm/fix-durable-subagent-stdin-epipe/workpad.md`
