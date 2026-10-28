# Accept equal sequence online refresh

branch: `task/os-native/accept-equal-sequence-online-refresh`
stream: `stream/os-native`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1568/accept-equal-sequence-online-refresh
github pr: https://github.com/consuelohq/opensaas/pull/1568
started: 2026-07-22

## acceptance criteria

- [x] A successful equal-sequence `status.get` refresh restores a retained offline/unknown snapshot to online.
- [x] Lower-sequence refresh responses remain rejected.
- [x] Subscription equal-sequence deduplication and local-offline recovery remain unchanged.
- [ ] Focused tests, typecheck, strict review, full verify, automated reviews, and merge into `stream/os-native` complete.

## plan

1. Add a deterministic retained-offline equal-sequence refresh test before production edits.
2. Allow equality only for authoritative successful refresh responses; keep lower-sequence rejection and event policy unchanged.
3. Run focused tests, typecheck, strict review, full verify, CodeRabbit/Codex disposition, and merge into `stream/os-native`.

## current status

- Late Codex P2 reproduced, fixed, and locally validated.
- Strict review and full verify pass; awaiting publish, automated review disposition, and stream merge.

## files changed

- `.task/os-native/accept-equal-sequence-online-refresh/workpad.md`
- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-22 22:45:26 `review.run`: passed — OK
- 2026-07-22 22:45:34 `verify`: passed — OK

## key decisions

- A successful request/response refresh is authoritative evidence that the engine is online, so equality is accepted for refresh only.
- Subscription events retain the stricter equal-sequence rule to avoid duplicate notifications.

## notes for ko

- Grok remains skipped under Ko’s explicit instruction.
- This follow-up starts from the latest `stream/os-native` head after PR #1566.
- No real-machine service, installer, updater, or runtime mutation is permitted or needed.

## improvements noticed

- none yet

## issues and recovery

- Initial task discovery batch did not propagate `taskSession` to nested reads (`trc_b018ba5c02dd`); direct task-scoped calls were used.
- Semantic explore returned unrelated indexed results (`trc_042ce35dcabd`); exact task-scoped source inspection identified `acceptSnapshot`, `refresh`, and the existing race tests (`trc_d9fe93e0e27f`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os-native): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`


## Test-first contract

- Behavior under test: a client seeded with a retained offline snapshot must normalize to the engine-provided online snapshot when `status.get` succeeds at the same sequence.
- Existing pattern: injectable transport fixtures in `packages/os/tests/native-lifecycle-client.test.ts`.
- Changed test: add one focused equal-sequence refresh recovery case.
- Focused red command: `bun run --cwd packages/os test tests/native-lifecycle-client.test.ts`.
- Expected red failure: `refresh()` returns the retained offline snapshot instead of the same-sequence online response.
- Regression constraints: the sequence-9-versus-sequence-8 stale refresh test, stale subscription test, and local offline event recovery tests must remain green.

## source finding

- Codex comment `3634309222`: successful equal-sequence refreshes must clear a retained offline or unnormalized initial snapshot while preserving the stale lower-sequence guard.


## implementation and validation

- Added a retained-offline equal-sequence refresh regression test.
- Red: the new test returned the offline retained state while the prior nine tests passed (`trc_49b3bc7184c4`).
- Fix: `acceptSnapshot` accepts an `allowEqual` option; only successful `refresh()` calls enable it. Lower sequences remain rejected and subscription calls retain existing equality rules.
- Green: 10/10 focused lifecycle tests and OS package typecheck passed (`trc_dd279d565b77`).
- Grok remains explicitly waived by Ko.
- No real-machine install, update, restart, service, or runtime mutation occurred.


## final local validation

- Strict workspace review passed with zero findings (`trc_9f15075e37f0`).
- Full verify passed and remained publish-valid (`trc_85a491938de9`).
- Publish scope is limited to the workpad, lifecycle client, and lifecycle tests; generated task metadata remains local.


- `task.push` failed because the facade injected unsupported `--task-session` (`trc_0dc5675a5a3a`). Use the approved OS-scoped Git Data API fallback with a non-force task-ref update.
