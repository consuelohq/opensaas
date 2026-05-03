# move consuelo design facade into workspace bun tooling

branch: `task/consuelo-design/move-consuelo-design-facade-into-workspace-bun-tooling`
stream: `stream/consuelo-design`
task pr: https://github.com/consuelohq/opensaas/pull/289

## acceptance criteria

- [x] Move the operational consuelo-design facade into `packages/workspace/scripts/`.
- [x] Make all Consuelo-facing commands Bun-first.
- [x] Keep upstream pnpm usage isolated behind the Bun facade because Open Design pins pnpm.
- [x] Add workspace package script entry for `consuelo-design`.
- [x] Add typed workspace tool facade entries under `workspace consueloDesign.*`.
- [x] Regenerate workspace docs/types from the tool manifest.
- [x] Make package-local consuelo-design script a thin Bun passthrough only.
- [x] Update docs/manual commands to use `bun run consuelo-design ...`, not yarn.
- [x] Validate check, railway check, design-system JSON, upstream JSON, workflows JSON, and UI dry-run plan.

## plan

1. Inspect workspace script and typed facade patterns.
2. Add `packages/workspace/scripts/consuelo-design.ts` as the canonical Bun facade.
3. Replace package-local Node script with a thin Bun wrapper.
4. Register root/workspace/package scripts and typed facade tool entries.
5. Regenerate generated docs/types.
6. Update `consuelo-design` docs/manual with Bun-only commands.
7. Validate through direct Bun commands and typed workspace tools.
8. Push and refresh the stream review PR.

## files changed

- `package.json`
- `yarn.lock`
- `packages/consuelo-design/AGENTS.md`
- `packages/consuelo-design/RAILWAY.md`
- `packages/consuelo-design/README.md`
- `packages/consuelo-design/package.json`
- `packages/consuelo-design/scripts/consuelo-design.ts`
- `packages/consuelo-design/scripts/consuelo-design.mjs` removed
- `packages/workspace/package.json`
- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`

## key decisions

- Canonical facade is now `packages/workspace/scripts/consuelo-design.ts`.
- Root command is `bun run consuelo-design ...`.
- Package command remains available through `bun run --cwd packages/consuelo-design ...`, but it delegates to the workspace script.
- The typed facade is exposed as `workspace consueloDesign.*` via `packages/workspace/tooling/tool-manifest.json`.
- Open Design still uses `corepack pnpm` internally because upstream pins `pnpm@10.33.2`; this is intentionally hidden behind Bun scripts.

## validation

- `bun packages/workspace/scripts/consuelo-design.ts check` passed.
- `bun packages/workspace/scripts/consuelo-design.ts railway:check` passed.
- `bun packages/workspace/scripts/consuelo-design.ts get-design-system --json` produced valid JSON.
- `bun packages/workspace/scripts/consuelo-design.ts upstream-status --json` produced valid JSON.
- `bun packages/workspace/scripts/consuelo-design.ts workflows --json` produced valid JSON.
- `bun packages/workspace/scripts/consuelo-design.ts ui:status --dry-run --json` produced valid JSON.
- `bun packages/consuelo-design/scripts/consuelo-design.ts check` passed.
- `bun run consuelo-design check` passed.
- `bun run consuelo-design railway:check` passed.
- `bun run consuelo-design ui:status --dry-run --json` produced valid JSON.
- `bun run --cwd packages/workspace workspace consueloDesign.check` passed.
- `bun run --cwd packages/workspace workspace consueloDesign.railwayCheck` passed.
- `bun run --cwd packages/workspace workspace consueloDesign.upstreamStatus` produced valid JSON envelope.
- `bun run --cwd packages/workspace workspace consueloDesign.uiStatus '{"dryRun":true}'` produced valid JSON envelope.
- `bun run --cwd packages/workspace workspace consueloDesign.getDesignSystem` produced valid JSON envelope.
- `bun run --cwd packages/workspace generate-docs` passed.
- `bun run --cwd packages/workspace generate-types` passed.
- `bun run --cwd packages/workspace test -- tests/facade/facade.test.ts` passed with snapshots updated for new consueloDesign facade entries.

## notes for ko

- You were right: our operational surface should be Bun and workspace-tool native. This patch corrects that.
- Future manual command is `bun run consuelo-design ui`, not `cd upstream/open-design && pnpm ...`.
- We still use `corepack pnpm` underneath only because Open Design upstream itself requires it.


## final validation update

- branch-local review passed: 7 files checked, 0 first-party findings.
- `bun run consuelo-design check` passed.
- `bun run consuelo-design railway:check` passed.
- `bun run consuelo-design get-design-system --json` produced valid JSON.
- `bun run consuelo-design upstream-status --json` produced valid JSON.
- `bun run consuelo-design workflows --json` produced valid JSON.
- `bun run consuelo-design ui:status --dry-run --json` produced valid JSON.
- typed facade `consueloDesign.uiStatus` produced a valid JSON envelope when node_modules is linked, matching normal task worktree setup.
