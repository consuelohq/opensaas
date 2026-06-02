# verify production call start result

branch: `task/dialer/verify-production-call-start-result`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/553/verify-production-call-start-result
github pr: https://github.com/consuelohq/opensaas/pull/553
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

- 2026-05-24 01:00:26 fs.write: `.task/dialer/verify-production-call-start-result/workpad.md`
- 2026-05-24 01:03:27 fs.write: `.task/dialer/verify-production-call-start-result/workpad.md`
- 2026-05-24 01:39:04 fs.write: `.task/dialer/verify-production-call-start-result/workpad.md`

## workspace-owned: validation evidence

- 2026-05-24 01:09:58 `review.run`: passed — OK

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

## verification update - 2026-05-24 01:00 UTC

Ko reported hearing a failure-like sound during the previous production test. Important correction: prior validation proved the UI entered the active queue page and Railway did not show the old `NO_CALLABLE_TARGETS` path, but it did not prove a Twilio call leg actually started.

Acceptance criteria:
- Capture the actual production `StartDialerCall` mutation response from Browser Network/UI path.
- Correlate the response with Railway runtime logs on the deployed commit.
- Determine whether the remaining failure is target resolution, caller ID capacity, Twilio call creation, browser/microphone/audio state, or another frontend state issue.
- Do not print tokens, full phone numbers, full Twilio SIDs, or secrets.

- 2026-05-24 01:00:26 append: `.task/dialer/verify-production-call-start-result/workpad.md`

## captured failure - 2026-05-24 01:03 UTC

- Installed browser-side redacted fetch capture on production list detail page.
- Clicked visible `End`, then `Continue Queue (R)`.
- Captured production `StartDialerCall` request to `/metadata`.
- Request: `source=queue`, `selectionStrategy=predictive`, `requestedFanout=2`, queue id redacted.
- Response HTTP 200 with GraphQL error: `No callable targets or caller IDs are available`, `data=null`.
- Conclusion: Ko was right. The call did not actually start; previous validation only proved navigation/queue UI state and no visible HTTP 4xx/5xx, not successful call creation.

Next: inspect current runtime queue items and capacity inputs to separate target-count vs caller-id-count on this exact queue path.

- 2026-05-24 01:03:27 append: `.task/dialer/verify-production-call-start-result/workpad.md`

## fix update - 2026-05-24 01:39 UTC

- Captured actual production failure from Browser Network: `StartDialerCall` returned GraphQL error `No callable targets or caller IDs are available`.
- Confirmed backend queue is active with 1 item in `calling`; queue lookup/detail returned 200 using the app auth token.
- Ran same queue call in `mock` mode; it failed with the same error, ruling out Twilio call creation and caller ID availability for this queue.
- Root cause: queue item is keyed by person id and the frontend's Person type uses deprecated `person.phone`, while backend target resolution only checked runtime `contacts.phone` and composite person phone subfields.
- Patch: backend target resolution now falls back to `person."phone"` before composite `phonesPrimaryPhoneCallingCode` + `phonesPrimaryPhoneNumber`.
- Regression assertion updated to require `person."phone"` in the SQL fallback path.
- `npx prettier --write` passed for touched service and spec.
- `check-files` passed for touched service and spec.
- Focused Jest still cannot start in this worktree because local module resolution cannot find `@nestjs/common`; no tests executed.
- `git diff --check` passed.

- 2026-05-24 01:39:04 append: `.task/dialer/verify-production-call-start-result/workpad.md`
