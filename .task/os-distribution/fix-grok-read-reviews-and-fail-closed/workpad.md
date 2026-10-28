# fix grok read reviews and fail closed

branch: `task/os-distribution/fix-grok-read-reviews-and-fail-closed`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1554/fix-grok-read-reviews-and-fail-closed
github pr: https://github.com/consuelohq/opensaas/pull/1554
started: 2026-07-22

## acceptance criteria

- [x] Preserve workspace MCP reads under Grok read policy while denying built-in file mutation and shell execution.
- [x] Keep the run bounded and disable Grok memory and nested subagents.
- [x] Treat cancelled, incomplete, and empty Grok output as a failed subagent run even when the CLI exits zero.
- [x] Add focused regression coverage before implementation and retain the red/green evidence.
- [x] Update the tracked foundation plan and validator to describe the executable policy.
- [x] Prove the wrapper against the live local workspace MCP.
- [x] Run workspace review and verify.
- [x] Complete the independent Grok review and fix the still-valid documentation contract finding.
- [ ] Publish through the stream PR.

## plan

1. Characterize the live Grok CLI behavior under plan and auto permission modes.
2. Add red tests for the executable read policy and fail-closed terminal-state handling.
3. Implement the smallest wrapper and plan updates.
4. Run focused tests, plan validation, live MCP smoke, review, and verify.
5. Promote the task to `stream/os-distribution`, complete the independent review on GitHub, and merge the stream to `main` when green.

## current status

- Focused implementation, live workspace MCP smoke, workspace review, verify, and independent Grok review are complete. Publish remains.

## files changed

- `packages/os/plans/consuelo-os-foundation/dispatch.md`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/27-grok-review-pipeline.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`


## workspace-owned: files changed

- Same as `files changed`.

## workspace-owned: activity log

- TDD red: 4 focused failures proved read policy still emitted `--permission-mode plan`, lacked mutation denies, and accepted cancelled/empty zero-exit output.

## workspace-owned: validation evidence

- TDD green: `bun x vitest run packages/os/tests/subagent-executable-discovery.test.ts` -> 8 passed.
- Plan contract: `bun packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts` -> every coverage and structural check passed.
- Live Grok 4.5 wrapper smoke: `trc_6fa03cd9f45b` completed through the local workspace MCP and returned `{"ok":true,"firstHeading":"System Prompt"}` under auto mode with built-in edit/write/shell denies.
- `git diff --check` passed.
- `bun run review -- --base origin/stream/os-distribution` passed static rules, ESLint, typecheck, specification compliance, and test checks.
- `bun run verify -- --base origin/stream/os-distribution` passed and wrote a publish-valid stamp.

## key decisions

- Grok `plan` mode is not a read-only execution mode: it cancels the mandatory `workspace.get_steering` MCP call.
- Grok `auto` mode permits the safe workspace MCP bootstrap. Built-in `Edit`, `Write`, and `Bash` are denied explicitly for the review lane.
- A process exit code of zero is insufficient proof. Structured Grok output must contain an accepted terminal reason and a non-empty final message.
- Grok review finding `CR-001` was valid: the environment registry retained the retired plan-mode claim. The registry and validator now enforce the executable auto-mode contract.

## notes for ko

- Local Grok workspace routing was repaired to use the healthy local workspace MCP endpoint. No token value was written to tracked files.
- Claude-compatible MCP imports still emit unrelated startup warnings; the workspace MCP itself is healthy and remains the required review path.

## improvements noticed

- none yet

## issues and recovery

- The existing wrapper incorrectly marked live `stopReason: Cancelled` results as completed. This was found by running the real foundation review, not by synthetic inspection alone.
- The live Grok process moved to a PTY session and required polling before its structured result was visible.
- Independent review: https://github.com/consuelohq/opensaas/pull/1554#pullrequestreview-4758043206
- Structured review: https://github.com/consuelohq/opensaas/pull/1554#issuecomment-5050553555

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/.tmp-reviews/pr-1554/grok-prompt.md`
- `packages/os/.tmp-reviews/read-policy-smoke/grok-prompt.md`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
