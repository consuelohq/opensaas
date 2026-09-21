# Make Grok optional after three retries

branch: `task/dialer-algorithm/make-grok-optional-after-three-retries`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2117/make-grok-optional-after-three-retries
github pr: https://github.com/consuelohq/opensaas/pull/2117
started: 2026-08-16

## acceptance criteria

- [x] Grok `run` executes directly without durable runner/owner/exit-marker state.
- [x] Grok retries failed or invalid completions at most three times, capped at 15 seconds per attempt and bounded by the caller timeout.
- [x] A later successful attempt completes normally; three failed attempts return one non-fatal skip outcome.
- [x] Grok detached `start` is unsupported while Codex durable lifecycle remains unchanged.
- [x] Real local CLI probe was attempted three times and then skipped after three timeouts.

## plan

1. Prove the current local Grok behavior with direct `code.call` execution.
2. Move Grok from durable detached execution to the existing direct process boundary.
3. Pin max-three retry/skip behavior with focused tests and preserve Codex durable contracts.
4. Regenerate the tool manifest, review, verify, push, and promote.

## current status

- Implementation complete. Focused Grok tests and the full subagent suite are green; strict review has 0 findings/0 blockers and canonical verify is publish-valid.

## files changed

- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 03:37:31 fs.write: `.task/dialer-algorithm/make-grok-optional-after-three-retries/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:43:53 `checkFiles`: passed — OK
- 2026-08-16 03:44:50 `review.run`: passed — OK
- 2026-08-16 03:46:06 `verify`: failed — COMMAND_FAILED
- 2026-08-16 03:48:58 `verify`: passed — OK

## key decisions

- Grok is optional/run-only and no longer participates in durable detached lifecycle reconciliation.
- Direct Grok attempts are capped at three and 15 seconds each; provider instability becomes one clean skip instead of repeated lifecycle errors.
- Codex remains the durable detached provider.

## notes for ko

- Direct local probe found `/Users/kokayi/.grok/bin/grok`; all three 15-second attempts timed out with no output, validating the requested skip policy.

## improvements noticed

- none yet

## issues and recovery

- The retry test initially appeared to make one attempt because its fake CLI used `cat` while `PATH=''`; a direct diagnostic proved the runtime made all three attempts. The fixture was corrected to use shell built-ins only.
- An optional subagent-schema description edit widened test selection into unrelated lifecycle and package-wide OS suites. It was reverted; the final repair changes only Grok runtime behavior and focused tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/manifests/manifest.config.ts`
- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tools/subagent/manifest.ts`
- `packages/os/tools/subagent/schema.ts`
- `packages/workspace/scripts/verify.js`

## Test-first contract

behavior under test: Grok is a best-effort synchronous provider, not a durable detached provider. `run` invokes the discovered `grok`/`agent` CLI directly, retries unsuccessful execution or invalid completion at most three total attempts inside one bounded caller timeout budget, then returns one non-fatal skipped/unavailable outcome. `start` is unsupported for Grok. Codex durable lifecycle and attachment behavior remain unchanged.
existing local pattern: Pi/OpenCode already use `runSubagentProcess` for direct synchronous provider execution; Grok already has executable discovery, read-only argv construction, and provider completion validation.
new or changed tests: update Grok orchestration contract to assert no detached run state for `run`; add retry tests proving success on a later attempt, exactly three attempts on repeated failure, and non-fatal skip after the third failure; assert `start` reports detached execution unsupported for Grok.
focused red command: `cd packages/os && bun x vitest run tests/subagent-executable-discovery.test.ts tests/subagent-orchestration-contract.test.ts -t "Grok|grok"`
expected red failure: current Grok path advertises detached execution, creates durable run state, and has no three-attempt direct retry/skip behavior.
no-test waiver: not applicable.

## acceptance criteria

- [x] Grok `run` uses direct child-process execution and does not create durable runner/owner/exit marker state.
- [x] Grok attempts execution no more than three times total and does not exceed one caller timeout budget.
- [x] A later successful attempt returns normal completion.
- [x] Three failed/invalid attempts produce one non-fatal skipped/unavailable result so callers can continue without Grok.
- [x] Grok `start` is explicitly unsupported; Codex durable lifecycle remains unchanged.
- [x] Real local CLI probe follows the same policy: three direct failures => skip Grok.

## plan

1. Pin retry/skip behavior with focused Grok tests on the current stream state.
2. Replace only Grok durable execution with the existing direct process helper and bounded retry loop.
3. Run Grok-focused tests, then the full durable-subagent suite to prove Codex lifecycle is untouched.
4. Strict review and canonical verify before promotion.

## current status

- Direct local `code.call` probe found `/Users/kokayi/.grok/bin/grok`; three 15-second direct attempts all timed out with no stdout/stderr and were skipped.
- TDD RED: retry-success, three-fail-skip, and Grok-start-unsupported tests failed against the durable implementation as expected.
- GREEN: Grok-focused tests 12/12; full subagent suite 51/51; `checkFiles` passed; `generate-tool-manifest:check` passed.
- Strict review: 0 findings / 0 blockers.
- Canonical verify: publish-valid with only the focused `os-durable-subagent-runtime` and syntax contracts selected.

## key decisions

- Keep durable detached execution for Codex only. Grok is optional and synchronous because current local Grok can hang without producing lifecycle evidence.
- Retry cap is three attempts total; do not turn provider instability into repeated durable reconciliation errors.
- Use one overall caller timeout budget across retries rather than multiplying timeout by three.

- 2026-08-16 03:37:31 append: `.task/dialer-algorithm/make-grok-optional-after-three-retries/workpad.md`

- 2026-08-16 03:38:16 apply-patch: `packages/os/tests/subagent-executable-discovery.test.ts`
- 2026-08-16 03:38:39 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`
- 2026-08-16 03:38:59 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-16 03:40:05 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-16 03:40:11 apply-patch: `packages/os/tests/subagent-executable-discovery.test.ts`

- 2026-08-16 03:41:30 apply-patch: `packages/os/tests/subagent-executable-discovery.test.ts`
- 2026-08-16 03:41:30 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-16 03:41:47 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`

- 2026-08-16 03:43:23 apply-patch: `packages/os/tests/subagent-executable-discovery.test.ts`
- 2026-08-16 03:43:23 apply-patch: `packages/os/tools/subagent/schema.ts`

- 2026-08-16 03:44:16 apply-patch: `.task/dialer-algorithm/make-grok-optional-after-three-retries/workpad.md`

- 2026-08-16 03:48:06 apply-patch: `packages/os/tools/subagent/schema.ts`

- 2026-08-16 03:50:00 apply-patch: `.task/dialer-algorithm/make-grok-optional-after-three-retries/workpad.md`