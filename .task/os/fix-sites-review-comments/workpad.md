# fix sites review comments

branch: `task/os/fix-sites-review-comments`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/869
started: 2026-06-09

## acceptance criteria

- [x] Read CodeRabbit/Codex review comments on stream PR #858.
- [x] Fix the still-valid comments with minimal changes.
- [x] Add regression tests for each behavior where practical.
- [x] Validate and push back into the stream PR.

## comments fixed

- Codex: migrate existing `office` selected-skill configs to `sites` before seeding bundled skills.
- CodeRabbit: protect the reserved page `versions/` subtree from publish target content.
- CodeRabbit: fail closed on malformed `sites/.data/pages/registry.json` instead of silently resetting the registry.
- CodeRabbit: return the post-publish page head in `currentVersionId`.
- CodeRabbit: return structured JSON errors for invalid `--kind` values.

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/sites-cli.test.ts`

## validation evidence

- `bun --cwd packages/os test tests/sites-cli.test.ts` — 5 tests passed.
- `bun --cwd packages/os test tests/install-state.test.ts` — 11 tests passed.
- `node --check` passed for touched TS/test files.
- `checkFiles` passed for touched TS/test files.
- `review.run --base origin/stream/os` passed with 0 issues from this change; one pre-existing `ERROR_HANDLING` finding remains in `packages/os/scripts/os.ts`.
- `verify --base origin/stream/os` passed and wrote a publish-valid stamp.

- 2026-06-09 17:58:21 write: `.task/os/fix-sites-review-comments/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: activity log

- 2026-06-09 17:58:21 fs.write: `.task/os/fix-sites-review-comments/workpad.md`

## workspace-owned: validation evidence

- `bun --cwd packages/os test tests/sites-cli.test.ts` — 5 tests passed.
- `bun --cwd packages/os test tests/install-state.test.ts` — 11 tests passed.
- `node --check` passed for touched TS/test files.
- `checkFiles` passed for touched TS/test files.
- `review.run --base origin/stream/os` passed with 0 issues from this change; one pre-existing `ERROR_HANDLING` finding remains in `packages/os/scripts/os.ts`.
- `verify --base origin/stream/os` passed and wrote a publish-valid stamp.
- 2026-06-09 17:58:21 write: `.task/os/fix-sites-review-comments/workpad.md`
- 2026-06-09 17:58:33 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-sites-review-comments/current.json`, `.task/os/fix-sites-review-comments/evidence-log.json`, `.task/os/fix-sites-review-comments/read-log.json`, `.task/os/fix-sites-review-comments/session.json`, `.task/os/fix-sites-review-comments/verify.json`, `.task/os/fix-sites-review-comments/workpad.md`, `.task/tasks/os/fix-sites-review-comments.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/os.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/sites-cli.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
