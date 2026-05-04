# bootstrap stream agent docs

branch: task/workspace-agents/bootstrap-stream-agent-docs
stream: stream/workspace-agents
pr: https://github.com/consuelohq/opensaas/pull/306
started: 2026-05-04

## acceptance criteria

- [x] Create stream-area docs folders under areas/<area> for existing streams.
- [x] Bootstrap areas/workspace-agents/AGENTS.md.
- [x] Bootstrap areas/dialer/AGENTS.md.
- [x] Move packages/consuelo-design/AGENTS.md to areas/consuelo-design/AGENTS.md.
- [x] Move packages/consuelo-website/AGENTS.md to areas/website/AGENTS.md.
- [x] Preserve Git tracking for streams with intentionally blank docs via .gitkeep.
- [x] Update references that still pointed at the old package AGENTS paths.

## plan

1. Confirm stream area names from stream.list.
2. Create areas/<area> directories for all existing stream branches.
3. Move existing package-level design and website AGENTS content into stream-area AGENTS docs.
4. Add minimal bootstrapped AGENTS docs for workspace-agents and dialer.
5. Update code and docs references to moved AGENTS paths.
6. Validate file layout, syntax, boundary checks, review, and diff cleanliness.

## files changed

- pending task:push update

## key decisions

- Stream docs live under areas/<area> because stream.list and existing stream-context code already use that convention.
- packages/consuelo-design/AGENTS.md moved to areas/consuelo-design/AGENTS.md to match the actual stream name.
- packages/consuelo-website/AGENTS.md moved to areas/website/AGENTS.md to match the actual stream name.
- Other stream folders use .gitkeep placeholders so Git can track intentionally blank stream doc directories.
- Design tooling references were updated so the move does not break get-design-system or boundary checks.

## notes for ko

- This task only bootstraps doc files. It does not yet inject these docs into stream.context output.

## improvements noticed

- Follow-up: update stream.context to surface areas/<area>/AGENTS.md and related stream docs directly.

## validation

- Confirmed existing stream areas from remote stream branches: analytics, blog, clean-up, consuelo-design, dialer, marketing-site, pi-agent, redis, trash, trash2, website, workspace-agents.
- Confirmed area docs were created under areas/<area>.
- Confirmed old package AGENTS paths for consuelo-design and consuelo-website were removed.
- Updated design tooling references to areas/consuelo-design/AGENTS.md and areas/website/AGENTS.md.
- workspace checkFiles passed for packages/consuelo-design/src/index.ts and packages/workspace/scripts/consuelo-design.ts.
- bun packages/workspace/scripts/consuelo-design.ts check --json passed with the new area doc paths.
- git diff --check passed.
- workspace review.run without explicit branch returned a branch validation error; reran with explicit branch.
- workspace review.run with branch task/workspace-agents/bootstrap-stream-agent-docs, base stream/workspace-agents, and noTests passed.
- First task.push attempt failed because .task/verify.json still referenced a previous task branch.
- bun packages/workspace/scripts/verify.js --base stream/workspace-agents --no-db --json passed and wrote a fresh verify stamp for this branch.
