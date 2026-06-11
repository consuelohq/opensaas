# operator artifact commands

branch: `task/os/operator-artifact-commands`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/960

## current status

Created a clean task branch from current `stream/os` after PR #949 had merge conflicts. This branch carries the operator/artifact-command correction directly on top of the current stream.

## changes

- Moved the root `operator/` folder into `packages/os/operator/`.
- Removed the root `operator/` files from the branch diff.
- Set the root `operator` package script to call `packages/os/operator/operator.ts`.
- Set the OS package `operator` script to call `./operator/operator.ts`.
- Added package-local OS renderer files:
  - `packages/os/scripts/artifact-render.ts`
  - `packages/os/scripts/artifact-validate.ts`
- Added OS package scripts:
  - `artifact:render`
  - `artifact:validate`
  - `artifact:publish`
- Kept root `wiki:render` / `wiki:validate` as aliases to the new artifact scripts.
- Updated OS install-state package roots so install packaging reads bundled skills and operator files from `packages/os`, not repo-root paths.

## validation

- `bun run --cwd packages/os operator list` returned `review`.
- `bun run operator list` returned `review`.
- `bun run --cwd packages/os artifact:render -- --template guide --input /tmp/artifact-smoke.json --out /tmp/artifact-smoke.html --json` passed.
- `bun run --cwd packages/os typecheck` passed.

## note

A full `bun --cwd packages/os test` currently has unrelated stream failures around existing tests and copy text. The focused operator/render/typecheck validations passed for this change.

- 2026-06-11 07:45:03 write: `.task/os/operator-artifact-commands/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-11 07:45:03 fs.write: `.task/os/operator-artifact-commands/workpad.md`
