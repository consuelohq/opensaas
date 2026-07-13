# rename server reload command

branch: `task/workspace-agents/rename-server-reload-command`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/495/rename-server-reload-command
github pr: https://github.com/consuelohq/opensaas/pull/495
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/SCRIPTS.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`

## workspace-owned: activity log

- 2026-05-23 06:17:47 fs.write: `.task/workspace-agents/rename-server-reload-command/workpad.md`
- 2026-05-23 06:21:06 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-23 06:21:41 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-23 06:23:08 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-23 06:24:35 fs.write: `.task/workspace-agents/rename-server-reload-command/workpad.md`

## workspace-owned: validation evidence

- 2026-05-23 06:22:40 `audit`: failed — COMMAND_FAILED
- 2026-05-23 06:23:17 `audit`: passed — OK
- 2026-05-23 06:23:26 `checkFiles`: passed — OK
- 2026-05-23 06:23:53 `review.run`: passed — OK
- 2026-05-23 06:24:25 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## implementation checkpoint — initial task setup

### acceptance criteria

- Verify the existing server restart work landed.
- Rename the user-facing server restart action to `consuelo-reload` while preserving compatibility where safe.
- Add a top-level package script so Ko can run `bun run consuelo-reload` and see confirmation.
- Rename or alias the underlying workspace server script to reduce `server`/`restart` confusion.
- Update `packages/workspace/SCRIPTS.md` and generated workspace docs/types if the manifest changes.
- Validate with focused command smokes and review gates.

### plan before editing

1. Read current server script, package scripts, manifest, docs, and generated surfaces.
2. Choose the smallest compatible rename path.
3. Patch scripts/docs/manifest as needed.
4. Run focused syntax and command smokes.
5. Regenerate docs/types if the manifest changes.
6. Push, promote, merge, and update local main.

- 2026-05-23 06:17:47 append: `.task/workspace-agents/rename-server-reload-command/workpad.md`

- 2026-05-23 06:21:06 patch lines 1109-1119: `packages/workspace/SCRIPTS.md`

- 2026-05-23 06:21:41 patch lines 1120-1120: `packages/workspace/SCRIPTS.md`

- 2026-05-23 06:23:08 patch lines 1122-1122: `packages/workspace/SCRIPTS.md`

## final validation before publish

Existing server reload work status:

- The previous agent-safe async restart work was already merged. `packages/workspace/scripts/server.js` scheduled a detached `restart-now` child and printed confirmation before disconnecting.

Files changed in this task:

- `package.json`
- `packages/workspace/package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/scripts/consuelo-reload.js`
- `packages/workspace/scripts/server.js` deleted as the old underlying script name
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`

Validation evidence:

- `bun run generate-types`: passed.
- `bun run generate-docs`: passed.
- `node --check packages/workspace/scripts/consuelo-reload.js`: passed.
- `bun run consuelo-reload -- --help`: passed and shows the new command/help text.
- `bun run consuelo-reload -- status`: passed and showed the running launchd server.
- `bun run server -- --help`: passed as a legacy alias.
- `audit --scripts`: passed, 52 documented / 52 actual.
- `checkFiles`: passed for changed script/schema/generator files.
- `review.run --base origin/main --no-tests`: passed.
- `verify --base origin/main --no-db`: passed.

Expected user command after merge:

```bash
git pull origin main && bun run consuelo-reload
```

Expected confirmation before disconnect:

```text
consuelo reload scheduled
  workspace will briefly disconnect while launchd reloads it
  check with: bun run consuelo-reload -- status
```

- 2026-05-23 06:24:35 append: `.task/workspace-agents/rename-server-reload-command/workpad.md`
