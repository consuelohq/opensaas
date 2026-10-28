# fix diffs cache freshness and progressive loading

branch: `task/os/fix-diffs-cache-freshness-and-progressive-loading`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2491
started: 2026-09-21

## acceptance criteria

- [ ] `/diffs` stops serving multi-day-old PR/stream metadata when newer GitHub state exists; freshness is maintained by the local/background cache path rather than moving steady-state GitHub compute to Cloudflare.
- [ ] Opening an inner PR page shows useful cached metadata/file navigation immediately, then reconciles with fresher data in the background without a blank/choppy all-at-once load.
- [ ] Cache keys, TTL/revalidation, invalidation, and background refresh ownership are explicit and covered by regression tests so stale snapshots cannot live indefinitely.
- [ ] Large PRs progressively hydrate/render bounded chunks instead of blocking the page on all files/highlighting at once.
- [ ] Existing Diffs behavior (filters, comments/checks/commits panel, file selection, mergeability controls) remains intact.
- [ ] Focused tests, review/verify, and browser/runtime proof pass against `origin/stream/os` before promotion.

## plan

1. Reproduce the live stale list and inner-page loading behavior, capture the relevant request/runtime evidence, and compare it with current GitHub state.
2. Trace the existing local snapshot/cache/background refresh implementation and identify why freshness or invalidation is not converging.
3. Freeze the cache + progressive-loading contract in focused tests and run the new behavior RED before production edits.
4. Make the smallest change that restores bounded freshness and stale-while-revalidate semantics while keeping steady-state refresh work local/background.
5. Add progressive metadata/file loading for large PRs without regressing current controls or diff rendering.
6. Run focused GREEN tests, static/type checks, browser proof on `/diffs` and a large PR, then review/verify against `origin/stream/os` and promote through the task workflow.

## initial assumptions

- Live browser evidence on 2026-09-20 shows `/diffs` rendering stream entries 16-88 days old while the user's current GitHub/Graphite view contains materially newer stream activity; the stale symptom is real, not just a visual timestamp issue.
- The inner PR route reaches DOM `complete` quickly but remains at `Loading live GitHub data…`, `Loading…`, and `0 commits` well after navigation, so the slow experience is dominated by post-load data/render work rather than document navigation itself.
- The implementation should preserve the existing local/background cache design unless code/runtime evidence shows that design itself is the root cause.

## Test-first contract

behavior under test: Diffs read snapshots survive OS-process restarts in the node-local cache, expose deterministic ETags, refresh expired entries with single-flight loading, and can be embedded into index/review HTML immediately; review-page revalidation survives transient 401s and long diffs render in bounded browser batches.
existing local pattern: standalone `packages/diff-cockpit` already tests durable snapshot first paint + ETag/304 behavior, while OS uses `resolveConsueloHomeLayout(...).nodeCacheDir` for node-local cache state and atomic 0600 writes elsewhere.
new or changed tests: add `packages/os/tests/diffs-local-cache.test.ts` for persisted TTL + single-flight behavior; extend the existing Diffs source-contract test to require OS initial-snapshot/ETag wiring; extend `packages/diff-cockpit/tests/diff-cockpit.test.ts` to require transient-auth retry and progressive diff batching in the generated review client.
focused red command: `bun test packages/os/tests/diffs-local-cache.test.ts packages/os/tests/diffs-coderabbit-review-contract.test.ts && bun test packages/diff-cockpit/tests/diff-cockpit.test.ts`
expected red failure: the new local cache module does not exist; OS render paths still pass `null, ''` to Diffs renderers; review client has no 401 retry and `renderLongDiffs()` maps every file into one synchronous `innerHTML` write.
no-test waiver: none; this is user-visible behavior with deterministic cache/render contracts

red evidence (2026-09-20 local):
- OS focused Vitest run failed as expected because `scripts/server/services/diffs-local-cache.ts` does not exist; the updated first-paint contract also cannot read that file.
- Diff Cockpit focused package run: 41 passed / 1 failed; only the new progressive-hydration contract failed because the review client lacks `reviewAuthRetryDelaysMs`/`fetchReviewWithAuthRetry` and progressive batching.
- Recovery note: the first OS runner attempt used an invalid `bun ... x` invocation; reran with the package cwd and `bun run test` to capture the real RED signal above.

## evidence / root cause

