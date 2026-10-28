# fix dialer stream review round

branch: `task/dialer/fix-dialer-stream-review-round`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1768/fix-dialer-stream-review-round
github pr: https://github.com/consuelohq/opensaas/pull/1768
started: 2026-08-04

## acceptance criteria

- [x] A held Redis group lock renews its lease with a token-checked operation before the lease expires.
- [x] Lock renewal stops when the protected operation finishes, and release remains token-checked.
- [x] Deleting a group with malformed persisted JSON still removes the primary group and winner keys without throwing.
- [x] The local caller-id lock shape follows the repository `type` convention.
- [x] Focused regression tests and the affected Dialer typecheck pass before publishing.

## plan

1. Add focused failing tests for lock renewal and malformed group cleanup.
2. Implement token-checked lease renewal and defensive cleanup parsing.
3. Apply the type-only review fix, run focused tests and affected typechecks, then publish back to the dialer stream.

## current status

- Fixes implemented and locally validated; preparing the task publish back to `stream/dialer`.

## files changed

- `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`
- `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts`
- `.task/dialer/fix-dialer-stream-review-round/workpad.md`

## workspace-owned: files changed

- Added red regressions: the lease-expiry concurrency test observed `maximum = 2`, and malformed JSON rejected cleanup.
- Added token-checked Redis `PEXPIRE` heartbeat, stopped/awaited heartbeat before token-checked release, and made group cleanup parsing defensive.
- Replaced the review-flagged local interface with a type alias.

## workspace-owned: activity log

- `bun test packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`: 4 pass, 0 fail.
- `bun test packages/dialer/src`: 170 pass, 0 fail.
- `bun run --cwd packages/dialer typecheck`: pass.
- Changed-file Dialer ESLint: pass.
- Prettier initially identified the edited Dialer/workpad files; formatting was applied and will be rechecked before publish.
- `yarn nx run twenty-server:typecheck`: unavailable as a clean gate because the current stream baseline has broad unrelated errors; none reported the touched `twenty-parallel.infrastructure.ts` file.
- Exact-file server ESLint is also baseline-red on five pre-existing import/module-boundary findings; the type-alias line itself has no lint finding.

## workspace-owned: validation evidence

- 2026-08-04 19:59:12 `review.run`: passed — OK
- 2026-08-04 19:59:12 `review.run`: passed — OK
- 2026-08-04 19:59:29 `review.run`: passed — OK
- 2026-08-04 20:04:00 `verify`: passed — OK

## key decisions

- Renew the existing owner token with Redis Lua (`GET` plus `PEXPIRE`) at a fraction of the configured lease; never extend a lock after ownership changes.
- Malformed group payloads cannot reveal reverse-mapping call keys, so cleanup guarantees the known group and winner keys and avoids turning cleanup into an exception.
- The interface-to-type change is mechanical and will be covered by the affected TypeScript check rather than a behavior test.

## notes for ko

- Review source: the single requested Qodo round on stream PR 1569. CodeRabbit returned no inline findings; Codex had not responded at the second five-minute poll.

## improvements noticed

- `review.run --strict --mine --no-tests` crashed the Consuelo node on three attempts, including after a clean `consuelo restart`; direct validation evidence is preserved above and the crashing review check was not looped again.

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-04 19:52:46 apply-patch: `.task/dialer/fix-dialer-stream-review-round/workpad.md`
- 2026-08-04 19:53:19 apply-patch: `packages/dialer/src/infrastructure/redis/redis-parallel-store.test.ts`
- 2026-08-04 19:54:07 apply-patch: `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`
- 2026-08-04 19:54:07 apply-patch: `packages/twenty-server/src/engine/core-modules/consuelo-api/infrastructure/twenty-parallel.infrastructure.ts`
- 2026-08-04 19:54:51 apply-patch: `packages/dialer/src/infrastructure/redis/redis-parallel-store.ts`

- 2026-08-04 19:59:58 apply-patch: `.task/dialer/fix-dialer-stream-review-round/workpad.md`
