# fix browser facade commands

branch: `task/workspace-agents/fix-browser-facade-commands`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/245
started: 2026-04-30

## acceptance criteria

- [x] Identify current manifest/browser wrapper mismatch.
- [x] Add typed browser facade aliases matching the browser skill.
- [x] Add deterministic auth reauth command for expired browser profiles.
- [x] Regenerate generated docs/types.
- [x] Verify command dry-runs, syntax, audit, and review gate.

## plan

1. Read current manifest, browser wrapper, scripts docs, and generated facade surfaces.
2. Patch browser wrapper profile handling and auth refresh flow.
3. Add manifest aliases and schema types for browser commands.
4. Regenerate docs/types and run validation.

## files changed

- `packages/workspace/scripts/browser.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/SCRIPTS.md`

## key decisions

- Keep `workspace browser` as the generic CLI facade while moving generated typed client shape to `workspace.browser.run` so `workspace.browser.*` nested aliases can exist.
- Add `browser.reauth` as the durable command for expired/revoked auth profiles.

## notes for ko

- `agent-browser` ignores `--profile` when its daemon is already running, so reauth must close the daemon before login.

## improvements noticed

- 

## errors i ran into

- `workspace explore` failed twice before returning usable evidence; direct repo reads/searches were used for this investigation.

## validation

- `bun run generate-types` passed.
- `bun run generate-docs` passed.
- `workspace browser.login` dry-run resolved to `bun run browser -- login consuelo --headed`.
- `workspace browser.reauth` dry-run resolved to `bun run browser -- reauth consuelo --headed`.
- `workspace browser.test` dry-run resolved to `bun run browser -- open https://example.com`.
- `bun run browser -- raw auth list` passed and showed profile injection: `agent-browser --profile /Users/kokayi/.agent-browser-ko auth list`.
- `bun run browser -- --help` passed and documents `reauth`.
- `workspace checkFiles` passed for browser/facade generator files.
- `bun run audit -- --scripts --json` passed after documenting existing `linear` script drift.
- package-scoped facade test passed: `cd packages/workspace && bun run test tests/facade/facade.test.ts`.
- review gate passed: `bun run review -- --base stream/workspace-agents --no-tests --json`.
- `bun run verify -- --base stream/workspace-agents --no-db --json` passed and refreshed the task verify stamp.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```
