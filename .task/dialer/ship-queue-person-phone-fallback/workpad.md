# ship queue person phone fallback

branch: `task/dialer/ship-queue-person-phone-fallback`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/554/ship-queue-person-phone-fallback
github pr: https://github.com/consuelohq/opensaas/pull/554
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

- 2026-05-24 01:42:13 fs.write: `.task/dialer/ship-queue-person-phone-fallback/workpad.md`

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

## ship update - 2026-05-24 01:42 UTC

- Verified production `StartDialerCall` was still failing with `No callable targets or caller IDs are available` using redacted Browser Network capture.
- Verified the active backend queue has one `calling` item with one attempt, so this is not an empty/depleted queue.
- Ran the same queue start in `mock` mode; it failed with the same error, ruling out Twilio/caller-ID creation for the reproduced failure.
- Root cause: the current production person record exposes callable data on deprecated `person.phone`, but backend queue target resolution only checked runtime `contacts.phone` and the newer composite workspace phone columns.
- Patch: add `NULLIF(person."phone", '')` fallback before composite phone fields in `resolveQueueTargets()`.
- Regression assertion updated to require `person."phone"` in the person-id SQL fallback path.
- Validation: prettier passed, check-files passed, git diff --check passed.
- Focused Jest did not execute tests because local module resolution still cannot find `@nestjs/common`; same local dependency blocker as prior task.

- 2026-05-24 01:42:13 append: `.task/dialer/ship-queue-person-phone-fallback/workpad.md`
