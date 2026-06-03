# homepage cache headers

branch: `task/diff-cockpit/homepage-cache-headers`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/750/homepage-cache-headers
github pr: https://github.com/consuelohq/opensaas/pull/750
started: 2026-06-03

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

- none yet

## workspace-owned: validation evidence

- 2026-06-03 18:17:44 `verify`: passed — OK
- 2026-06-03 18:19:26 `verify`: passed — OK

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
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/homepage-cache-headers/current.json`, `.task/diff-cockpit/homepage-cache-headers/evidence-log.json`, `.task/diff-cockpit/homepage-cache-headers/read-log.json`, `.task/diff-cockpit/homepage-cache-headers/session.json`, `.task/diff-cockpit/homepage-cache-headers/verify.json`, `.task/diff-cockpit/homepage-cache-headers/workpad.md`, `.task/tasks/diff-cockpit/homepage-cache-headers.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## update 2026-06-03 14:18

Aligned homepage API caching with PR-detail caching while keeping the existing localStorage first-paint path.

Implementation:
- `/api/:owner/:repo/pulls` now returns through `cachedJson(...)`, matching PR detail API behavior.
- Homepage API now emits `etag`, `vary: Accept`, and `cache-control: public, max-age=30, s-maxage=300, stale-while-revalidate=1800`.
- Removed volatile wall-clock `new Date().toISOString()` from homepage index payloads. `updatedAt` is now derived from the newest PR `updatedAt`, so identical GitHub data produces stable ETags and pushes/comments naturally invalidate the payload.

Validation evidence:
- Red test first: homepage API cache test failed because headers lacked `s-maxage` and reusable ETag behavior.
- Green focused test: `cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts` passed with 19 tests and 168 expectations.
- Typecheck and deploy: `cd packages/diff-cockpit && bun run typecheck && bun run deploy` passed; Cloudflare Worker version `304cc213-e7cd-4f6a-bc5c-778506a43bcf` deployed.
- Live smoke: `https://diffs.consuelohq.com/api/consuelohq/opensaas/pulls` returned shared cache headers and a second request with `If-None-Match` returned 304.

Cache strategy:
- Homepage still uses localStorage for instant stale-first rendering on the same device.
- Network/Cloudflare can now reuse the homepage API response across devices for 5 minutes at the edge.
- Correctness is GitHub-payload driven: when a PR is pushed, commented, merged, or otherwise changes its returned metadata, the JSON changes and the ETag changes.
