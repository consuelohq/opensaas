# sync bundled os steering from canonical workspace steering

stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2322

## Test-first contract

- **behavior under test:** `packages/os/steering/system_prompt.md` is a verbatim copy of `packages/workspace/STEERING.md`.
- **existing test:** `packages/os/tests/steering-canonical-source.test.ts`
- **focused red command:** `bun test tests/steering-canonical-source.test.ts` from packages/os
- **CI red:** Consuelo / verify job 99327225955, assertion at steering-canonical-source.test.ts:30
- **no-test waiver:** not applicable

- 2026-08-30 22:07:20 write: `.task/os/sync-bundled-os-steering-from-canonical-workspace-steering/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 22:07:20 fs.write: `.task/os/sync-bundled-os-steering-from-canonical-workspace-steering/workpad.md`
