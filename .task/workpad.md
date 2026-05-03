# fix Open Design missing artifact manifest

branch: `task/consuelo-design/fix-open-design-missing-artifact-manifest`
stream: `stream/consuelo-design`
task pr: https://github.com/consuelohq/opensaas/pull/293

## acceptance criteria

- [ ] Fix Next build error: `Module not found: Can't resolve '../artifacts/manifest'` from Open Design `ProjectView.tsx`.
- [ ] Keep vendored change minimal and record why we patched upstream vendored source.
- [ ] Validate Open Design web build or at least TypeScript/module resolution for the touched path.
- [ ] Re-run `bun run consuelo-design check --json`.
- [ ] Publish into stream and merge back to main for Ko's e-guide flow.

## plan

1. Inspect imports under `apps/web/src/artifacts` and `ProjectView.tsx`.
2. Add missing compatibility module or correct import if upstream has renamed the file.
3. Validate with `pnpm --filter @open-design/web build` or targeted command.
4. Publish/merge.

## validation

pending

## validation update

- Added missing vendored Open Design web artifact helper modules under `apps/web/src/artifacts`.
- `bun --check` passed for each new artifact helper module.
- `apps/web` Next build passed after installing upstream dependencies in this task worktree:
  - compiled successfully
  - TypeScript passed
  - static pages generated
- `bun run consuelo-design check --json` produced valid JSON.
- Branch-local review passed with 0 first-party findings.
