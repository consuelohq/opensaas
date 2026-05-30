# make phone action primary on number hover

branch: `task/general/make-phone-action-primary-on-number-hover`
stream: `stream/general`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/598/make-phone-action-primary-on-number-hover
github pr: https://github.com/consuelohq/opensaas/pull/598
started: 2026-05-25

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`

## workspace-owned: files changed

- `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`

## workspace-owned: activity log

- 2026-05-25 23:27:51 fs.patch: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`
- 2026-05-25 23:28:17 fs.write: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`
- 2026-05-25 23:29:49 fs.patch: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`
- 2026-05-25 23:30:00 fs.patch: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`
- 2026-05-25 23:31:04 fs.write: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`

## workspace-owned: validation evidence

- 2026-05-25 23:28:26 `checkFiles`: passed — OK
- 2026-05-25 23:29:14 `review.run`: passed — OK
- 2026-05-25 23:30:04 `checkFiles`: passed — OK
- 2026-05-25 23:30:26 `review.run`: passed — OK
- 2026-05-25 23:31:06 `checkFiles`: passed — OK
- 2026-05-25 23:31:28 `review.run`: passed — OK
- 2026-05-26 00:37:46 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(general): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-25 23:27:51 patch lines 27-27: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`

- 2026-05-25 23:28:17 write: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`

- 2026-05-25 23:29:49 patch lines 10-15: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`

- 2026-05-25 23:30:00 patch lines 1-16: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`

- 2026-05-25 23:31:04 write: `packages/twenty-front/src/modules/object-record/record-table/record-table-cell/hooks/useGetSecondaryRecordTableCellButton.ts`
