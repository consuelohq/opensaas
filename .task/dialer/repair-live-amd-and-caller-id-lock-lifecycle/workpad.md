# repair live AMD and caller ID lock lifecycle

branch: `task/dialer/repair-live-amd-and-caller-id-lock-lifecycle`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/1555
started: 2026-07-22

## acceptance criteria

- [x] Handle synchronous AMD results delivered to customer TwiML callbacks.
- [x] Keep caller-ID locks alive while provider calls are active and release them on terminal lifecycle events.
- [x] Make winner selection and duplicate callbacks idempotent.
- [x] Prove the machine-answer path with live allowlisted calls and terminal lock release.
- [x] Keep group, reverse call mapping, and winner state resolvable for at least the active caller-ID lease.
- [ ] Publish the final review fix and merge the task into `stream/dialer`.

## plan

1. Reconstruct the Codex P2 regression lost during the workspace outage.
2. Add and run a focused red test for a connected call after six minutes.
3. Align callback-state retention with the 12-hour active caller-ID lease.
4. Run focused, package, server, typecheck, review, and verify gates.
5. Publish PR #1555 and promote it to `stream/dialer`.

## current status

- The substantive AMD and lock-lifecycle implementation is present on PR #1555.
- The Codex P2 callback-retention follow-up has been reconstructed and fully verified.
- Publication and stream promotion are the remaining lifecycle steps.

## Test-first contract

- Behavior under test: after a human leg connects, its group and reverse call mapping remain resolvable beyond five minutes so the terminal callback can release caller-ID locks and emit telemetry.
- Existing pattern: `ParallelDialerService` TTL tests use `InMemoryParallelStore`; one-leg conference groups are already supported.
- New test: create a one-leg group, mark it `in-progress` with `AnsweredBy=human`, advance six minutes, then assert both group and call mapping still exist.
- Focused red command: run `packages/dialer/src/services/parallel-dialer.spec.ts`.
- Expected red failure: reverse call mapping returns `null` because `GROUP_TTL_SECONDS` is still 300.

## prior validation evidence

- Full `@consuelo/dialer`: 132 tests passed before the review follow-up.
- Focused server lifecycle/call-start suites: 34 tests passed.
- Dialer TypeScript check passed.
- Live allowlisted machine-answer validation proved automatic termination and lock release.
- Two-leg live fanout completed with zero manual cleanup and zero remaining locks.

## key decisions

- `@consuelo/dialer` remains the reusable domain/provider package.
- Application adapters own authentication, tenancy, HTTP/GraphQL contracts, and provider callback routing.
- The old frontend is not part of this task and is not evidence for API or GoHighLevel readiness.

## notes for ko

- The live run exercised `twenty-server` application adapter -> `@consuelo/dialer` -> Twilio, not the standalone `packages/api` REST surface.
- Human-answer validation will be repeated through the standalone REST API after API lifecycle parity is implemented.

## issues and recovery

- Workspace outage prevented final publication and reset the task worktree to the remote PR state.
- OS batch nested calls did not inherit the recovered session; task-scoped `code.run` restored branch-aware reads.
- `task.push` facade schema drift is tracked separately as DEV-1600; use the repository task-push script through scoped `code.call` if it recurs.

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`
- `packages/dialer/src/services/parallel-dialer.ts`
- `packages/dialer/src/services/parallel-dialer.spec.ts`
- `packages/dialer/src/services/caller-id.ts`
- `packages/dialer/src/index.ts`
- `packages/dialer/package.json`
- `packages/api/src/shared/dialer.ts`
- `packages/api/src/routes/parallel.ts`
- `packages/api/src/routes/__tests__/parallel.spec.ts`
- `packages/api/src/services/ghl-auth.ts`
- `packages/api/src/services/ghl-client.ts`
- `packages/api/src/routes/ghl.ts`
- `packages/api/src/routes/__tests__/ghl.spec.ts`
- `packages/twenty-front/src/modules/settings/integrations/services/ghlBridge.ts`

- 2026-07-22 22:51:27 write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-22 22:51:27 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`
- 2026-07-22 22:52:56 fs.write: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`

## workspace-owned: validation evidence

- 2026-07-22 22:52:50 `review.run`: passed — OK
- 2026-07-22 22:55:25 `verify`: passed — OK
- 2026-07-22 22:55:25 `verify`: passed — OK

## review follow-up validation

- Red: the connected group was `null` after six minutes with `GROUP_TTL_SECONDS = 300`.
- Green: callback-state retention now derives from the shared 12-hour active-call lease.
- Focused parallel lifecycle: 44/44 tests passed.
- Full `@consuelo/dialer`: 133/133 tests passed.
- Focused twenty-server lifecycle/call-start: 34/34 tests passed.
- Dialer TypeScript check passed.
- Repository review: 0 issues in changed code, 0 blockers; inherited project-wide typecheck baseline only.

- 2026-07-22 22:52:56 append: `.task/dialer/repair-live-amd-and-caller-id-lock-lifecycle/workpad.md`

- Full verifier: passed; publish-valid stamp generated with 0 changed-code issues and 0 blockers.
