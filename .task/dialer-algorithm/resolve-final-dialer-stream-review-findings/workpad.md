# resolve final dialer stream review findings

branch: `task/dialer-algorithm/resolve-final-dialer-stream-review-findings`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2452/resolve-final-dialer-stream-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2452
started: 2026-09-10

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

- 2026-09-10 03:55:49 fs.write: `.task/dialer-algorithm/resolve-final-dialer-stream-review-findings/workpad.md`
- 2026-09-10 03:59:35 fs.write: `.task/dialer-algorithm/resolve-final-dialer-stream-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 04:00:05 `review.run`: passed — OK
- 2026-09-10 04:00:21 `review.run`: passed — OK
- 2026-09-10 04:00:48 `verify`: passed — OK

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

## Test-first contract

behavior under test:
- canonical learning persistence always supplies a non-null observation horizon without manufacturing response evidence; when no later lifecycle timestamp exists, the horizon is exactly `dialStartedAt` (zero-duration observation).
- the isolated science lab fails closed when either idempotency-probe telemetry write reports persistence failure.
- unexpected stdin errors in Code Call and synchronous subagent processes terminate the owned child before settlement, preserve nonzero failure semantics, and retain kill escalation; expected EPIPE/ERR_STREAM_DESTROYED remain benign.
- synthetic dry-run coverage cannot silently exclude a mutating tool merely because its schema stopped accepting `dryRun`.
- detached-runner regression cleanup never signals PID 0 when child spawn has no PID.

existing local pattern:
- `lead-connector-learning.test.ts` inspects canonical INSERT parameters and classification.
- `subagent-runner-termination.test.ts` owns process-termination regressions; `code-call-process-regressions.test.ts` owns Code Call child-process regressions.
- facade tests derive tool sets from manifest capabilities and exercise generated cases.
- the real isolated PostgreSQL/Redis lab is the integration proof for science-lab persistence and migration constraints.

new or changed tests:
- add a telemetry test with no answer/termination/group-completion timestamp and assert `$8 == dialStartedAt`, `$7 == null`, and non-response/censoring semantics are unchanged.
- extend process regression assertions around unexpected stdin failure handling and compile/type shape where feasible; retain existing real EPIPE tests.
- change synthetic dry-run test enumeration to capability-only selection and assert schema acceptance inside each case.
- guard detached-runner cleanup on a defined PID.
- validate the lab change again in the isolated PostgreSQL/Redis proof.

focused red commands:
- `bun test packages/dialer-server/src/runtime/lead-connector-learning.test.ts`
- focused OS process/facade tests after adding the regressions.

expected red failure:
- current telemetry records `$8 = null` when all lifecycle end timestamps are absent.
- current Code Call/subagent unexpected-stdin branches settle before owned-child termination (and Code Call omits required `containmentUnavailable`).
- current synthetic-dry-run enumeration can hide schema rejection.
- current detached-runner cleanup falls back to PID 0.

no-test waiver: not applicable. The lab boolean check is additionally proved by the real isolated-service integration run because its failure mode is persistence-coupled.

Review source: late CodeRabbit full review on #2014 at 2026-09-10T03:49:38Z; seven comments 3975271121, 3975271125, 3975271138, 3975271141, 3975271150, 3975271155, 3975271159. All seven reproduce in stream head `99c8dd1b90afb818969526f91d1e29f2e3ab4edc`; fixes must preserve canonical censoring, attempt ordinals, economic stopping, provider-neutral ownership, and D4 shadow-only boundaries.

- 2026-09-10 03:55:49 append: `.task/dialer-algorithm/resolve-final-dialer-stream-review-findings/workpad.md`

## workspace-owned: files read

- none yet

### late-review validation evidence

- All seven CodeRabbit findings from #2014 were reproduced against stream head `99c8dd1b90afb818969526f91d1e29f2e3ab4edc` and fixed without changing the D3/D4 policy boundary.
- Observation horizon: when no termination, answer, or group-completion timestamp exists, canonical persistence now uses `dialStartedAt` as the zero-duration observation horizon. `response_at` stays null and the existing classifier still controls response/censoring semantics; no response or timeout is manufactured.
- Science lab idempotency probe now checks both telemetry persistence booleans and fails closed through the lab's existing wrapped error contract.
- Code Call unexpected stdin failures now record the error, terminate/escalate the owned process tree, and settle nonzero on child close; duplicate stdin handlers were removed and `containmentUnavailable` remains present. Expected EPIPE/ERR_STREAM_DESTROYED remain benign.
- Synchronous subagent unexpected stdin failures now terminate/escalate the child and settle nonzero on close; expected pipe closure remains benign.
- Synthetic dry-run coverage now enumerates mutating/no-command-flag tools independently of schema acceptance, then explicitly asserts each tool schema accepts `dryRun` before execution.
- Detached-runner cleanup now sends SIGKILL only when `child.pid` is defined; PID 0 is never synthesized.
- GREEN focused: lab/learning 8/8; process regressions 10/10; targeted facade 69 selected passes; Dialer Server typecheck/build.
- GREEN critical OS selector across all changed OS files: 7 critical suites, 0 failures.
- GREEN full Dialer: 223/223. GREEN full Dialer Server: 175 pass, 1 intentional isolated-service skip, 0 failures.
- GREEN real isolated service proof: PostgreSQL + Redis lab 1/1, 24 assertions, empty schema migrations including `005`, scientific validation, Redis coordination, and clean teardown. No production credentials, provider traffic, carrier calls, number purchases, or deployment.
- Main-relative/worktree `git diff --check` is clean.

- 2026-09-10 03:59:35 append: `.task/dialer-algorithm/resolve-final-dialer-stream-review-findings/workpad.md`
