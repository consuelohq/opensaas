# Finish foundation migration rollback review

branch: `task/dialer/finish-foundation-migration-rollback-review`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2451
started: 2026-09-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `areas/dialer/rd/receipts/FOUNDATION-REVIEW.md`
- `packages/dialer-server/src/database/learning-migration-rollbacks.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer/tests/inbound-build.test.mjs`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract
User authorized finishing foundation and RD1. Follow-up owns only review-attributed rollback handlers for newly integrated migrations002–004, isolated rollback-chain proof, and any RD1 compiled SDK import defect confirmed by build smoke. Existing scopes/other cleanup preserved. RED: lab expectation for full rollback-chain proof is missing; expected failure before handlers. Exercise down006,005,004,003,002 and up in an outer isolated Postgres transaction, then rollback proof transaction to preserve fixture data. Assert baseline tables/data retained, canonical schema removed/recreated, ledger safety blocks out-of-order rollback. Also inspect compiled inbound entry with Node; if unresolved relative specifiers fail, correct only SDK imports and prove built entry loads. No production data/provider effects.

- 2026-09-10 03:43:19 append: `.task/dialer/finish-foundation-migration-rollback-review/workpad.md`

## workspace-owned: files changed

- `areas/dialer/rd/receipts/FOUNDATION-REVIEW.md`
- `packages/dialer-server/src/database/learning-migration-rollbacks.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer/tests/inbound-build.test.mjs`

## workspace-owned: activity log

- 2026-09-10 03:43:19 fs.write: `.task/dialer/finish-foundation-migration-rollback-review/workpad.md`
- 2026-09-10 03:44:45 write: `packages/dialer-server/src/database/learning-migration-rollbacks.ts`
- 2026-09-10 03:44:45 fs.write: `packages/dialer-server/src/database/learning-migration-rollbacks.ts`
- 2026-09-10 03:44:47 write: `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- 2026-09-10 03:44:47 fs.write: `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- 2026-09-10 03:45:32 write: `packages/dialer/tests/inbound-build.test.mjs`
- 2026-09-10 03:45:32 fs.write: `packages/dialer/tests/inbound-build.test.mjs`
- 2026-09-10 03:46:46 write: `areas/dialer/rd/receipts/FOUNDATION-REVIEW.md`
- 2026-09-10 03:46:46 fs.write: `areas/dialer/rd/receipts/FOUNDATION-REVIEW.md`

## Validation
Rollbackchain lab RED undefinedproof then GREEN1test30expects. Node compiledentry RED module_not_found then GREEN corrected .js specifiers and permanent Node smoke in SDKbuild. Fullpackages403pass1skip0fail1430expects. Nx bothbuilds and2dependencies exited0; durable build-evidence.json saved (wrapper flagged evidence write in verify mode, not a build failure). Preserve original001 baseline as intentionally unsupported uninstall; downrequired for every subsequent migration. No existing upSQL rewritten.

## workspace-owned: validation evidence

- 2026-09-10 03:47:07 `verify`: passed — OK
- 2026-09-10 15:45:24 `verify`: passed — OK

## Continuation 2026-09-10
OS connection restored. Resumed same owning task; confirmed #2451 remains open and preserved changes intact. Corrected unconstrained pg generic by adapting typed record rows to the existing generic database port. Previous TS2344 RED remains the regression evidence. Completing typechecks, isolated lab, canonical verification and promotion.

Late foundation comments3975271110/3975271114: own aggregate-attempt fallback and zero-usable-training-period gate. Add regressions for peak-slot leakage and all/training-only early censoring; run red before production changes.

Current package suites406pass1skip0fail1433expects. Late algorithm regressions3RED thenGREEN. Exact-slot evidence retained; absent-slot fallback now aggregate fromgetAnswerProbabilities; zero training periods explicit insufficient status without fitting. Final verification follows.
