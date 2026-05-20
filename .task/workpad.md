# prefer graphite pr links

branch: `task/workspace-agents/prefer-graphite-pr-links`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/404
started: 2026-05-20

## acceptance criteria

- [x] Add a shared PR link helper that builds GitHub and Graphite URLs from repo, PR number, and slug source.
- [x] Make task workflow outputs Graphite-first for human-facing PR links.
- [x] Preserve GitHub URLs in metadata for API parsing and debugging.
- [x] Add focused tests for URL generation.
- [ ] Run script syntax checks, focused tests, audit, and review/verify.

## plan

1. Read task PR/status scripts and current docs.
2. Add shared Graphite/GitHub PR URL helper.
3. Update task-start, task-pr, task-prs, and status to prefer Graphite in human-facing outputs while preserving GitHub fields.
4. Update steering/scripts docs and add focused tests.
5. Verify through syntax checks, focused tests, audit, review, and verify.

## files changed

- `packages/workspace/scripts/lib/pr-links.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/scripts/task-prs.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/scripts/status.js`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/pr-links.test.js`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## exploration

- `context.search` found no existing Graphite PR link memory.
- `explore` surfaced task PR scripts and generated tool surfaces; direct reads confirmed PR URLs are built from GitHub API `html_url` in task workflow scripts.
- Current source of truth for task/review PR output is `task-pr.js`, `task-prs.js`, `task-start.js`, and `status.js`; docs surface is `SCRIPTS.md` plus PR reporting doctrine in `STEERING.md`.

## implementation notes

- GitHub URLs remain stored for GitHub API tooling and scripts that parse `/pull/<number>`.
- Human-facing `prUrl` fields from task workflow results now point to Graphite where the script can compute the URL.
