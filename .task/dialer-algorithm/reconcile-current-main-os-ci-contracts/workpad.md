# reconcile current main OS CI contracts

branch: `task/dialer-algorithm/reconcile-current-main-os-ci-contracts`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2071/reconcile-current-main-os-ci-contracts
github pr: https://github.com/consuelohq/opensaas/pull/2071
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

- 2026-08-15 11:29:55 fs.write: `.task/dialer-algorithm/reconcile-current-main-os-ci-contracts/workpad.md`
- 2026-08-15 11:34:32 fs.write: `.task/dialer-algorithm/reconcile-current-main-os-ci-contracts/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 11:33:05 `checkFiles`: passed — OK
- 2026-08-15 11:33:54 `review.run`: passed — OK
- 2026-08-15 11:34:09 `checkFiles`: passed — OK
- 2026-08-15 11:34:21 `review.run`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the current-main OS package must pass the exact shared release-gate tests when merged into `stream/dialer-algorithm`: script parity must classify the current main+stream script inventory, and trace/gateway tests must not require Bun-only SQLite imports when Vitest runs under Node.
existing local pattern: preserve production Bun runtime behavior while making test/runtime adapters explicit across Bun/Node; refresh parity data against current-main inventory rather than stale stream state.
new or changed tests: use the existing failing `script-parity-audit`, `trace-sites-gateway-live-endpoints`, and `workspace-gateway-node-end-to-end` tests as executable contracts; add only focused adapter coverage if production code must change.
focused red command: reproduce the three current-main failures individually after source preflight: parity inventory mismatch, `bun:sqlite` fixture import failure, and gateway trace request returning 500.
expected red failure: parity baseline lacks `scripts/lib/workspace-chrome.ts`; trace fixture cannot resolve `bun:sqlite` under Vitest; signed gateway trace route returns 500 through the same SQLite runtime boundary.
no-test waiver: not applicable.

## Sync evidence

- `stream/dialer-algorithm` was 28 commits behind main.
- `stream.sync` merged main cleanly in a temporary worktree but correctly refused to push because merged-tree verification failed.
- Dialer package suites passed in that merged tree: dialer 221/221, dialer-server 172 passed + 1 skipped.
- Remaining merged-tree failures are shared OS tests only.
- This task starts from current `main`; promoting it into the stream will both carry the current-main fixes and establish the required main lineage in the stream without dropping D work.

- 2026-08-15 11:29:55 append: `.task/dialer-algorithm/reconcile-current-main-os-ci-contracts/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/trace-database-schema.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/os/tests/workspace-gateway-node-end-to-end.test.ts`

- 2026-08-15 11:32:35 apply-patch: `packages/os/scripts/lib/trace-database-schema.ts`
- 2026-08-15 11:32:35 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-08-15 11:32:35 apply-patch: `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- 2026-08-15 11:32:35 apply-patch: `packages/os/scripts/lib/code-call/process.ts`

- 2026-08-15 11:34:03 apply-patch: `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## Final implementation and validation

Implementation:
- `trace-database-schema.ts` now keeps Bun `bun:sqlite` as the production path and adds a Node `node:sqlite` `DatabaseSync` adapter when `globalThis.Bun` is absent. The adapter preserves the existing `exec/query/run/all/get/close` contract and supports read-only opens.
- `trace-sites-local-read-backend.ts` now uses the shared trace DB boundary instead of importing `bun:sqlite` directly, so Vitest/Node and production Bun exercise the same domain adapter.
- `trace-sites-gateway-live-endpoints.test.ts` creates/read fixtures through the same shared DB adapter; SQL values remain parameter-bound.
- `code-call/process.ts` owns stdin stream errors. Expected early-close `EPIPE` / `ERR_STREAM_DESTROYED` races are ignored so the child `close` event determines the real result; unexpected stdin errors still return a failed runtime result.
- Added a deterministic 8 MiB stdin regression against an immediately exiting child; RED reproduced the exact unhandled `write EPIPE` before implementation.

Validation:
- RED: trace alias test failed `Cannot find package 'bun:sqlite'` under Vitest/Node.
- RED: signed workspace gateway trace request returned 500 from Bun-only trace DB open.
- RED: early-exit stdin regression produced Vitest unhandled `write EPIPE`.
- GREEN: `tests/trace-sites-gateway-live-endpoints.test.ts` 14/14 passed.
- GREEN: `tests/workspace-gateway-node-end-to-end.test.ts` 1/1 passed.
- GREEN: focused EPIPE regression 1/1 passed with no unhandled errors.
- `tests/code-call.test.ts`: 26 runtime/integration tests passed including the new regression; the only failure is unrelated current-main generated-state setup (`packages/os/manifests/tool.manifest.json` absent in this task worktree).
- `tests/trace-persistence.test.ts`: 10/11 passed; the sole failure is an unrelated branch-name assertion requiring `^task/os/` while this approved task is `task/dialer-algorithm/...`.
- `checkFiles` passed for all five changed source/test files.
- `bun run typecheck` passed (`workspace script syntax checks passed`).
- Strict review against `origin/main`: 0 issues, 0 blockers. One non-blocking docs opportunity was reported for traces, but this is runtime compatibility only and does not alter the public trace contract.

Release/sync note:
- This task started from current `main` intentionally. Promoting it into `stream/dialer-algorithm` establishes current-main lineage in the stream while preserving D work through a normal merge.
- After promotion, recompute the script-parity fixture against the combined stream inventory; the prior stale-stream baseline is expected to need at least `scripts/lib/workspace-chrome.ts`.

- 2026-08-15 11:34:32 append: `.task/dialer-algorithm/reconcile-current-main-os-ci-contracts/workpad.md`
