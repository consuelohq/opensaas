# DEV-1623 customer upgrade migration

branch: `task/dialer/dev-1623-customer-upgrade-migration`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2681
started: 2026-10-29

## acceptance criteria

- [x] Append immutable ordered migration 014 without changing migrations 001-013.
- [x] Prove an old applied ledger upgrades missing company credentials while preserving installation data and ledger timestamps.
- [x] Prove idempotent restart, preservation of recovered company credentials, signed embed bootstrap, and unsupported destructive rollback on isolated PostgreSQL.
- [x] Document the upgrade/rollback contract; pass focused tests, strict review and full verify.
- [ ] Publish this verified task through task.push followed immediately by task.pr (the only remaining step; coordinator owns integration/deployment).

## plan

1. Reuse the existing task and clean worktree; fetch and merge current remote stream without touching others' work.
2. Write a focused old-ledger regression and establish the expected failing test before production edits.
3. Append 014 using the idempotent LeadConnector initializer, with no destructive down migration.
4. Exercise isolated PostgreSQL old-state upgrade and signed embed bootstrap with synthetic credentials; validate rollback and idempotency.
5. Update minimal README persistence contract and run strict review/full verify; push and promote through task.pr only.

## files changed

- `packages/dialer-server/README.md`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`


## key decisions

- Preserve all existing migration ids and their functions; run the existing initializer only in a *new* ordered migration, instead of changing 001.
- The 014 migration is forward-only: rollback via migration API must reject it to avoid deleting stored credentials.
- Reconciled latest stream/dialer `d267219442e114867e6b25f297a00d94f552b32c` into this task branch via safe merge `56c84eb6a56be3d6db083a68164a81144b7b8500`, without resetting or rewriting concurrent work.

## notes for ko

- No production DB, provider calls, carrier calls, secret rotations, deployment, or main merge performed. Existing Wet Stone recovery remains untouched.
- Isolated PostgreSQL proof: **1 passed, 15 assertions**, trace `trc_5033af1a7c05`. Real encrypted context resolved persisted installation and company credentials without a provider request.
- Focused migrations: **7 passed**, trace `trc_985fc8ff6aa7`. Dialer-server TypeScript check: green, trace `trc_c2147664fb5d`.
- Broad dialer-server tests: **226 passed, 90 skipped, 0 failed**, trace `trc_5848af532e3c`. PostgreSQL/Redis lab: **1 passed, 39 assertions**, trace `trc_141d93357927`. LeadConnector infrastructure/bootstrap contracts: **7 passed**, trace `trc_1f8685fad250`.
- `git diff --check` clean. All changes limited to dialer-server migration/test/lab/README and task metadata; all old migration identities unchanged.
- Strict review against `origin/stream/dialer`: **0 blockers, 0 findings**, trace `trc_ec9e612255c5`. Full verify initially passed, **publishValid=true**, trace `trc_4499815c2746`; re-running after latest remote stream reconciliation below.
- Before publication, fetched new docs-only `stream/dialer` at `5ce664451386a3cb1138b3464099e1415122b4f1` and safely merged it without overlap/conflicts; task HEAD is `312a5ee41e323f8f76677465b9289595f0c0d0bc`. These are concurrent DEV-1631 changes, not owned or modified by this lane.
- Repeated strict review after latest remote reconciliation: **0 issues**, trace `trc_4c4b797ec683`. Full verify after reconciliation: **publishValid=true**, DB check passed, required selected suites passed, trace `trc_02b9c99a53cf`; stamp is scoped to the existing task and current stream base.

## improvements noticed

- none yet

## errors i ran into

- Linear state update initially rejected the display name `in progress`; fetched team workflow states and updated successfully with the exact state ID.
- Typed `git.diff` with a revision base reported only committed changes, not pending worktree edits. Used task-scoped `code.call` git diff/status/check for complete worktree evidence.
- After the focused green run, a historical RD7B test expected exactly 13 migrations. Updated the expected additive set to include 014, and reran the full suite green.
- Initial `task.push` returned `COMMAND_FAILED` at trace `trc_99cf7dee6823`: remote task branch still pointed to bootstrap `2f2aacdf`, while our local task branch included two safe stream merges (`312a5ee4`). Confirmed the remote task commit is an ancestor; will fast-forward only this task branch (never force/reset) to satisfy the managed publisher's equality precondition, then retry `task.push` immediately followed by `task.pr`.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/dialer/AGENTS.md`
- `packages/dialer-server/README.md`
- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/embed-bootstrap.contract.test.ts`
- `packages/dialer-server/src/inbound/callback-booking-attempt-migration.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/lead-connector/src/application/embed-bootstrap.ts`
- `packages/lead-connector/src/application/marketplace-oauth.ts`
- `packages/lead-connector/src/embed-bootstrap.contract.test.ts`
- `packages/lead-connector/src/index.ts`
- `packages/lead-connector/src/infrastructure.contract.test.ts`
- `packages/lead-connector/src/infrastructure/persistent-stores.ts`
- `packages/lead-connector/src/infrastructure/user-context-decoder.ts`
- `packages/lead-connector/src/ports/index.ts`
- `packages/lead-connector/src/user-context-decoder.contract.test.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tools/codemode/schema.ts`
- `packages/os/tools/git/schema.ts`
- `packages/workspace/senior-engineer.md`

## Test-first contract

behavior under test: An existing standalone database with migrations 001-013 applied but no company credential table upgrades through a new ordered 014 migration. Existing ledger timestamps, installation ciphertexts and customer rows remain intact. Restart is idempotent, pre-existing recovered company credentials survive, signed embed bootstrap can resolve company credentials, and rollback cannot delete credentials.
existing local pattern: migrateDialerDatabase ordered ledger plus LeadConnector idempotent persistence initializer; existing Postgres integration suites use isolated loopback databases.
new or changed tests: focused migration harness regression plus real PostgreSQL old-state upgrade, restart, recovered-state adoption, signed bootstrap and unsupported destructive rollback.
focused red command: bun test packages/dialer-server/src/database/migrations.test.ts
expected red failure: old applied ledger does not run the company-credential table DDL and never records the new migration.
no-test waiver: none.

## TDD red evidence (2026-10-29)

- Command: `bun test packages/dialer-server/src/database/migrations.test.ts -t 'upgrades an old applied ledger'`
- Expected red observed: **1 failed, 0 passed**. With all thirteen old migration ids present, the runner inserted no new migration (actual `[]` vs expected `['20261029_014_lead_connector_company_credentials']`). Trace: `trc_e7f9343c3e4d`.
- This test proves the historic upgrade gap before any production implementation edit.

## Lane acceptance and ownership

- DEV-1623 moved to in progress; latest launch-wave description read.
- Preserve every existing migration identity and customer data; no legacy CRM/GraphQL path.
- Own only standalone migration/test/README and minimal persistence contract if required. Other agents own docs website and shared CI registry.
- Publish task then stream for central integration; no main merge, deployment, live migration or carrier call.
- New task started at current main 7706be45 (source tree equals reconciled stream d2672194). Refresh remote and incorporate stream before promotion.

- 2026-10-29 18:43:52 append: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`

