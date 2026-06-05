# Restore workspace PR links helper

## Objective

Restore `packages/workspace/scripts/lib/pr-links.js` on the main-derived hotfix path so workspace scripts that import `./lib/pr-links` do not crash the MCP session or status workflow.

## Test-first contract

Behavior under test:
- Workspace scripts that import `./lib/pr-links` resolve the helper successfully.
- `status` returns a normal JSON envelope instead of `Cannot find module './lib/pr-links'`.

Existing pattern to follow:
- `packages/os/scripts/lib/pr-links.js` contains the same helper used by OS scripts.
- `stream/workspace-agents` already contains `packages/workspace/scripts/lib/pr-links.js`.

Focused validation:
- `node --check packages/workspace/scripts/lib/pr-links.js`
- `bun run status -- --json`

Expected failure before fix:
- `bun run status -- --json` fails with `Cannot find module './lib/pr-links'`.

No generated surfaces are required because this restores a runtime helper file consumed by existing scripts and does not change facade manifest/types/docs.

- 2026-06-05 07:10:52 write: `.task/workspace-agents/restore-workspace-pr-links-helper/workpad.md`

## files changed

- `packages/workspace/scripts/lib/pr-links.js`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/pr-links.js`

## workspace-owned: activity log

- 2026-06-05 07:10:52 fs.write: `.task/workspace-agents/restore-workspace-pr-links-helper/workpad.md`
- 2026-06-05 07:10:57 write: `packages/workspace/scripts/lib/pr-links.js`
- 2026-06-05 07:10:57 fs.write: `packages/workspace/scripts/lib/pr-links.js`
