# fail closed on pending foreground verify

branch: `task/tooling-reliability/fail-closed-on-pending-foreground-verify`
stream: `stream/tooling-reliability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2598/fail-closed-on-pending-foreground-verify
github pr: https://github.com/consuelohq/opensaas/pull/2598
started: 2026-09-26

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

- 2026-09-26 18:18:11 fs.write: `.task/tooling-reliability/fail-closed-on-pending-foreground-verify/workpad.md`
- 2026-09-26 18:22:08 fs.write: `.task/tooling-reliability/fail-closed-on-pending-foreground-verify/workpad.md`
- 2026-09-26 18:22:38 fs.write: `.task/tooling-reliability/fail-closed-on-pending-foreground-verify/workpad.md`

## workspace-owned: validation evidence

- 2026-09-26 18:22:22 `review.run`: passed — OK

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
bun run task:push -- --message "type(tooling-reliability): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- An already-active identical verify run must never be classified as a successful completed gate by synchronous internal callers.
- `confirm --verify` and `stream.sync` must fail closed when verify returns `VERIFY_PENDING` / `pending: true`, even if the verify process exits 0.
- Agent-facing verify remains non-blocking; this fix must not reintroduce long polling inside the normal verify tool path.

existing local pattern:
- `verify --foreground` can still return an existing run as `mode: pending`, emitting `VERIFY_PENDING` with exit 0.
- Both confirm copies currently compute pass as `result.passed && data !== null && data.passed !== false`.
- Both stream-sync copies currently classify the verify subprocess solely from exit code 0.

new or changed tests:
- Extend workspace verification contracts so both confirm copies reject `pending: true` / `status: VERIFY_PENDING`.
- Extend stream-sync runtime contracts so a zero-exit `VERIFY_PENDING` payload does not allow the stream push gate to pass.
- Preserve existing non-blocking verify-run behavior tests.

focused red command:
`bun x vitest run packages/workspace/tests/verification.test.js && bun test packages/workspace/tests/stream-sync-node-modules.test.js`

expected red failure:
- New source/runtime assertions fail because current callers accept exit-0 pending verify output as pass.

no-test waiver: not applicable.

- 2026-09-26 18:18:11 append: `.task/tooling-reliability/fail-closed-on-pending-foreground-verify/workpad.md`

## Implementation / validation

- Focused RED reproduced the Codex P1: synchronous pending verification was still accepted by callers because `VERIFY_PENDING` exited 0.
- Both verify copies now keep normal agent pending non-blocking, but `--foreground` pending exits nonzero.
- Both confirm copies now require an explicit completed `passed: true` payload and reject `pending: true` / `VERIFY_PENDING`.
- Both stream-sync copies now require a completed `passed: true` verify payload before push; pending/failure yields `checks_failed`, no push, and a nonzero stream-sync exit.
- Added a runtime stream-sync fixture proving an exit-0 pending verify payload cannot push the stream and leaves the remote stream branch unchanged.
- Updated the successful stream-sync fixture to model a completed verify payload explicitly.
- Focused and broader GREEN: 113 verification/run-state/selection tests passed; 5 stream-sync tests passed; syntax checks and `git diff --check` passed.
- Test selection maps these changes to the focused publish-gate and stream-sync suites; the broad OS package rule is matched as fallback metadata but is not selected.

- 2026-09-26 18:22:08 append: `.task/tooling-reliability/fail-closed-on-pending-foreground-verify/workpad.md`
- Strict review against `origin/stream/tooling-reliability` passed with 0 blockers/findings.
- Full foreground verify completed in 7.25s, selected only the 2 focused publish/stream-sync suites, passed DB/review gates, and wrote a publish-valid stamp.

- 2026-09-26 18:22:38 append: `.task/tooling-reliability/fail-closed-on-pending-foreground-verify/workpad.md`
