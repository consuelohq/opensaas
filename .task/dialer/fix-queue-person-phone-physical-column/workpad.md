# fix queue person phone physical column

branch: `task/dialer/fix-queue-person-phone-physical-column`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/555/fix-queue-person-phone-physical-column
github pr: https://github.com/consuelohq/opensaas/pull/555
started: 2026-05-24

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

- 2026-05-24 02:35:50 fs.write: `.task/dialer/fix-queue-person-phone-physical-column/workpad.md`

## workspace-owned: validation evidence

- none yet

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

## production retest and fix - 2026-05-24 02:36 UTC

- Retested the safe list on production deploy `8913d254`.
- UI selected `ko dialer safe test 20260520-172040` and clicked Start Dialer.
- Railway runtime logs for deploy `8913d254` showed `DialerCallStartService` failure with `source: 'queue'`, `selectionStrategy: 'predictive'`, `callMode: 'live'`, and `errorMessage: 'column person.phone does not exist'`.
- This proves the previous fallback shipped but referenced a non-existent physical workspace column.
- New patch removes the invalid `person."phone"` SQL reference.
- Frontend parallel queue start now sends `contactIds` and `targetPhones` for pending/calling queue items.
- Backend queue target resolution now uses those input target phones as a validated fallback keyed by contact id when DB joins do not produce a callable phone.
- This avoids guessing workspace physical columns while preserving backend validation, allowlist checks, capacity calculation, and queue item ids.
- Validation: prettier passed, check-files passed, git diff --check passed.
- Focused Jest still cannot run in this worktree because local module resolution cannot find `@nestjs/common` before tests execute.

- 2026-05-24 02:35:50 append: `.task/dialer/fix-queue-person-phone-physical-column/workpad.md`
