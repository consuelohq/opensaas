# fix Diffs post-auth index retry

branch: `task/os/fix-diffs-post-auth-index-retry`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2362
started: 2026-09-01

## acceptance criteria

- [ ] The first live PR-index load after completing GitHub OAuth/handoff does not leave Diffs in a 401 error state.
- [ ] Retry is bounded and only handles the observed transient workspace-session 401; persistent authorization failures still surface.
- [ ] The normal PR index path remains single-request when authorization is already settled.
- [ ] Existing Diff Cockpit rendering/cache behavior remains intact.
- [ ] The fix is promoted into `stream/os`, released/updated to the active local runtime, and verified through the real `internal.consuelohq.com/diffs` post-auth flow.

## plan

1. Add a focused rendered-client contract for bounded 401 retry and prove it red.
2. Implement a small retry helper in the shared Diff Cockpit index loader with fixed delays and a strict retry cap.
3. Run Diff Cockpit focused tests plus relevant OS Diffs/runtime bundle tests, review, and full verify.
4. Push/promote to `stream/os`, release/update the active local OS runtime as needed, clear/reconnect GitHub only if required to reproduce the post-auth transition, and verify the first page load settles without manual reload.

## Test-first contract

behavior under test: after the cross-site GitHub OAuth/handoff flow, the initial browser request to `/gateway/diffs/.../pulls` may receive one transient workspace-session 401 before the browser/session context settles; Diffs should retry that 401 a small bounded number of times and render live PRs once the same endpoint becomes authorized.
existing local pattern: `packages/diff-cockpit/src/index.ts` owns the browser `loadIndex()` fetch and `packages/diff-cockpit/tests/diff-cockpit.test.ts` protects generated-client behavior with exact script-contract assertions; OS consumes that source through `scripts/server/vendor/diff-cockpit.ts`.
new or changed tests: extend `renderIndexPage` contract assertions to require a bounded 401 retry helper, exact retry cap/delays, use of that helper by `loadIndex`, and no retry for non-401 responses.
focused red command: `bun test tests/diff-cockpit.test.ts` from `packages/diff-cockpit`.
expected red failure: the current generated client calls `fetch(apiPath, ...)` directly and has no bounded 401 retry helper.
no-test waiver: not applicable.

## files changed

- `packages/diff-cockpit/src/index.ts` — add a bounded 401-only retry for the live PR-index request (250ms, 1s, 2.5s; max three retries after the initial request).
- `packages/diff-cockpit/tests/diff-cockpit.test.ts` — protect the retry cap/delays and require `loadIndex()` to use the retry helper.

## validation

- Red: `bun test tests/diff-cockpit.test.ts` from `packages/diff-cockpit` — 39 passed / 1 failed exactly on the missing retry contract.
- Green: same focused suite — 40 passed / 0 failed, 405 expectations.
- Adjacent integration/distribution proof: Diff Cockpit + OS Diffs Hono routes + runtime bundle workspace closure — 52 passed / 0 failed, 457 expectations.
- `review.run --strict --mine` — 0 issues/blockers in this change; one pre-existing project-level note that no Nx `typecheck` target exists.
- Full `verify` against `origin/stream/os` — passed and publish-valid.

## key decisions

- The GitHub connection now completes successfully: OAuth exchange, installation verification, one-time handoff claim, and source-control configuration all return successfully.
- The remaining defect is a separate post-auth browser race: the first automatic PR-index request returned 401, while the same-origin request seconds later returned 200 and a reload populated the full Diffs UI.
- The edge route explicitly maps an invalid workspace session to 401 for non-HTML requests; the shared Diff Cockpit client currently treats that one response as terminal. A bounded client retry is lower-risk than relaxing workspace-session authorization.
- The OS vendor module is only a re-export of the shared Diff Cockpit source, so the product fix belongs in `packages/diff-cockpit/src/index.ts`, not a duplicated OS implementation.

## notes for ko

- The real Diffs page is now connected to `consuelohq/opensaas` and loads PRs after a reload. This task removes the need for that reload.

## improvements noticed

- The browser error state gives only the status code; if this path becomes noisy again, a safe error category from the edge could make session races distinguishable from credential/API failures without weakening auth.

## errors i ran into

- First `review.run` timed out at 120s; one retry with a larger timeout completed cleanly with no findings in this change.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-01 01:59:45 write: `.task/os/fix-diffs-post-auth-index-retry/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 01:59:45 fs.write: `.task/os/fix-diffs-post-auth-index-retry/workpad.md`

- 2026-09-01 01:59:57 apply-patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-09-01 02:00:18 apply-patch: `packages/diff-cockpit/src/index.ts`

## workspace-owned: validation evidence

- 2026-09-01 02:04:02 `review.run`: passed — OK
- 2026-09-01 02:06:17 `verify`: passed — OK
- 2026-09-01 02:06:29 `verify`: passed — OK

- 2026-09-01 02:06:53 apply-patch: `.task/os/fix-diffs-post-auth-index-retry/workpad.md`