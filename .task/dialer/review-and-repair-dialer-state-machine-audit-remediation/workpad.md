# Review and repair dialer state machine audit remediation

branch: `task/dialer/review-and-repair-dialer-state-machine-audit-remediation`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2768/review-and-repair-dialer-state-machine-audit-remediation
github pr: https://github.com/consuelohq/opensaas/pull/2768
started: 2026-11-02

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

- 2026-11-02 04:06:52 fs.write: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`
- 2026-11-02 04:07:56 fs.write: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`
- 2026-11-02 04:08:43 fs.write: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`
- 2026-11-02 04:09:46 fs.write: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`

## workspace-owned: validation evidence

- 2026-11-02 04:09:55 `review.run`: passed — OK
- 2026-11-02 04:10:54 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior: a pending terminate effect with a known carrier SID must attempt cleanup even if both its session and capacity owner no longer exist; a provider timeout remains unknown, never a false local no-effect.
Pattern: extend the existing Postgres telephony integration test for orphaned termination and simulated carrier.
Red: run the focused integration test on an isolated task-owned Postgres, expecting the call to remain in progress and effect to be incorrectly failed before the fix.
Also inspect the other audited changes and identify remaining unverified boundaries; preserve uncertain capacity and do not initiate carrier calls.

- 2026-11-02 04:06:52 append: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`

## Revised finding and test-first contract
A missing-session telephony effect is prevented by an existing foreign key under normal database integrity, so this is a defensive concern rather than a confirmed ordinary path. Prioritize an actual restart gap: callback start command can be dispatched atomically with pending rep_bridge/customer_dial effects, but executePending only executes effects for pending commands and merely settles dispatched commands. Test the exact persisted post-dispatch/pre-provider crash boundary with real isolated PostgreSQL and simulated carrier; expect no calls before fix and safe ordered, one-time rep bridge then customer dial after recovery. Preserve unknown effects and ownership fences; never replay dispatched/unknown provider mutations.

- 2026-11-02 04:07:56 append: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`

Additional red regression: a canceled callback with succeeded rep_bridge and pending customer_dial is nevertheless dialed by reconcileOne (1 actual customer offer in simulated carrier). Test-first: enforce callback status, current attempt/capacity generation and prerequisite in the same tenant-locked transaction as effect claim; canceled work must not dispatch. Red tests both reproduced on isolated Postgres 55494.

- 2026-11-02 04:08:43 append: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`

## Review and implementation
PR 2765 contains all three audit-wave changes. The original orphan-session concern is normally prevented by an effects-to-session foreign key. Found and reproduced two additional defects in callback recovery: post-dispatch pending effects were not resumed, and recovery dialed a customer after callback cancellation. Both new Postgres/simulated-carrier tests failed before changes and pass now. Resume only pending effects after revalidating owner; transactionally recheck callback status, latest attempt, owner generation/phase, and successful rep bridge when claiming provider actions. A previously unknown rep bridge may resume customer only after its effect is proved successful and all other effects are definitive. Provider effects already dispatched/unknown remain subject to reconciliation, never blindly retried. As with all carrier commands, a cancellation after a local claim cannot be atomic with an external mutation.

Validation: isolated task-owned PostgreSQL 16 on 127.0.0.1:55494; focused regressions pass; 51 inbound/callback integration tests pass, 2 pre-existing migration rollback tests filtered due to newer forward-only migration baseline. No real carrier calls. Full gates pending.

- 2026-11-02 04:09:46 append: `.task/dialer/review-and-repair-dialer-state-machine-audit-remediation/workpad.md`
