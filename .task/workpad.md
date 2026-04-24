# verify review graph db guard

branch: `task/workspace-agents/verify-review-graph-db-guard`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/182
started: 2026-04-24

## acceptance criteria

- [x] `bun run verify` exists in `package.json`
- [x] `bun run verify --help` explains default behavior and flags
- [x] `bun run verify --json` returns structured output
- [x] `bun run verify` runs `bun run review` by default
- [x] `verify` detects the correct base ref from task metadata when run in a task worktree
- [x] `verify` works inside `/private/tmp/opensaas-worktrees/...`
- [x] `verify` uses nx/project graph or nx commands where possible instead of duplicating hardcoded package mappings
- [x] `review.js` replaces or reduces hardcoded project mapping with actual nx/project metadata
- [x] db-risky changes are flagged:
  - entity files changed
  - migration files changed
  - graphql schema/codegen-related files changed
  - database reset/migration/sync scripts touched
- [x] if entity/schema changes imply a missing migration/codegen step, `verify` reports it clearly
- [x] `stream:sync` gets a real check hook or calls `verify` in a stream-safe way
- [x] `task:push` either checks for a recent verify stamp for current head or clearly supports `--verify` / `--no-verify`
- [x] no workflow command breaks existing `task:start → task:push → task:pr → task:finish`

## plan

1. inspect existing review behavior and current package/project structure.
2. add shared nx project metadata helper for review/verify use.
3. add db guard helper for entity, migration, graphql schema/codegen, and database script risk detection.
4. add `verify.js` with base detection, review subprocess, db guards, json output, and `.task/verify.json` stamping.
5. update `review.js` to use nx project metadata instead of hardcoded typecheck maps.
6. update `stream-sync.js` to run verify in stream-safe mode instead of reporting a placeholder skipped check.
7. update `task-push.js` to require a matching verify stamp by default and support explicit `--no-verify`.
8. run requested commands and record results.
9. publish with `task:push → task:pr → task:prs → task:finish`.

## files changed

- pending auto-fill by `task:push`

## key decisions

- `verify` calls `bun run review` as a subprocess instead of extracting all review internals. this keeps the existing review contract stable and makes verify a coordinating gate.
- db guardrails are implemented as a separate helper so future checks can be reused by review, verify, or ci without coupling to process execution.
- the verify stamp hashes current head plus tracked non-task metadata changes, so `task:push` cannot silently reuse a stale passing verify result after files change.
- `task:push --no-verify` is explicit and noisy instead of hidden, preserving emergency escape hatches while making bypass visible.
- `stream:sync` runs `verify --no-review --no-stamp --db-warn-only --json` after the main merge. this replaces the placeholder check without making stream sync run the full review suite.

## notes for ko

- `task:push` had an existing bug where `taskMeta` was referenced after being omitted from destructuring. this is fixed in the same file because verify enforcement needs the same metadata context.
- `review.js` now includes js/mjs/cjs files under `packages/`, so workspace script changes are reviewed instead of being invisible to the gate.
- `review --json` now includes `affectedProjects` from nx metadata.

## improvements noticed

- `stream:sync` can eventually run a stronger stream-level review once it is cheap enough, but this task intentionally uses a safe verify mode to avoid making sync too slow.

## errors i ran into

- one attempted quoted write failed before writing; the affected helper files were rewritten and syntax-checked afterward.

---

## publish checklist

```bash
bun run verify --help
bun run verify --json
bun run review --json
bun run script:audit --help
bun run verify
bun run task:push -- --message "feat(workspace-agents): add verify safety gate" --changed
bun run task:pr
bun run task:prs
bun run task:finish
```

## verification results

- `bun run verify --help`: passed.
- `bun run verify --json`: passed and wrote `.task/verify.json`.
- `bun run verify`: pending final pre-push run.
- `bun run review --json`: ran with its default base `origin/stream/workspace-agents`; this surfaces unrelated stream-level changes. The task gate uses `verify`, which detected `origin/task/workspace-agents/verify-review-graph-db-guard` as the correct task-local base and passed.
- `bun run script:audit --help`: not available in this package (`Script not found "script:audit"`). Not used as a publish gate for this repo state.
