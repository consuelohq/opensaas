# hydrate PR pages from shared cache

branch: `task/diff-cockpit/hydrate-pr-pages-from-shared-cache`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/873/hydrate-pr-pages-from-shared-cache
github pr: https://github.com/consuelohq/opensaas/pull/873
started: 2026-06-09

## acceptance criteria

- [x] PR route checks shared edge API cache for `/api/:owner/:repo/pull/:number` before rendering HTML.
- [x] Cached PR JSON is embedded safely into the page and renders title, metadata, file tree, selected file, diffs, and drawer immediately.
- [x] Cache miss keeps the existing loading shell and client fetch fallback.
- [x] Client still fetches the API in the background and reconciles with fresh JSON.
- [x] Cron refresh warms a bounded active PR detail set across devices, not only fingerprint-changed PRs.
- [x] Focused tests cover server hydration, cache miss fallback, background fetch, and bounded cron warming.
- [x] Typecheck, review, and verify pass. Live deployment smoke is deferred until Ko approves the PR.
## Test-first contract

Behavior under test:
- `createWorker` renders initial review data into PR HTML when the shared edge cache contains `/api/:owner/:repo/pull/:number`.
- `renderReviewClientScript` consumes the embedded payload before fetching and still performs the background fetch.
- Cron refresh sends a bounded warm set derived from current active/recent PR fingerprints, with changed PRs included.

Existing pattern to follow:
- `packages/diff-cockpit/tests/diff-cockpit.test.ts` uses in-memory cache/fetcher assertions for Worker route behavior.
- `cron_jobs/tests/cron_jobs.test.ts` uses deterministic fetchers and `runCronJobs` state/log assertions.
- Existing cache refresh tests assert cached API responses avoid extra fetches.

Intended tests:
- Add a diff-cockpit worker test for cached PR page hydration and cache miss shell fallback.
- Extend/adjust review page client script assertions to require initial data bootstrap and background fetch.
- Extend cron job tests to assert active/recent PR detail warming includes unchanged active PRs and caps the list.

Focused red command:
- `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts && bun --cwd cron_jobs test tests/cron_jobs.test.ts`

Expected red failure:
- Hydration markers and bounded warm-list expectations fail before implementation.

No-test waiver:
- None. This is behavior that affects customer-facing page load and cache correctness.

## plan

1. Read the current PR route, review page renderer/client script, cache helpers, cron job refresh path, and focused tests.
2. Add failing assertions for server hydration and cron warm-set behavior.
3. Implement shared-cache hydration with safe JSON embedding and client bootstrap.
4. Implement bounded active/recent cron warm set.
5. Run focused tests, typecheck, review, verify, push, promote PR.

## current status

- Task started from `stream/diff-cockpit`.
- Read the relevant PR route, review page renderer/client script, cache helpers, cron refresh path, and existing tests.
- Test-first contract defined before production edits.

## files changed

- `cron_jobs/diff_cockpit/cron.json`
- `cron_jobs/index.ts`
- `cron_jobs/README.md`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `cron_jobs/diff_cockpit/cron.json`
- `cron_jobs/index.ts`
- `cron_jobs/README.md`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-09 18:52:02 fs.write: `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/workpad.md`
- 2026-06-09 19:01:16 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:01:45 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:02:27 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:03:01 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:03:57 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:04:23 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:05:25 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:05:51 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:06:12 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:06:37 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:07:27 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:09:03 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-09 19:10:21 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:11:44 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:12:42 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:13:31 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:14:52 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:15:01 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:15:11 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:15:19 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:16:02 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:16:25 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:16:59 fs.patch: `cron_jobs/index.ts`
- 2026-06-09 19:17:59 fs.write: `cron_jobs/diff_cockpit/cron.json`
- 2026-06-09 19:18:52 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-09 19:21:07 fs.patch: `cron_jobs/README.md`
- 2026-06-09 19:24:11 fs.patch: `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/workpad.md`
- 2026-06-09 19:25:01 fs.patch: `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/workpad.md`
- Read `cron_jobs/index.ts` refresh path and fingerprint logic.
- Read `packages/diff-cockpit/src/index.ts` PR route, review renderer, client script, and cache helpers.
- Read `packages/diff-cockpit/tests/diff-cockpit.test.ts` cache tests.

## workspace-owned: validation evidence
- Focused red: `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts` failed before implementation because the cached PR page hydration marker was missing.
- Focused red: `bun test cron_jobs/tests/cron_jobs.test.ts` failed before implementation because `selectWarmPullNumbers` was not exported.
- Focused green: `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts` passed with 28 tests / 254 expectations.
- Focused green: `bun test cron_jobs/tests/cron_jobs.test.ts` passed with 9 tests / 16 expectations.
- Typecheck: `bun --cwd=packages/diff-cockpit run typecheck` passed.
- Syntax: `checkFiles` passed for changed TypeScript files.
- Review: `review.run --base stream/diff-cockpit --no-tests` passed with 0 issues from this change; one pre-existing project typecheck target finding remains.
- Verify: `verify --base stream/diff-cockpit` passed and wrote a publish-valid stamp.
## key decisions

- Use the existing shared API cache as the single cache truth for page hydration.
- Keep cache-miss behavior unchanged.
- Reconcile in the background after initial render for accuracy.

## notes for ko

- This directly targets the device-local loading issue: the page HTML can render from shared edge cache instead of waiting for a fresh browser-local API request.

## improvements noticed

- `code.run` is currently broken in this repo due to `./lib/codemode/tools/index` resolution; this task will use task-scoped workspace tools.

## issues and recovery

- Initial `task.start` used the literal branch name for `startFrom`; corrected to `startFrom: stream`.
- `stream.sync` merged substantial unrelated stream/main drift before this task; task branch started from synced `stream/diff-cockpit`.

---

## publish checklist

```bash
bun run task:push -- --message "feat(diff-cockpit): hydrate pr pages from shared cache" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-09 18:52:02 write: `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/workpad.md`

## workspace-owned: files read

- `cron_jobs/README.md`
- `cron_jobs/diff_cockpit/cron.json`
- `cron_jobs/index.ts`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/current.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/evidence-log.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/read-log.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/session.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/verify.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/workpad.md`, `.task/tasks/diff-cockpit/hydrate-pr-pages-from-shared-cache.json`, `cron_jobs/README.md`, `cron_jobs/diff_cockpit/cron.json`, `cron_jobs/index.ts`, `cron_jobs/tests/cron_jobs.test.ts`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## workspace-owned: validation evidence

- 2026-06-09 19:25:39 `verify`: passed — OK
