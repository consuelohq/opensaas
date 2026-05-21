# add os docs navigation skeleton

branch: `task/os/add-os-docs-navigation-skeleton`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/420/add-os-docs-navigation-skeleton
github pr: https://github.com/consuelohq/opensaas/pull/420
started: 2026-05-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## docs skeleton implementation

- Created approved top-level navigation shape: Get Started, OS, Dialer, Developers.
- Added new `packages/consuelo-docs/get-started/*` starter pages.
- Replaced public OS docs tree with the approved OS overview/concepts skeleton.
- Kept this pass intentionally shallow so follow-up tasks can write one section at a time.
- Removed stale public OS scaffold pages that still used old structure such as portal/runtime/integrations/skills/data-layer/workspace-filesystem.
- Updated all language nav entries in `docs.json` to avoid stale old OS/User Guide/GraphQL API tabs remaining in localized nav blocks.
- Fixed Dialer nav paths to existing files.

## validation

- `python3 -m json.tool packages/consuelo-docs/docs.json >/dev/null`: passed.
- Full navigation path check across all language entries: passed.
- Forbidden terminology grep across new Get Started/OS docs and `docs.json`: passed for `runbook`, `MCP`, `pilot`, `Supabase`, `agent-interface`, `User Guide`, `GraphQL API`.
- `git diff --check`: passed.

## notes

- A first attempt to write the skeleton through `task.exec` failed because the heredoc command was too long for the tmux executor. Switched to smaller direct repo commands through `mac.exec`.
