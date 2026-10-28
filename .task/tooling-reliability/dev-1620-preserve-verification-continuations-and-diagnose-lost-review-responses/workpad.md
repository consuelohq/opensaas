# DEV-1620 verification continuation and lost review-response investigation

branch: `task/tooling-reliability/dev-1620-preserve-verification-continuations-and-diagnose-lost-review-responses`
stream: `stream/tooling-reliability`
pr: https://github.com/consuelohq/opensaas/pull/2632
started: 2026-10-28 America/New_York

## acceptance criteria

- [ ] Preserve bounded VERIFY_PENDING state and same-session continuation instructions in the facade.
- [ ] Preserve bounded causal and failed selected-suite evidence in completed failures; retain true stamp/head/base association on success.
- [ ] Preserve existing detached, foreground fail-closed, self-hosting and completed-call recovery semantics from #2597.
- [ ] Correlate the actual DEV-1616 stall with facade/MCP/transport traces; distinguish local command completion from delivery and client continuation.
- [ ] Add focused failing tests before production edits, run relevant integration/review/verify gates, and publish to the existing stream.
- [ ] Leave the callback agent's implementation files untouched and provide a precise resume prompt.

## plan

1. Read runtime evidence and source contracts from the existing tooling-reliability lane.
2. Correlate DEV-1616's last completed review with MCP and gateway records.
3. Reproduce and repair the proven pending/failure response compaction defect through focused facade tests.
4. Fix a transport/delivery defect only if the captured evidence and a regression establish it; otherwise leave a bounded, actionable diagnostic gap.
5. Validate, publish, and distinguish source merge from installed connector acceptance.

## files changed

- none yet

## key decisions

- Stack on current unshipped stream/tooling-reliability (90de526c...) containing the earlier detached verification and completed-call recovery fixes; do not reimplement them.
- DEV-1616 taskSession is tsk_b8f12f6d23cf. Eight source/test files are still unpushed; PR #2631 contains only its bootstrap commit. Its green checks do not cover that working implementation.
- Last observed task action: review.run trc_f454f7510098 at 2026-10-27 23:03:52 EDT, success, 8.738s, zero findings across eight changed files. No verify event or stamp follows. That evidence establishes local completion, not response delivery.
- The screenshot's spinner alone cannot establish a token, tunnel, server, or client root cause.
- Canonical verifier honors TASK_WORKTREE; generic cwd routing is not the established cause of the pending-summary problem.

## notes for ko

- Corrected resume prompt saved and opened at /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-handoffs/dev-1616-resume-existing-task.md.
- Do not restart, redeploy, log out, rotate secrets, or mutate sibling code merely to diagnose this session.
- We need actual connector acceptance to claim ChatGPT's lost-response problem fixed; local facade tests alone are insufficient.

## improvements noticed

- Explore index is stale (2026-09-23) and suggests removed legacy CRM paths. Follow current OS source and user boundaries.

## errors i ran into

- GitHub metadata lookup for DEV-1616 returned 404 because task metadata and implementation were not pushed. Local trace-derived taskSession allowed a safe read-only workpad check.

## Test-first contract

behavior under test:
- A pending verifier response remains explicitly pending with its run identity and next action, without marking success or writing a stamp.
- Completed failure packets keep bounded reasons and failed selected-suite evidence.
- Same-session pending/completed progression and existing completed-call recovery remain safe.

existing local pattern:
- executeTool('verify', ...) facade tests with an injected command runner and scoped task fixtures.
- Existing lost-response replay and MCP route tests in stream/tooling-reliability.

new or changed tests:
- Add pending, completed-failure summary and completed-pass cases to the existing focused facade tests.
- Add transport regression only after trace correlation narrows an actual delivery failure.

focused red command:
- In packages/os: node ../../node_modules/vitest/vitest.mjs run tests/facade/facade.test.ts -t 'preserves pending verify|keeps bounded verify failure|preserves completed verify'

expected red failure:
- compactVerifyData omits status/pending/runKey/phase/message/nextAction/retryAfterSeconds and because/testSelection.

no-test waiver:
- None for production behavior changes.

---

## publish checklist

- Record red/green and transport evidence.
- Strict review and real verify pass without bypass.
- task.push, task.pr and stream review read-back.
- Keep installed/runtime acceptance distinct.

- 2026-10-28 04:34:01 write: `.task/tooling-reliability/dev-1620-preserve-verification-continuations-and-diagnose-lost-review-responses/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-28 04:34:01 fs.write: `.task/tooling-reliability/dev-1620-preserve-verification-continuations-and-diagnose-lost-review-responses/workpad.md`

## Red proof
- Node Vitest focused regression command: `cd packages/os && node ../../node_modules/vitest/vitest.mjs run tests/facade/facade.test.ts -t 'preserves pending verify|keeps bounded verify failure|preserves completed verify'`. Three behavioral assertions failed before production changes (missing pending continuation, missing because/selected suites, missing stamp); trace trc_567f852540dc.
- Bun-hosted Vitest failed during collection on installed zod interop; Node Vitest collected and executed correctly. No dependency/source workaround applied.
- Actual DEV-1616 stalled review trc_f454f7510098 completed successfully in 8738ms at 2026-10-28T03:03:52.662Z. No subsequent verify. Installed OS runtime sha256-736dc2be8b4c61b2a9b72ce0d58afc3992ae40ca23d0241f7f877cb692fe85b0 lacks stream response receipts and request-recovery modules; response delivery cannot be established from its request-only logs.

## workspace-owned: validation evidence

- 2026-10-28 04:39:16 `review.run`: passed — OK
- 2026-10-28 04:39:21 `verify`: pending — installed facade incorrectly logged outer command success as a verification pass; no verify stamp exists.
- 2026-10-28 04:41:05 `review.run`: passed — OK
- 2026-10-28 04:41:08 `verify`: passed — OK
- 2026-10-28 04:41:57 `verify`: passed — OK

## Additional red proof
- trc_901f73997cae: pending workpad regression failed because the facade appended `verify: passed — OK` before the worker completed. New guard skips completed-validation/TDD evidence while status is VERIFY_PENDING or pending=true.
- Initial full gate is stale after these latest edits; rerun required.

## Green and publication evidence
- Final focused regression run trc_4faa2d72f322: 767 tests pass across facade, release-tool surface, MCP gateway and completed-request recovery.
- Strict review trc_307b7ca25834: zero blocking findings.
- Same-session full verify trc_15f13b291022 completed passed=true, publishValid=true with real stamp for current source changeHash. Initial pending response was not accepted as proof.
- OS transport returned misleading CONSUELO_NODE_UNAVAILABLE on unsupported tool aliases during Linear lookup; local health remained 200 and known verify/linear.issue calls succeeded. This is separate from the historical stalled review and is not evidence of tunnel loss.
- DEV-1620 updated with trace/runtime evidence; keep in progress until installed connector acceptance.
- No installed-runtime mutation, restart, main merge, deployment or carrier calls. Source fix still requires tooling stream release/activation.
