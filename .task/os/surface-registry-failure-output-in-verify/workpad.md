# surface registry failure output in verify

branch: `task/os/surface-registry-failure-output-in-verify`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1968/surface-registry-failure-output-in-verify
github pr: https://github.com/consuelohq/opensaas/pull/1968
started: 2026-08-14

## acceptance criteria

- [x] Failed registry-selected suites expose their already-captured bounded `outputTail` in human `verify` output instead of only suite name/exit code.
- [x] Diagnostic output remains bounded and does not change pass/fail, selection, review, DB, or stamp semantics.
- [x] JSON verification output remains structurally compatible and continues to carry the full selected-suite packet.
- [x] Focused verification tests, strict review, and full verify pass before stream promotion.

## plan

1. Pin the human-output contract in `packages/workspace/tests/verification.test.js`: registry failure summaries must consume `failure.outputTail` and bound it before printing.
2. Record RED on the current stream implementation.
3. Add the smallest formatting helper in `verify.js` and append bounded diagnostic lines for each failed registry suite.
4. Run focused verification/test-selection contracts, review/verify, merge to `stream/os`, and use the next CI failure log to diagnose the actual Linux lifecycle issue.

## current status

- GitHub generic verify still fails `OS lifecycle update handoff contracts` after package-local OS dependencies were installed; the dedicated OS-contract job remains green.
- `test-selection.js` already captures each failed suite's combined stdout/stderr in `outputTail` (last 4000 characters) and returns it in `selection.failedSuites`.
- `verify.js#createBecause` iterates those failed suites but currently emits only `registry failure: <name> (exit <code>)`, discarding `outputTail` from human CI output. JSON mode already carries the selected-suite packet.
- Implementation now adds a 2000-character bounded registry failure formatter, strips ANSI color sequences, redacts GitHub-style tokens, and appends each diagnostic line to the existing human `because:` section. Verification state and JSON selection packets are unchanged.

## files changed

- `packages/workspace/scripts/verify.js`
- `packages/workspace/tests/verification.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 20:51:01 `review.run`: passed — OK
- 2026-08-14 20:51:15 `verify`: passed — OK

## key decisions

- Surface existing diagnostic evidence rather than bypassing the critical selector or changing lifecycle behavior blindly.
- Keep the human diagnostic bounded to a smaller tail than test-selection's 4000-character capture so one failed suite cannot flood CI logs.
- Do not change JSON schema or verification semantics.

## Test-first contract

- Behavior under test: human verify output includes a bounded failure-output tail for registry-selected suites.
- Existing mechanism: `test-selection.js` stores `failure.outputTail`; `verify.js#createBecause` has direct access to `selection.failedSuites`.
- Focused test: extend the existing `verify human output identifies failed registry suites` source-contract test to require use of `failure.outputTail` and a bounded formatter.
- Expected RED: current `verify.js` contains `selection.failedSuites` and `registry failure:` but never references `failure.outputTail`.
- No-test waiver: none; this is directly testable.

### RED evidence

- Focused `verification.test.js` source contract failed exactly because current `verify.js` did not reference `failure.outputTail` or a bounded registry-output formatter.

### GREEN evidence

- `verification.test.js` + `test-selection.test.js`: 2 files / 36 tests passed.
- Human output now includes bounded `registry output:` lines sourced from the already-captured child-suite `outputTail`; pass/fail logic and structured selection data are untouched.
- Strict review against `origin/stream/os`: 0 issues / 0 blockers.
- Full verify against `origin/stream/os`: passed, `publishValid: true`, DB guard clean.

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

## workspace-owned: files read

- `packages/workspace/scripts/verify.js`
- `packages/workspace/tests/verification.test.js`

- 2026-08-14 20:49:36 apply-patch: `.task/os/surface-registry-failure-output-in-verify/workpad.md`
- 2026-08-14 20:49:45 apply-patch: `packages/workspace/tests/verification.test.js`
- 2026-08-14 20:50:06 apply-patch: `packages/workspace/scripts/verify.js`

- 2026-08-14 20:50:30 apply-patch: `.task/os/surface-registry-failure-output-in-verify/workpad.md`

- 2026-08-14 20:51:27 apply-patch: `.task/os/surface-registry-failure-output-in-verify/workpad.md`