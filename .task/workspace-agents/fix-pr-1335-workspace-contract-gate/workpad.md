# Fix PR 1335 workspace contract gate

## Acceptance criteria
- Reproduce the PR #1335 CI failure from `Consuelo / workspace contracts` locally on the updated stream branch.
- Fix only the remaining contract/doc/test issue blocking merge to main.
- Validate with the exact failing command or narrower suite plus the exact command when feasible.
- Merge this task back into `stream/workspace-agents` and then re-check PR #1335 before merging to main.

## Current status
CI failed after CodeRabbit fixes landed. The failing job command was `bun run verify -- --base "origin/main" --no-stamp --review-arg --no-tests`. The log says review/db guard passed, but registry-selected suites `workspace-facade` and `workspace-audit-docs` failed.

## Test-first contract
- RED: reproduce the full workspace contract gate or extract the failing registry suite output.
- GREEN: rerun the failing suite(s) after fix, plus changed-file syntax checks.

## Plan
1. Run the exact CI command on the stream-derived task branch and capture the concrete failing assertions.
2. Patch the minimal source/test/docs/generated files needed.
3. Validate and publish back to stream.

## Validation log
- RED: clean PR #1335 merge-ref `test-selection --run --json` failed the workspace facade selected suite with `Cannot find package 'zod'` from `packages/workspace/scripts/lib/facade/schemas.ts`.
- Root cause: `.github/actions/yarn-install/action.yaml` restored fallback `node_modules` caches but skipped `yarn --immutable --check-cache` whenever `cache-matched-key` was non-empty. A fallback cache can be stale relative to the current `yarn.lock`, so newly added workspace dependencies are absent.
- Fix: run install and save the exact cache whenever the exact cache key did not hit, including fallback-cache restore cases.
- GREEN: static assertions confirmed the install/save conditions now depend only on exact cache miss and no longer include `cache-matched-key == ''`.
- GREEN: `node packages/workspace/scripts/ci/check-github-workflows.cjs origin/main` returned no findings.
- GREEN: `bun run verify -- --base origin/main --no-stamp --review-arg --no-tests` passed on the task branch.
- Note: `checkFiles` is not applicable to this YAML/Markdown-only follow-up; it attempts to execute `.yaml`/`.md` files as Node modules.

## CI rerun wait 2026-07-03T10:14:22.577Z
Wait reason: reran failed GitHub Actions jobs for PR #1335 Consuelo CI after local exact verify passed.
Duration: bounded polling, 20s interval, 12 attempts maximum.
Resume action: inspect PR #1335 checks via `gh pr checks --json name,state,bucket,workflow,link,startedAt,completedAt,description`.
Expected signal: Consuelo / verify and Consuelo / workspace contracts move from failed to pass; no pending checks remain.
Fallback: if GitHub jobs pass but Cloudflare remains failed, stop before merge and report external failure; if any GitHub job fails again, inspect log.

## workspace-owned: validation evidence

- 2026-07-03 10:28:24 `checkFiles`: failed — COMMAND_FAILED

## Summary
Fixed the remaining PR #1335 CI gate by correcting the GitHub cache/install action. The prior action skipped dependency installation after restoring a fallback node_modules cache, which allowed stale caches to miss newly added workspace dependencies such as zod. The action now runs yarn install/check-cache whenever the exact cache key misses, even if a fallback cache is restored.
