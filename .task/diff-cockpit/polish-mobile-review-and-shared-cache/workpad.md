# polish mobile review and shared cache

branch: `task/diff-cockpit/polish-mobile-review-and-shared-cache`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/747/polish-mobile-review-and-shared-cache
github pr: https://github.com/consuelohq/opensaas/pull/747
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

- 2026-06-03 17:51:56 `review.run`: passed — OK
- 2026-06-03 17:52:07 `verify`: passed — OK

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

- `packages/diff-cockpit/package.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/tsconfig.json`

## update 2026-06-03 13:50

Implemented mobile review polish and shared API cache headers.

Validation evidence:
- Red test first: `bun --cwd=packages/diff-cockpit run test` failed on missing `mobile-files-toggle` before implementation.
- Focused test after implementation: `bun --cwd=packages/diff-cockpit run test` passed with 18 tests, 158 expectations.
- Typecheck: `bun --cwd=packages/diff-cockpit run typecheck` passed.
- Cloudflare deploy: `bun --cwd=packages/diff-cockpit run deploy` uploaded `consuelo-diff-cockpit` version `5e2fc473-3d96-4271-ad07-dbb3b5ad720b`.
- Live API smoke: `https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/747` returned 200 with `cache-control: public, max-age=30, s-maxage=300, stale-while-revalidate=1800`, `etag`, and `vary: Accept`.
- Live page smoke: PR #747 page contains mobile file button, drawer state, near-black dark palette, and single-column mobile review layout.

Cache strategy chosen:
- PR detail JSON is now network-shareable via public HTTP cache semantics, `s-maxage=300`, `stale-while-revalidate=1800`, and an ETag derived from the serialized live GitHub payload.
- Correctness is still data-driven: when GitHub returns changed PR data after a push/comment/update, the serialized payload changes and therefore the ETag changes.
- Time is only a bounded freshness window, not the source of truth. This gives cross-device warm cache while keeping stale risk low.
- Homepage localStorage cached-first behavior remains unchanged.

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/polish-mobile-review-and-shared-cache/current.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/evidence-log.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/read-log.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/session.json`, `.task/diff-cockpit/polish-mobile-review-and-shared-cache/workpad.md`, `.task/tasks/diff-cockpit/polish-mobile-review-and-shared-cache.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
