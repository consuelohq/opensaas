# Refresh Consuelo website lockfile

## Acceptance criteria

- Refresh `packages/consuelo-website/bun.lock` so the Consuelo website workflow can run `bun install --frozen-lockfile`.
- Do not change website source code or workflow code in this follow-up task.
- Validate frozen install, website build, review, and verify.

## Context

The first Consuelo CI phases task merged into `stream/ci`, but GitHub Actions showed `Consuelo / website status` failing because `bun install --frozen-lockfile` detected lockfile drift in `packages/consuelo-website`.

## Validation plan

- `bun install --frozen-lockfile` in `packages/consuelo-website`.
- `bun run --cwd packages/consuelo-website build`.
- Workspace review and verify against `origin/stream/ci`.


## Validation results

- Frozen Bun install in the website package passed.
- Website build passed with 0 errors and completed 94 pages.
- Verify printed a passing result against `origin/stream/ci`: one changed file, review passed, DB guard passed, zero suites selected because only lockfile data changed, and a publish-valid stamp was written.
- The wrapper timed out after verify printed success; the stamp is present and retained for publish.
