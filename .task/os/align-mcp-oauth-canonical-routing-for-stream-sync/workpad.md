# align mcp oauth canonical routing for stream sync

branch: `task/os/align-mcp-oauth-canonical-routing-for-stream-sync`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1981/align-mcp-oauth-canonical-routing-for-stream-sync
github pr: https://github.com/consuelohq/opensaas/pull/1981
started: 2026-08-15

## acceptance criteria

- [x] Align stream MCP OAuth callback completion with current `main` canonical Consuelo identity/workspace routing.
- [x] Preserve the existing ChatGPT client/redirect binding validation exactly once in the merged file.
- [x] A ChatGPT CIMD reconnect issued for a canonical Consuelo user introspects with that canonical user ID, not `google:<sub>`.
- [x] Missing canonical identity fails closed rather than silently routing through a legacy Google-subject account.
- [ ] Strict review/full verify pass; after promotion, `stream.sync` merges current `main` without duplicate OAuth declarations.

## plan

1. Add the canonical ChatGPT CIMD reconnect contract already present on `main`; run it RED against `stream/os`.
2. Align `mcp-oauth.ts` with the canonical identity resolution already on `main`, without duplicating callback-binding helpers.
3. Run focused OAuth/worker/routing tests, inspect diff, strict review, and full verify.
4. Promote to `stream/os`, rerun `stream.sync`, then merge stream PR #1972 only after stream verification passes.

## current status

- The four affected OAuth/worker files now match current `main` exactly; canonical reconnect/fail-closed contracts are green, strict review is clean, and full verify is publish-valid. Promotion and a successful `stream.sync` remain.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 01:25:38 `review.run`: passed — OK
- 2026-08-15 01:25:49 `verify`: failed — COMMAND_FAILED
- 2026-08-15 01:27:03 `review.run`: passed — OK
- 2026-08-15 01:27:13 `verify`: failed — COMMAND_FAILED
- 2026-08-15 01:27:43 `review.run`: passed — OK
- 2026-08-15 01:27:54 `verify`: passed — OK
- 2026-08-15 01:28:05 `verify`: passed — OK

## key decisions

- Treat current `main` as the canonical integration target for this file. The callback-binding helper implementation is identical on both sides; only one copy must remain after sync.
- Do not touch unrelated broad facade-suite failures surfaced by the noncritical package test.

## notes for ko

- The three production files now match `origin/main` byte-for-byte. This intentionally pre-aligns the stream with the canonical OAuth implementation so the next `stream.sync` cannot duplicate the callback-binding helper block.

## improvements noticed

- none yet

## issues and recovery

- Previous `stream.sync` check failed before pushing, so `origin/stream/os` remains safe and unsynchronized; this task is isolated PR #1981.
- The broad focused-test packet lost MCP transport before returning evidence; no mutation was involved. Narrow focused tests then returned normally.

## Test-first contract

- behavior under test: ChatGPT CIMD OAuth callback resolution uses the canonical Consuelo identity/account and fails closed when canonical identity is unavailable.
- existing local pattern: current `main` already contains focused worker contracts for canonical reconnect and unavailable canonical identity.
- new or changed tests: port the canonical CIMD reconnect contract into the stream task first; add the fail-closed contract if needed for coverage parity.
- focused red command: run only `should use the canonical Consuelo account for ChatGPT CIMD reconnect` from `os-device-authority-worker.test.ts`.
- expected red failure: legacy stream callback looks up `google:google-sub-123`, so the canonical-user workspace cannot be resolved and the OAuth callback/token flow does not produce an active token with `sub: user_canonical_123`.
- no-test waiver: none.
- RED: canonical CIMD callback returned 403 instead of the expected 302 on legacy stream behavior (`trc_8fe69853c702`; full no-stamp gate also RED at `trc_d7a9e0a134f9`).
- GREEN: canonical reconnect, canonical-identity-unavailable fail-closed, and existing CIMD/resource-echo contracts all pass (`trc_72a41aaa8aa2`).
- Integration structure: all three production OAuth files match current `origin/main` byte-for-byte (`trc_c28d1e717eda`).
- Final integration structure: the three production files plus `os-device-authority-worker.test.ts` all match `origin/main` byte-for-byte (`trc_4d799751cdbf`).
- Strict review: zero issues/blockers (`trc_60b0e5930228`).
- Full verify: `passed=true`, `publishValid=true` (`trc_4075cc967fe5`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-15 01:24:44 apply-patch: `.task/os/align-mcp-oauth-canonical-routing-for-stream-sync/workpad.md`

## workspace-owned: files read

- `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-15 01:24:58 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-15 01:26:09 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- 2026-08-15 01:26:09 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- 2026-08-15 01:26:09 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- 2026-08-15 01:26:27 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-15 01:26:54 apply-patch: `.task/os/align-mcp-oauth-canonical-routing-for-stream-sync/workpad.md`

- 2026-08-15 01:27:30 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-08-15 01:27:59 apply-patch: `.task/os/align-mcp-oauth-canonical-routing-for-stream-sync/workpad.md`
