# Hotfix Google OAuth callback routing to main

branch: `task/os/hotfix-google-oauth-callback-routing-to-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1983/hotfix-google-oauth-callback-routing-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1983
started: 2026-08-15

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

- 2026-08-15 01:29:33 fs.write: `.task/os/hotfix-google-oauth-callback-routing-to-main/workpad.md`
- 2026-08-15 01:31:19 fs.write: `.task/os/hotfix-google-oauth-callback-routing-to-main/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 01:30:42 `review.run`: passed — OK
- 2026-08-15 01:31:00 `review.run`: passed — OK
- 2026-08-15 01:31:13 `verify`: passed — OK
- 2026-08-15 01:32:18 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: on clean main, a valid durable MCP/web Google OAuth state must survive separate handler/store instances and a Google provider-error callback must be routed to the owning OAuth flow instead of the device-authorization fallback.
existing local pattern: `packages/os/tests/os-device-authority-worker.test.ts` exercises MCP/web Google callback routing; the already-validated #1979 patch adds shared `StorageLike` backing with separate `DurableStore` handler instances.
new or changed tests: transplant only the two #1979 durable callback-boundary regression tests onto main before production code.
focused red command: `bunx vitest run packages/os/tests/os-device-authority-worker.test.ts -t "durable Google callback"`
expected red failure: MCP returns 400 device fallback instead of 302 OAuth error redirect; web returns HTML device fallback instead of JSON `invalid_login`.
no-test waiver: not applicable.

## hotfix scope

- Source of validated behavior: #1979 / `dc8be15c45a739835d43b4cfa245281a7cd0dc9a`.
- Destination base: clean `main` at `f432752db617b666b2c5e24449ad87a94da5e07b`.
- Transplant only the three product/test-file hunks from #1979; do not include unrelated `stream/os` work or old task metadata.

- 2026-08-15 01:29:33 append: `.task/os/hotfix-google-oauth-callback-routing-to-main/workpad.md`

## validation and publish decision

- Focused clean-main TDD red: 2/2 durable Google callback tests failed with the expected MCP/web misrouting before production hunks.
- Focused green: 2/2 passed after applying only the two production hunks from #1979.
- Device Authority worker: 31/31 passed.
- Canonical/auth/control-plane regression surface: 66/66 passed across 7 OS test files.
- Workspace test-selection tests: 32/32 passed.
- OS syntax/typecheck wrapper: passed.
- Strict review pinned to immutable production base `f432752db617b666b2c5e24449ad87a94da5e07b`: 3 files, 0 blocking issues.
- Full verify pinned to the same immutable production base: `publishValid=true`.
- GitHub remote `main` was independently resolved and is still exactly `f432752db617b666b2c5e24449ad87a94da5e07b`.
- Existing `stream/os` PR #1972 contains 60 files from unrelated OS work, so this hotfix must remain separate from the stream and target `main` directly to avoid bundling unrelated changes.
- Planned publish path: push this task branch, keep it task-only (do not merge into stream), retarget PR #1983 from `stream/os` to `main`, merge only after GitHub reports the three-file diff/checks are safe, then run the targeted Device Authority production release.

- 2026-08-15 01:31:19 append: `.task/os/hotfix-google-oauth-callback-routing-to-main/workpad.md`
