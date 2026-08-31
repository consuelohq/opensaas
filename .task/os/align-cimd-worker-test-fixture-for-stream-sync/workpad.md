# align cimd worker test fixture for stream sync

branch: `task/os/align-cimd-worker-test-fixture-for-stream-sync`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1980/align-cimd-worker-test-fixture-for-stream-sync
github pr: https://github.com/consuelohq/opensaas/pull/1980
started: 2026-08-15

## acceptance criteria

- [x] Align the stream-side ChatGPT CIMD worker test fixture with current `main` canonical workspace/directory setup so `stream.sync` merges cleanly.
- [x] Change test setup only; do not change production OAuth or routing behavior.
- [ ] The targeted CIMD worker test passes before and after the fixture alignment.
- [ ] Strict review/full verify pass and the integration task is promoted to `stream/os`.

## plan

1. Run the existing CIMD worker test as a characterization baseline.
2. Replace only its older stream fixture setup with the current `main` setup (`workspaceId` + verified canonical directory).
3. Re-run the targeted test, inspect the one-file product diff, review/verify, push, and promote.

## current status

- Fixture alignment is complete. Strict review and full verify are green/publish-valid; promotion to `stream/os` is next.

## files changed

- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 01:21:11 `review.run`: passed — OK
- 2026-08-15 01:21:23 `verify`: passed — OK
- 2026-08-15 01:21:37 `verify`: passed — OK

## key decisions

- Prefer the `main` fixture because current Device Authority OAuth tests require canonical workspace identity; retain the stream's test assertions/behavior unchanged.

## notes for ko

- Direct `code.call`/`mac.exec` targeted-test requests repeatedly lost MCP transport before returning a result. No production code changed; strict review and the full publish gate completed successfully afterward.

## improvements noticed

- none yet

## issues and recovery

- No production code is being changed in this integration task.
- Targeted characterization execution could not return because the OS execution channel repeatedly reported `Connection failed` while short OS calls remained healthy. This acceptance item remains intentionally unchecked rather than overstating evidence.

## Test-first contract

- behavior under test: existing ChatGPT CIMD authorization/token exchange remains green with current canonical identity fixture setup.
- existing local pattern: `origin/main` already contains the canonical `workspaceId` + `createVerifiedCanonicalDirectory` setup for this exact test.
- new or changed tests: test fixture only; no new assertion or production behavior.
- focused red command: not applicable; this is conflict reconciliation in test code, not a production behavior change.
- expected red failure: none.
- no-test waiver: RED waived because this task changes no production code; use the same targeted CIMD test before and after as characterization evidence.
- Strict review: zero issues/blockers (`trc_69c9c63378d2`).
- Full verify: `passed=true`, `publishValid=true` (`trc_9cb22b974105`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-15 01:20:33 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-15 01:21:31 apply-patch: `.task/os/align-cimd-worker-test-fixture-for-stream-sync/workpad.md`
