# refresh script parity classifications for stream os verify

branch: `task/os/refresh-script-parity-classifications-for-stream-os-verify`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2311
started: 2026-08-30

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `packages/os/tests/audit/script-parity-audit.test.ts` must classify every workspace+OS script in the live inventory. Stream/os verify failed because the fixture lagged the inventory (missing explore-bench files; stale visible-dialer-steering.ts).

existing local pattern: `packages/os/tests/audit/fixtures/script-parity-classifications.json` is the committed baseline. Keep existing classifications; add inventory-only scripts with a specific status/reason; drop baseline keys that are no longer on disk.

new or changed tests: no new test file. The existing audit test is the red/green gate.

focused red command: `bun test packages/os/tests/audit/script-parity-audit.test.ts`

expected red failure: `assertClassificationsMatchInventory` at line 206

no-test waiver: not applicable

- 2026-08-30 17:58:49 append: `.task/os/refresh-script-parity-classifications-for-stream-os-verify/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-30 17:58:49 fs.write: `.task/os/refresh-script-parity-classifications-for-stream-os-verify/workpad.md`
