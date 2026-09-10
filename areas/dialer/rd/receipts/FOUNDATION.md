# RD foundation integration receipt

Observation: 2026-09-09 America/New_York. This is the external prerequisite receipt, not a new RD graph node.

- Task PR: https://github.com/consuelohq/opensaas/pull/2446 (resolve merge state/SHA live).
- Task session: tsk_38f81a6f60e8.
- Target: stream/dialer; source target SHA 997e8da423a21a808c63cc8cd83cb3266f438b6d.
- Consumed algorithm source: 37c6531965a365e5886f5c75fdec275c6e330430, including published #2404 and D1-D4.
- Scope: the complete source delta for packages/dialer and packages/dialer-server, 58 files. Neither package has target-only changes since merge base f2dbf47fbe29d897315bc82fb86f5d8c7fd4ccaf. Source-equivalent package contents plus the explicit rollback repair below, not algorithm-stream ancestry, establish this prerequisite.
- Preserved: RD0 guidance and frozen decisions, existing unrelated task work, and PR #2445's independent current-main/OS/workspace reconciliation. That task is not completed or superseded by this package integration.
- Review evidence: #2404 workpad documents reproduced/fixed authorization, timestamp/schema coherence, zero-row decision finalization, timing ties and FIFO-on-missing-hazard defects with focused red/green evidence. Later scoped review findings are inspected before publication.
- Validation on this target: SDK 223 tests pass; server 173 pass (isolated lab skipped in unit run); both Nx typechecks pass; separate Nx lab:verify passes with isolated real PostgreSQL/Redis, migrations 001-005, canonical learning/runtime/censoring checks and resource teardown.
- Final publication gate and scoped review: see the task workpad and verify stamp. This receipt is written before promotion; do not treat an open PR as integrated.
- RD1 readiness: after this task's validated merge, the relevant Dialer/scientific source foundation is present on stream/dialer. Unrelated algorithm-stream OS/workspace/main cleanup is not claimed complete and does not require duplicating that owner.
- No carrier calls, production schema changes, deployments or learned-policy activation were performed.

Late review repair: migration 005 now exposes a supported guarded down operation without changing its up SQL. The isolated lab proves down/up removes/restores exactly its two constraints, retains earlier migration records and preserves all observation rows. These additions in migrations.ts, scripts/local-dialer-lab.ts and the lab integration test are the only differences from the consumed package source.