- Live `/gateway/diffs/.../pulls` returned current GitHub data (for example stream/dialer updated at `2026-09-21T02:24:28Z`) while first-paint `/diffs` showed multi-day-old localStorage rows. The freshness source is healthy; the wait is in the UI/cache handoff.
- OS `renderDiffsIndex` and `renderDiffsReview` explicitly pass `null, ''`, bypassing Diff Cockpit's existing server-side snapshot hydration and ETag first-paint contract.
- OS JSON routes use generic `jsonResponse`, so the client's `If-None-Match` headers cannot produce 304s and every successful poll reparses/re-renders the full payload.
- The index client retries transient 401s (250/1000/2500 ms), explaining the long stale first paint. The review client does not retry 401 at all, which can leave an inner PR permanently on `Loading live GitHub data…` after an auth handoff race.
- Review hydration is monolithic and `renderLongDiffs()` synchronously renders every changed file. PR #1991 currently has 100 files, matching the observed inner-page jank.

## files changed

- `packages/os/scripts/server/services/diffs-local-cache.ts` — bounded node-local persisted JSON cache with deterministic ETags, TTLs, single-flight refresh, secure atomic writes, and namespace invalidation.
- `packages/os/scripts/server/services/diffs-gateway.ts` — routes Diffs reads through the node-local cache, embeds recent index/review snapshots into HTML first paint, and invalidates persisted data after writes.
- `packages/os/scripts/server/routes/diffs.ts` — sends ETag-aware JSON responses and 304s for unchanged index/review data.
- `packages/diff-cockpit/src/index.ts` — expires browser-local inbox snapshots, retries transient review auth races, and progressively renders large diffs in bounded batches.
- `packages/os/tests/diffs-local-cache.test.ts` — persisted cache + expiry/single-flight coverage.
- `packages/os/tests/diffs-hono-routes.test.ts` — end-to-end ETag/304 and server-side first-paint hydration coverage.
- `packages/os/tests/diffs-coderabbit-review-contract.test.ts` and `packages/diff-cockpit/tests/diff-cockpit.test.ts` — cache/progressive-loading regression contracts.

## key decisions

- Keep GitHub compute on the local OS node. Cloudflare remains transport/auth only; no new GitHub fetch or cache-refresh work moved to Edge.
- Persist Diffs snapshots under the node cache directory with `0700` directory / `0600` file permissions. Browser `localStorage` is now only a short (2 minute) fallback, not an indefinite source of truth.
- API read TTL remains 30 seconds for PR/index data; HTML first paint may use a persisted snapshot for at most 5 minutes, then immediately revalidates through the signed local gateway.
- API revalidation uses deterministic ETags + `If-None-Match`/304 so unchanged 15s/30s polling does not reparse or rerender full payloads.
- Large review pages synchronously paint the first 8 changed files, then append 8-file batches through idle callbacks; direct file/comment jumps force-render the needed batch before scrolling.

## notes for ko

- Root cause was two-layered: the OS HTML route deliberately discarded the cache (`null, ''`) even though Diff Cockpit already supported server snapshot hydration, while the review client lacked the index page's transient-401 retry. On large PRs, all file diffs were also rendered in one synchronous DOM write.
- Focused GREEN: OS Diffs/runtime tests 25/25; Diff Cockpit 42/42; OS syntax/typecheck passed. Source-only Diff Cockpit TypeScript also passes.
- The package-wide Diff Cockpit `tsc` command still reports two pre-existing Bun matcher typing errors (`toHaveProperty` at test lines 91-92); those lines are untouched by this task and runtime/package tests pass.
- Strict workspace review against `origin/stream/os`: 0 blocking findings after fixing the initial error-handling findings.

## improvements noticed

- The Diffs browser/client and OS server currently have separate cache primitives. Long term, a small shared cache-response contract could reduce duplicated ETag/cache-header logic without changing ownership.

## errors i ran into

- First RED runner attempt used an invalid `bun ... x` command; reran with package cwd and the actual package script.
- `decideNext` evidence marking hit a transient SQLite `database is locked` error when multiple marks were attempted in parallel; no product state was affected.
- Diff Cockpit package-wide `tsc` has the pre-existing Bun matcher typing issue noted above; source-only `src/index.ts` typecheck is green.
- Initial strict review flagged four async-without-local-catch static-rule findings; converted those promise paths to explicit chains and reran review clean.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/diff-cockpit/package.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/tsconfig.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/consuelo-sites-diffs-adapter.ts`
- `packages/os/scripts/server/logger.ts`
- `packages/os/scripts/server/middleware/errors.ts`
- `packages/os/scripts/server/routes/diffs.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/scripts/server/services/diffs-local-cache.ts`
- `packages/os/scripts/server/vendor/diff-cockpit.ts`
- `packages/os/skills/debugger/SKILL.md`
- `packages/os/tests/diffs-coderabbit-review-contract.test.ts`
- `packages/os/tests/diffs-hono-routes.test.ts`

## workspace-owned: validation evidence

- 2026-09-21 03:41:53 `review.run`: passed — OK
- 2026-09-21 03:43:40 `review.run`: passed — OK

- 2026-09-21 03:43:55 apply-patch: `.task/os/fix-diffs-cache-freshness-and-progressive-loading/workpad.md`