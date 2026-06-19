# fix os sites sqlite lazy import

branch: `task/security/fix-os-sites-sqlite-lazy-import`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1156/fix-os-sites-sqlite-lazy-import
github pr: https://github.com/consuelohq/opensaas/pull/1156
started: 2026-06-19

## acceptance criteria

- [x] `install-state.ts` can import under Vitest without resolving `bun:sqlite` at module load.
- [x] Empty or missing OS DB produces an empty Sites artifact list.
- [x] Non-empty OS DB still reads artifacts through Bun SQLite in runtime.
- [x] Previously failing `install-workspace-bootstrap-contract` passes.

## plan

1. Confirm the failing import path from `install-state.ts` to `sites.ts`.
2. Move `bun:sqlite` from top-level import to a lazy local loader in `readArtifactRows()`.
3. Treat missing, non-file, and empty DB paths as no-artifact state before loading SQLite.
4. Validate the previously failing contract plus adjacent Sites/install tests.

## current status

- Implementation complete. Pending review/verify/push.

## files changed

- `packages/os/scripts/lib/sites.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-19 14:21:21 first rerun moved failure from import-time to runtime; empty DB still loaded SQLite
- 2026-06-19 14:21:59 `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/install-workspace-bootstrap-contract.test.ts`: passed, 4 tests
- 2026-06-19 14:23:05 real non-empty DB smoke through `materializeSites()`: passed, 1 artifact read
- 2026-06-19 14:23:22 focused adjacent tests passed: install bootstrap, sites CLI, workspace snapshot publishing, install state; 25 tests
- 2026-06-19 14:23:38 destructive/secret changed-file scan: passed
- 2026-06-19 14:23:50 `bun run typecheck`: passed
- 2026-06-19 14:23:50 `git diff --check`: passed
- 2026-06-19 14:24:38 `review.run`: passed — OK
- 2026-06-19 14:24:48 `verify`: passed — OK

## key decisions

- Keep Sites APIs synchronous. Use `createRequire()` lazily only when a real non-empty DB must be read.
- Build the `bun:sqlite` specifier opaquely so Vite does not statically resolve the Bun-only builtin during tests.

## notes for ko

- This fixes the test failure without changing installer behavior or requiring a broader async refactor.

## improvements noticed

- none yet

## issues and recovery

- A first lazy-loader attempt still loaded SQLite for empty DB files. Added a size check so empty DB means no artifacts.
- `createRequire('bun:sqlite')` can be statically interpreted by Vitest/Vite; changed to a constructed specifier while keeping the runtime module the same.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`

- 2026-06-19 14:24:17 apply-patch: `.task/security/fix-os-sites-sqlite-lazy-import/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/fix-os-sites-sqlite-lazy-import/current.json`, `.task/security/fix-os-sites-sqlite-lazy-import/evidence-log.json`, `.task/security/fix-os-sites-sqlite-lazy-import/read-log.json`, `.task/security/fix-os-sites-sqlite-lazy-import/session.json`, `.task/security/fix-os-sites-sqlite-lazy-import/workpad.md`, `.task/tasks/security/fix-os-sites-sqlite-lazy-import.json`, `packages/os/scripts/lib/sites.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
