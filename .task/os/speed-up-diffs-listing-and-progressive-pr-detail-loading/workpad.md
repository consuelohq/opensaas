# Speed up diffs listing and progressive PR detail loading

Branch: `task/os/speed-up-diffs-listing-and-progressive-pr-detail-loading`
Stream: `stream/os`
Task PR: https://github.com/consuelohq/opensaas/pull/2627
Started: 2026-10-24

## acceptance criteria

- [x] Previously viewed PR titles, stream names, and metadata render immediately from persistent browser or server snapshots for up to 24 hours.
- [x] Server serves a stale snapshot without awaiting GitHub credential resolution/network; background refresh is single-flight, 5-minute TTL, 60-second failure backoff, stale-on-error.
- [x] PR details show a lightweight prefilled heading, author, branch and file count from cached index while loading files, and parallelize independent GitHub reads with a cap of three.
- [x] No runaway polling: index and review refresh every two minutes rather than 30/15 seconds; visibility switching is throttled.
- [x] Focused tests, TypeScript compile, bundle build and workspace review pass; no GitHub PR checks required by Ko.
- [ ] Publish task into stream and release stable through the OS release workflow; Cloudflare Worker CLI authentication is unavailable as of this log.

## test-first contract

Behavior: stale snapshots are immediate and safe after network failure, one refresh in flight per cache key; independent review reads begin without blocking on files; public HTML reuses cached PR summaries and backs off polling.

Existing pattern: DiffsLocalCache vitest tests and Diff Cockpit mocked GitHub REST tests.

New tests: stale/cache single-flight/error backoff, PR read concurrent fetching, 24-hour browser cache and throttled polling, initial PR summary. Focused red tests failed before implementation as expected for missing `getStaleWhileRevalidate`, absent initial preview, and serial GitHub calls; all green after implementation.

## findings

Live browser: `/diffs` page HTML arrived in ~306ms, but the PR index API request took ~4691ms. PR #2593 review showed multiple ~5s gateway API requests; its client had a 15-second timer. Reported 20–30-minute waits were not reproduced in the bounded browser observation. Server cache expired after 30 seconds, SSR cache after five minutes, browser index cache after two minutes. The former loader serially awaited independent GitHub endpoints.

## implementation

- `packages/os/scripts/server/services/diffs-local-cache.ts`: persisted stale-while-revalidate and failure throttling.
- `packages/os/scripts/server/services/diffs-gateway.ts`: cache-first reads outside credential fetch, longer TTL, 20s GitHub read timeout, cheap server-rendered summary lookup for PR pages.
- `packages/diff-cockpit/src/index.ts`: persistent 24-hour list cache, nonblocking refresh status, two-minute throttled index/review polling, prefilled review summary, 3-way bounded concurrent Github reads.
- `packages/os/tests/diffs-local-cache.test.ts`: two new cache tests.
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`: loader, SSR, cache and polling coverage; restored compatibility of two pre-existing assertions with Bun's typed matchers.

## validation evidence

- `bun test packages/diff-cockpit/tests/diff-cockpit.test.ts`: 46 pass / 0 fail.
- `bunx vitest run tests/diffs-hono-routes.test.ts tests/diffs-local-cache.test.ts tests/diffs-coderabbit-review-contract.test.ts tests/consuelo-sites-diffs-adapter.test.ts` from `packages/os`: 21 pass / 0 fail.
- `bunx tsc --noEmit -p packages/diff-cockpit/tsconfig.json`: pass.
- `bun build packages/os/scripts/server/services/diffs-gateway.ts --target bun --outdir /tmp/consuelo-diffs-tmp-bundle`: pass, 102 modules.
- `review.run`: 0 blocking issues and 0 issues attributed to task changes.
- An earlier workspace-root invocation of the CodeRabbit contract tests failed solely because those tests require the `packages/os` current working directory; rerunning in the correct directory passed 4/4.
- Baseline Diffs live browser behavior captured before fix; deployed behavior must be verified after promotion.

## key decisions

- Preserve fast, stale first paint but allow GitHub updates in the background; 24h retention is presentation-only, not permission to perform mutations from cached data.
- Cache scope remains workspace/repository/connection namespaced. Mutation paths invalidate relevant namespace.
- Keep concurrent GitHub reads capped at 3 and do not prefetch every large diff across the index.
- Prefer an OS stable release for code shipped in the local Hono runtime; Cloudflare edge is a proxy and its Wrangler CLI currently fails authentication (`UNAUTHENTICATED: Not logged in`). Do not claim Cloudflare was redeployed.
- No GitHub PR checks awaited, as Ko approved.

## notes for Ko

Changes are generic to Consuelo OS Diffs, not personalized; stable publication/deployment remains to be confirmed. The local runtime and Cloudflare Worker should not be conflated.

## issues / recovery

- Cloudflare `deployment.context` current/auth failed due to expired Wrangler authorization. This is a provider auth blocker to direct Worker redeploy, not a build/test failure.
- A full GitHub PR checks wait is intentionally waived by Ko; normal workspace review/test validation was run.

- 2026-10-24 03:56:58 write: `.task/os/speed-up-diffs-listing-and-progressive-pr-detail-loading/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-24 03:56:58 fs.write: `.task/os/speed-up-diffs-listing-and-progressive-pr-detail-loading/workpad.md`
