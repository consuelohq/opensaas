# M2 remove twenty-sdk legacy CLI surface

branch: `task/twenty-migration/m2-remove-twenty-sdk-legacy-cli-surface`
stream: `stream/twenty-migration`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2040/m2-remove-twenty-sdk-legacy-cli-surface
github pr: https://github.com/consuelohq/opensaas/pull/2040
started: 2026-08-15

## acceptance criteria

- [x] `@consuelo/cli` has no dependency or dynamic import on `twenty-sdk` / `twenty-sdk/cli`.
- [x] Legacy Twenty platform commands (`auth:*`, `app:*`, `entity:*`, `function:*`) are no longer registered by Consuelo CLI.
- [x] Removed the dead `--workspace` option/resolution path; M1's canonical OS workspace identity remains authoritative.
- [x] Preserved `consuelo login` and M1's Consuelo OS OAuth/PKCE behavior; all 8 auth contracts pass.
- [x] Cleaned stale top-level CLI/package description.
- [x] Did not touch remaining Twenty-backed deploy/dev templates; those remain M3 scope.
- [x] CLI focused tests, full CLI typecheck, build, formatting, strict review all pass with the prior `twenty-sdk/cli` type errors removed.

## plan

1. Add an architectural CLI test that fails while `twenty-sdk` is still declared/referenced and while `--workspace` is exposed.
2. Remove `twenty-sdk` dependency, workspace-resolution hook, SDK command registration, and the obsolete workspace flag.
3. Update CLI copy only where directly adjacent to this command-surface cleanup.
4. Update the Yarn lockfile only as required by the package manifest change; do not introduce Bun root lockfile work in M2.
5. Run auth tests, new legacy-surface test, CLI typecheck/build, strict review, and canonical verify.
6. Push and merge this task into `stream/twenty-migration`; do not promote the stream to main here.

## Test-first contract

behavior under test: Consuelo CLI is independently loadable without Twenty SDK, exposes no legacy Twenty platform/workspace command surface, and still exposes the M1 `login` command.
existing local pattern: `packages/cli/tests/auth.test.ts` uses Vitest for CLI contracts; use a focused architectural contract beside it and execute the CLI help surface with Bun for user-visible command assertions.
new or changed tests: add `packages/cli/tests/legacy-platform-removal.test.ts` asserting package dependency absence, source import absence, no `--workspace` help option, no legacy platform commands, and presence of `login`.
focused red command: `yarn vitest packages/cli/tests/legacy-platform-removal.test.ts --run`
expected red failure: current package manifest/source still declares/imports `twenty-sdk` and CLI help still exposes `--workspace`.
no-test waiver: not applicable.

## current status

- Implementation complete and validated locally.
- Focused RED: new removal contract failed on declared `twenty-sdk` and stale help/workspace surface.
- GREEN: 10/10 CLI tests, direct TypeScript typecheck/build, Prettier, no `twenty-sdk/cli` source references.
- Strict workspace review: 0 owned issues / 0 blockers. Verify initially surfaced one related pre-existing async-action lint rule in `coach`; converted the redundant `async`/`await` wrapper to direct promise return with no behavior change, then review returned clean.
- Public CLI docs were inspected after review flagged a documentation opportunity; they document the installed OS lifecycle CLI and contain none of the removed legacy platform commands, so no docs edit is needed for M2.
- Canonical verify passed and produced a publish-valid stamp; rerun after this final workpad update before push.

## files changed

- `packages/cli/package.json` — remove `twenty-sdk` dependency and update description.
- `packages/cli/src/index.ts` — remove SDK workspace hook, `--workspace`, and SDK command registration; update description.
- `packages/cli/tests/legacy-platform-removal.test.ts` — regression contract for independent CLI surface.
- `yarn.lock` — remove the CLI's npm `twenty-sdk` resolution/dependency edge.
- task workpad/metadata.

## workspace-owned: files changed

- `packages/cli/tests/legacy-platform-removal.test.ts`

## workspace-owned: activity log

- 2026-08-15 07:04:36 fs.write: `.task/twenty-migration/m2-remove-twenty-sdk-legacy-cli-surface/workpad.md`
- 2026-08-15 07:04:43 fs.write: `packages/cli/tests/legacy-platform-removal.test.ts`
- 2026-08-15 07:05:51 fs.write: `packages/cli/tests/legacy-platform-removal.test.ts`

## workspace-owned: validation evidence

- 2026-08-15 07:07:24 `review.run`: passed — OK
- 2026-08-15 07:08:00 `verify`: failed — COMMAND_FAILED
- 2026-08-15 07:08:40 `review.run`: passed — OK
- 2026-08-15 07:08:51 `verify`: passed — OK
- 2026-08-15 07:09:15 `verify`: passed — OK

## key decisions

- Do not implement a replacement `--workspace` selector in M2: the option is only consumed by `twenty-sdk` today, while M1 already persists canonical `workspaceId`/`workspaceHost` from Consuelo OS. A future multi-workspace selector should be an OS-native feature, not a compatibility shim.
- Do not remove legacy `apiKey` config fields in M2; non-SDK CLI API commands still consume those fields. This task removes the Twenty SDK command/auth surface, not every legacy credential field.
- Remaining Twenty references in deploy/dev generators are intentionally deferred to M3.

## notes for ko

- M2 is being built directly on top of M1, not on `main`, because the migration stream and main are currently diverged.

## improvements noticed

- The migration stream still needs a later explicit reconciliation with newer `main` before stream PR #1991 is promoted.

## issues and recovery

- Initial task PR #2038 was based on `main`; closed it after confirming `origin/main` still had old auth while `origin/stream/twenty-migration` had M1. Recreated correctly as PR #2040 with `startFrom=stream`.
- The first full workspace-package test exposed that the new test assumed repo-root cwd. Updated it to resolve package paths from `import.meta.url`; the original behavioral assertions were unchanged.
- `yarn workspace @consuelo/cli typecheck` could not find `tsc` from the package-local PATH in this linked worktree. Verified the repo-resolved TypeScript 5.9.2 compiler directly with `./node_modules/.bin/tsc -p packages/cli/tsconfig.json --noEmit` and a build pass.
- `yarn install --mode=update-lockfile` reported existing monorepo peer-dependency warnings, including Twenty packages; it completed successfully and only the expected CLI dependency resolution was removed.

---

## publish checklist

```bash
bun run task:push -- --message "refactor(cli): remove twenty sdk legacy surface" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/cli/package.json`
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/index.ts`
- `packages/cli/tests/auth.test.ts`
