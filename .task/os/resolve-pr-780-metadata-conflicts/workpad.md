# resolve-pr-780-metadata-conflicts

branch: `task/os/resolve-pr-780-metadata-conflicts`
stream: `stream/os`
pr being repaired: https://github.com/consuelohq/opensaas/pull/780
repair PR: https://github.com/consuelohq/opensaas/pull/847
started: 2026-06-08

## user intent assertions

- [x] Do not blindly choose ours/theirs for metadata conflicts.
- [x] Inspect the generator and generated docs before resolving.
- [x] Keep the more advanced metadata model where it is better.
- [x] Preserve OS-specific source documents where stream/os moved generated docs from workspace source files to packages/os source files.
- [x] Preserve the newer user-facing OS Tools navigation group from main.
- [x] Resolve install-state test toward the implementation that now installs src, tooling, and manifests.

## decision notes

- `origin/main` had the more advanced raw-source-doc metadata model: `runtimeRole`, `controls`, `generatedRoute`, `renderSourceIntro`, safer fence parsing, and angle-placeholder normalization.
- `stream/os` had the correct OS source files: `packages/os/STEERING.md`, `packages/os/decision.md`, `packages/os/TOOLS.md`, and `packages/os/SCRIPTS.md`.
- Resolution combines both: advanced metadata/rendering from main, OS-specific source paths/descriptions from stream.
- `osTools` is no longer just a legacy raw-source group. Main has real user-facing tool docs under `packages/consuelo-docs/os/tools/*`, so the generator now keeps `osTools` while still redirecting legacy raw-source slugs.
- `workspace.wait` signature kept the more advanced main-side metadata: `duration`, `detached`, `status`, `list`, and `reason`.
- `install-state.test.ts` kept stream-side directory expectations because the implementation now creates `src`, `tooling`, and `manifests`.

## validation

- `cd packages/consuelo-docs; bun run generate-os-source-docs` passed and regenerated four raw source docs.
- `cd packages/consuelo-docs; bun run check-os-source-docs` passed.
- `cd packages/consuelo-docs; bun run validate-os-docs` passed.
- `cd packages/os; bun test tests/install-state.test.ts` passed: 10 tests, 109 assertions.
- `git diff --cached --check` passed.

## files of interest

- `packages/consuelo-docs/scripts/generate-os-source-docs.ts`
- `packages/consuelo-docs/os/agent-context/*.mdx`
- `packages/consuelo-docs/l/*/os/agent-context/*.mdx`
- `packages/consuelo-docs/navigation/base-structure.json`
- `packages/consuelo-docs/navigation/navigation.template.json`
- `packages/consuelo-docs/docs.json`
- `packages/os/TOOLS.md`
- `packages/os/tests/install-state.test.ts`

## current status

- Conflicts resolved in task branch.
- Ready to commit and push to update stream/os, which should unblock PR #780.

- 2026-06-08 05:00:53 write: `.task/os/resolve-pr-780-metadata-conflicts/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-08 05:00:53 fs.write: `.task/os/resolve-pr-780-metadata-conflicts/workpad.md`
- 2026-06-08 05:04:33 fs.write: `.task/os/resolve-pr-780-metadata-conflicts/workpad.md`

## final review update

- `bun run review` reports `YOUR CHANGES: ✓ clean`.
- It exits non-zero only because of pre-existing stream issues: `packages/os/scripts/wait.js`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/scripts/stream-context.js`, `packages/workspace/scripts/wait.js`, and `twenty-shared:typecheck` in `scripts/generateBarrels.ts`.

- 2026-06-08 05:04:33 append: `.task/os/resolve-pr-780-metadata-conflicts/workpad.md`