## workspace-owned: activity log

- 2026-10-29 18:43:52 fs.write: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`
- 2026-10-29 19:49:20 apply-patch: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`
- 2026-10-29 19:49:20 apply-patch: `packages/dialer-server/src/database/migrations.test.ts`
- 2026-10-29 19:49:47 apply-patch: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`
- 2026-10-29 19:49:47 apply-patch: `packages/dialer-server/src/database/migrations.ts`
- 2026-10-29 19:49:47 apply-patch: `packages/dialer-server/src/database/migrations.test.ts`
- 2026-10-29 19:52:29 write: `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- 2026-10-29 19:52:29 fs.write: `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`

- 2026-10-29 19:53:04 apply-patch: `packages/dialer-server/src/database/migrations.test.ts`
- 2026-10-29 19:53:04 apply-patch: `packages/dialer-server/src/database/migrations.postgres.integration.test.ts`
- 2026-10-29 19:53:04 apply-patch: `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- 2026-10-29 19:53:04 apply-patch: `packages/dialer-server/scripts/local-dialer-lab.ts`
- 2026-10-29 19:53:05 apply-patch: `packages/dialer-server/README.md`

- 2026-10-29 19:55:26 apply-patch: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 19:55:42 `review.run`: passed — OK
- 2026-10-29 19:56:06 `verify`: passed — OK
- 2026-10-29 19:56:52 apply-patch: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`
- 2026-10-29 19:57:01 `review.run`: passed — OK
- 2026-10-29 19:57:20 `verify`: passed — OK

- 2026-10-29 19:57:45 apply-patch: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`

- 2026-10-29 19:58:43 apply-patch: `.task/dialer/dev-1623-customer-upgrade-migration/workpad.md`