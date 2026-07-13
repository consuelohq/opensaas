# add live pr diff cockpit

## Intent

Build the first phase of `diff_cockpit`: a live PR review cockpit hosted as its own app/area, not a static tmp viewer.

## Scope

- New area/package: `packages/diff-cockpit`.
- Workspace operator script: `diff_cockpit`.
- Deploy target: Cloudflare Worker, intended domain `diffs.consuelohq.com`.
- Single PR route only: `/:owner/:repo/pull/:number`.
- Live GitHub API data; no generated static review artifact as the core architecture.
- Main surface prioritizes review: left file list/tree, center diff/code, right drawer closed by default.
- No PR homepage in phase 1.
- No OS package integration in phase 1.

## TDD plan

Write tests before implementation for:

1. PR locator parsing accepts PR number, GitHub PR URL, and canonical route.
2. Worker route loader calls live GitHub API endpoints for PR metadata and files.
3. View model groups changed files into a package-aware tree.
4. Rendered HTML includes `@pierre/diffs` and `@pierre/trees` integration points.
5. Right review drawer is closed by default.
6. Operator script builds the canonical `diffs.consuelohq.com` URL.

## Notes

- `@pierre/diffs` docs describe FileDiff as a web diff/code renderer, including patch-file consumption and syntax highlighting.
- `@pierre/trees` is the intended file-tree rendering library. If the API changes, keep graceful fallback rendering while preserving integration point.
- Live data may use public GitHub API without token for public PRs, and `GITHUB_TOKEN`/`GH_TOKEN` when available.

## workspace-owned: validation evidence

- 2026-06-03 03:44:00 `verify`: failed — COMMAND_FAILED
- 2026-06-03 03:44:54 `verify`: failed — COMMAND_FAILED
- 2026-06-03 03:47:23 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/add-live-pr-diff-cockpit/current.json`, `.task/diff-cockpit/add-live-pr-diff-cockpit/evidence-log.json`, `.task/diff-cockpit/add-live-pr-diff-cockpit/read-log.json`, `.task/diff-cockpit/add-live-pr-diff-cockpit/session.json`, `.task/diff-cockpit/add-live-pr-diff-cockpit/workpad.md`, `.task/tasks/diff-cockpit/add-live-pr-diff-cockpit.json`, `package.json`, `packages/consuelo-core/registry/packages.json`, `packages/consuelo-core/registry/scripts.json`, `packages/consuelo-core/registry/tools.json`, `packages/consuelo-core/src/registry/index.ts`, `packages/diff-cockpit/README.md`, `packages/diff-cockpit/package.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/src/worker.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/diff-cockpit/tsconfig.json`, `packages/diff-cockpit/wrangler.toml`, `packages/workspace/SCRIPTS.md`, `packages/workspace/package.json`, `packages/workspace/scripts/diff_cockpit.ts`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`

- 2026-06-03 03:46:38 patch lines 436-448: `packages/diff-cockpit/src/index.ts`

## files changed

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: activity log

- 2026-06-03 03:46:38 fs.patch: `packages/diff-cockpit/src/index.ts`

## Implementation summary

Created the new `diff-cockpit` area/package as a Cloudflare Worker app rather than a static tmp viewer. The worker serves a single live PR route at `/:owner/:repo/pull/:number` and a live JSON API at `/api/:owner/:repo/pull/:number`. The API fetches current GitHub PR metadata and changed files on request, using `GITHUB_TOKEN`/`GH_TOKEN` when provided.

Added the workspace operator script `diff_cockpit` with root and workspace package aliases. The script accepts a bare PR number, GitHub PR URL, or canonical route and opens the canonical `https://diffs.consuelohq.com/:owner/:repo/pull/:number` URL in Arc. It supports `--print`, `--no-open`, and `--repo owner/repo`.

The review page keeps the right review drawer closed by default. The default review surface is file tree on the left and diff/code in the center. The page loads `@pierre/diffs` and `@pierre/trees` as browser integration points, with local fallback rendering for the diff content.

Updated the Consuelo core registry so the new package, root script, workspace alias, and operator tool surface are tracked. Also expanded the registry script-target audit to include `packages/diff-cockpit/package.json`.

## Validation run

- `bun test packages/diff-cockpit/tests/diff-cockpit.test.ts` passed: 7 tests.
- `cd packages/diff-cockpit && bun run typecheck` passed.
- Live GitHub smoke fetch for PR #708 succeeded and returned 100 changed files.
- `cd packages/diff-cockpit && wrangler deploy src/worker.ts --dry-run --outdir /tmp/diff-cockpit-worker-dry-run` passed after correcting the custom-domain route to `diffs.consuelohq.com`.
- `bun packages/consuelo-core/scripts/audit-registry.ts` passed with package/script/tool registry counts updated.
- `bunx vitest run packages/consuelo-core/tests/registry.test.ts` passed: 11 tests.
- `git diff --check` passed.
- Formal `verify` passed and wrote `.task/diff-cockpit/add-live-pr-diff-cockpit/verify.json` before the task branch was promoted.

## Follow-ups

- Deploy the worker to Cloudflare and bind `diffs.consuelohq.com` after review/merge.
- Phase 2: add the open-PR homepage and stream/status filters.
- Phase 3: wire the closed-by-default drawer to CodeRabbit/Codex comments and fix-prompt actions.
