# fix tools-dev JSON parsing for consuelo-design

branch: `task/consuelo-design/fix-tools-dev-json-parsing-for-consuelo-design`
stream: `stream/consuelo-design`
task pr: https://github.com/consuelohq/opensaas/pull/291

## acceptance criteria

- [ ] Facade can parse `tools-dev start web --json` output even when pnpm prints lifecycle text before JSON.
- [ ] Digital e-guide session can start from `bun run consuelo-design generate digital-eguide`.
- [ ] Direct dry-run JSON still works.
- [ ] `bun run consuelo-design check --json` still passes.
- [ ] Branch-local review passes.

## plan

1. Patch JSON extraction in `packages/workspace/scripts/consuelo-design.ts`.
2. Validate with sample mixed stdout and command dry-runs.
3. Publish into `stream/consuelo-design` and merge stream back to main if needed.

## validation

pending

## validation update

- `bun --check packages/workspace/scripts/consuelo-design.ts` passed.
- `bun run consuelo-design check --json` produced valid JSON.
- `bun run consuelo-design generate digital-eguide --dry-run --json` produced valid JSON.
- Installed upstream Open Design dependencies in this task worktree for runtime validation.
- `bun run consuelo-design generate digital-eguide --name "Consuelo Digital E-guide" --prompt ... --json` returned `ok: true`, with local daemon and web URLs, and created an Open Design digital e-guide project.
- Branch-local review passed: 1 file checked, 0 first-party findings.
