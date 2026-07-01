# server hydrate warmed diff cockpit pages

branch: `task/diff-cockpit/server-hydrate-warmed-diff-cockpit-pages`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/991/server-hydrate-warmed-diff-cockpit-pages
github pr: https://github.com/consuelohq/opensaas/pull/991
started: 2026-06-13

## objective

Make diff cockpit match the intended server-warmed mental model: cron/webhook/task-push warm API JSON, page routes read that cache server-side, HTML embeds initial data, and clients update in the background without relying on click/focus as the primary refresh path.

## test-first contract

Behavior under test:

- Repo inbox route `/:owner/:repo` reads the warmed `/api/:owner/:repo/pulls` cache and embeds initial index data in the HTML.
- PR route `/:owner/:repo/pull/:number` reads the warmed PR API cache and embeds initial review data with its ETag.
- Review and inbox clients render from embedded data before background fetches.
- Background refresh uses `If-None-Match` and treats `304` as no-op.
- Pointer/click is no longer a primary refresh trigger for the inbox.
- Cron refresh can report completed writes when requested, while preserving queued waitUntil behavior by default.

Existing pattern to follow:

- Existing `readCachedJsonData`, `makeApiCacheRequest`, and `renderReviewPage(initialData)` already point at server hydration for PR pages.
- Existing cache tests under `createWorker` cover refresh endpoint, API cache headers, and 304 behavior.

Intended tests:

- Add worker test for repo route using an injected edge cache: after refresh, loading `/:owner/:repo` embeds `diff-cockpit-index-initial-data`, avoids another loader call, and renders client code that reads it.
- Add/extend PR route test: after refresh, loading PR page embeds `diff-cockpit-initial-data` plus initial ETag and avoids another loader call.
- Add client-script assertions for `If-None-Match`, `304`, initial-data readers, and no `pointerdown` refresh trigger.
- Add refresh endpoint test for `wait=1` or equivalent completed mode.

Focused red command:

```bash
bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts
```

Expected red failure:

- New assertions for index initial data, initial ETags, completed refresh mode, and no pointerdown refresh should fail before implementation.

## exploration

- Read root `AGENTS.md` and full `CODING-STANDARDS.md`.
- Read current Worker route flow around API routes, repo route, PR route, and refresh endpoint.
- Read current cache helpers around `readCachedJsonData`, `readCachedJson`, `replaceCachedJson`, and ETag generation.
- Read current client boot code for index and review pages.

## validation evidence

- PASS: `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts` — 34 pass, 0 fail, 340 expectations. Trace: `trc_ac22bdea85bb`.
- PASS: `cd packages/diff-cockpit && bun run typecheck` — `tsc --noEmit -p tsconfig.json`. Trace: `trc_2b9090a1a3fd`.
- PARTIAL PASS: `bun run review` — YOUR CHANGES clean; command exits non-zero only for pre-existing stream issues in OS scripts. Trace: `trc_3be47f2bea22`.

## notes

- PR page already has partial server hydration: route reads cached PR JSON and `renderReviewPage(locator, initialData)` embeds it. The client immediately fetches again and currently does not use ETags for background updates.
- Inbox route does not yet server-hydrate from cached index data.

- 2026-06-13 05:15:20 write: `.task/diff-cockpit/server-hydrate-warmed-diff-cockpit-pages/workpad.md`

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-13 05:15:20 fs.write: `.task/diff-cockpit/server-hydrate-warmed-diff-cockpit-pages/workpad.md`
- 2026-06-13 05:15:53 fs.write: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-13 05:18:05 fs.write: `packages/diff-cockpit/src/index.ts`
- 2026-06-13 05:18:31 fs.write: `packages/diff-cockpit/src/index.ts`

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## implementation summary

- Inbox and PR HTML routes now read the warmed API cache server-side and embed initial JSON plus ETags.
- Index and review clients use embedded data on boot, send `If-None-Match`, and treat `304` as no-op.
- Removed pointer/click-driven index refresh as a primary update path; focus, visibility, and interval refresh remain.
- Refresh endpoint supports `?wait=1` to report completed cache writes instead of returning queued work.

## issues and recovery

- Static review reported two pre-existing stream-owned OS script error-handling issues. Diff cockpit changed files were clean.
