# Guard lifecycle refresh monotonicity

branch: `task/os-native/guard-lifecycle-refresh-monotonicity`
stream: `stream/os-native`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1566/guard-lifecycle-refresh-monotonicity
github pr: https://github.com/consuelohq/opensaas/pull/1566
started: 2026-07-22

## acceptance criteria

- [x] A delayed `status.get` response cannot replace a newer subscribed lifecycle snapshot.
- [x] The equal-sequence local-offline recovery behavior remains intact.
- [x] Focused tests, typecheck, strict review, and full verify pass.
- [x] The follow-up PR merges only into `stream/os-native`; Grok remains waived by Ko.

## plan

1. Add a deterministic deferred-refresh race test before production edits.
2. Route successful refresh snapshots through the same monotonic acceptance gate as subscription events.
3. Run focused tests, typecheck, strict review, full verify, automated review disposition, and merge into the stream.

## current status

- Post-merge Codex P2 reproduced, fixed, and locally validated.
- Implementation and local validation are complete; awaiting publish, automated review disposition, and merge into `stream/os-native`.

## files changed

- `.task/os-native/guard-lifecycle-refresh-monotonicity/workpad.md`
- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-22 22:36:05 `review.run`: passed — OK
- 2026-07-22 22:36:13 `verify`: passed — OK

## key decisions

- Successful `refresh()` responses use the same `acceptSnapshot()` gate as subscription events.
- A stale refresh returns the retained newer snapshot; equal-sequence acceptance remains limited to local offline recovery.

## notes for ko

- This follow-up originates from Codex comment `3634247936` submitted immediately before PR #1558 merged.
- Grok remains explicitly waived by Ko.
- No real-machine service, updater, installer, or runtime mutation occurred.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-native): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/native-lifecycle-client.ts`
- `packages/os/tests/native-lifecycle-client.test.ts`
- `packages/workspace/senior-engineer.md`

## Test-first contract

- Behavior under test: while `refresh()` is awaiting an older status response, a newer subscription event advances the client; resolving the older refresh must return and retain the newer snapshot.
- Existing pattern: lifecycle-client Vitest contract tests with injectable transports and explicit event emission.
- Changed test: `packages/os/tests/native-lifecycle-client.test.ts`.
- Focused red command: `bun run --cwd packages/os test tests/native-lifecycle-client.test.ts`.
- Expected red failure: `refresh()` resolves to and stores the stale lower-sequence status snapshot.

## discovery

- Source: post-merge Codex P2 comment `3634247936` on PR #1558.
- Scope: `refresh()` successful response path bypasses `acceptSnapshot()`; subscription events already use it.
- Owner instruction: skip Grok; complete all other validation and merge steps.
- Recovery: the initial discovery batch did not propagate `taskSession` to its nested edit call (`trc_92f88999e528`); direct task-scoped calls are used instead.


## implementation and validation

- Added a deterministic deferred `status.get` race test.
- Red: stale sequence 8 replaced subscribed sequence 9 (`trc_d44fbdce5ec5`).
- Fix: route successful refresh snapshots through `acceptSnapshot()` and return the retained current snapshot.
- Green: 9/9 focused tests and package typecheck passed (`trc_6d402e054667`).


## final validation

- Strict workspace review passed with zero findings (`trc_692da7b8aa76`).
- Full verify passed and remained publish-valid (`trc_11a911c47274`).
- Publish only the workpad, lifecycle client, and lifecycle test; generated task metadata remains local.


- `task.push` failed because the facade injected unsupported `--task-session` (`trc_a0f273ba8f5a`). Use the approved OS-scoped Git Data API fallback with a non-force ref update.
