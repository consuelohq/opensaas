# restack browser isolation on current main

branch: `task/workspace-agents/restack-browser-isolation-on-current-main`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2218/restack-browser-isolation-on-current-main
github pr: https://github.com/consuelohq/opensaas/pull/2218
started: 2026-08-26

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

- 2026-08-26 15:03:21 fs.write: `.task/workspace-agents/restack-browser-isolation-on-current-main/workpad.md`
- 2026-08-26 15:05:14 fs.write: `.task/workspace-agents/restack-browser-isolation-on-current-main/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 15:04:43 `review.run`: passed — OK
- 2026-08-26 15:05:06 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Restack plan

- acceptance: remove `browser.headed`'s global `close --all`; keep the persistent human browser in a named `consuelo-human` session; let raw callers preserve explicit `--session`/`--profile` routing; keep status/read commands attached to the active session; preserve the current main OS/workspace code outside browser-specific selection tests.
- delivery: current `origin/main` is the source of truth. Reapply only browser runtime files, mirrored browser tests, and the focused test-selection rule needed to stop broad unrelated OS package tests from gating browser-only changes.
- concurrency: do not overwrite `stream/workspace-agents` unless its remote SHA is still the expected old stream head immediately before promotion.

## Test-first contract

behavior under test: headed browser handoff no longer closes all sessions and raw explicit session/profile routing remains isolated.
existing local pattern: mirrored `packages/os/tests/browser-service.test.ts` and `packages/workspace/tests/browser-service.test.ts` exercise the shared browser service contract.
new or changed tests: reuse the previously validated browser-session-isolation assertions from `origin/stream/workspace-agents`; current-main tests should fail before the runtime restack.
focused red command: `bunx vitest run packages/os/tests/browser-service.test.ts packages/workspace/tests/browser-service.test.ts`
expected red failure: current main still expects/emits `close --all` and lacks named `consuelo-human` session routing.
no-test waiver: not applicable.

- 2026-08-26 15:03:21 append: `.task/workspace-agents/restack-browser-isolation-on-current-main/workpad.md`

## Validation and status

- RED: current-main browser contracts failed 2 tests / 30 passed before restack (`trc_e0f66bd622b8`).
- GREEN: mirrored browser contracts pass 38/38 and focused browser test-selection guard passes 1/1 (`trc_118e1b83430b`).
- Strict review: 0 blockers (`trc_7490584fe7b2`).
- Full verify against current `origin/main`: passed and `publishValid: true` for exactly 7 browser/selection files (`trc_d6ef6cc226a7`).
- Restack intentionally excludes the old stream's media/trace/parity/release-gate patches; current main is authoritative for those surfaces.

- 2026-08-26 15:05:14 append: `.task/workspace-agents/restack-browser-isolation-on-current-main/workpad.md`
