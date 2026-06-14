# fix workspace edge seed review comments

branch: `task/security/fix-workspace-edge-seed-review-comments`
stream: `stream/security`
task pr: https://app.graphite.com/github/pr/consuelohq/opensaas/982/fix-workspace-edge-seed-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/982
started: 2026-06-12

## acceptance criteria

- Resolve valid CodeRabbit findings from stream/security PR #981.
- Treat empty or whitespace-only seed inputs as absent, falling back to the canonical defaults.
- Trim connector route inputs before using them in OS route records and D1 seed SQL.
- Prevent CLI flags with missing values from being interpreted as another flag's value.
- Keep changes minimal and preserve the live Worker/D1 route behavior already deployed for `internal.consuelohq.com/*`.
- Run focused opt-in contracts, review against `origin/stream/security`, verify against `origin/stream/security`, push, promote, and clean up.

## plan

1. Verify the review comments against current code and tests.
2. Extend `workspace-edge-route-seed-contract.test.ts` before production edits.
3. Run the focused test red.
4. Patch `workspace-edge-route-seed.ts` input normalization and `seed-workspace-edge-route.ts` argv parsing/import safety.
5. Run focused tests and script smoke.
6. Run review/verify and promote into `stream/security`.

## Test-first contract

Behavior under test:
- `createWorkspaceEdgeRouteSeedRecord` should replace whitespace-only `workspaceId`, `workspaceSlug`, `hostname`, `baseDomain`, and `appUpstreamUrl` with default seed constants before normalization.
- Connector route inputs should be trimmed before building `/mcp` and `/traces` route targets and connector SQL.
- `readArg` should return `undefined` when a flag is absent, at the end of argv, or followed by another flag.

Existing local pattern to follow:
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts` dynamically imports the seed library from `process.cwd()` under the opt-in workspace gateway contract gate.
- Script behavior is validated by focused package commands and `check-files`.

New or changed tests:
- Extend `packages/os/tests/workspace-edge-route-seed-contract.test.ts` with whitespace/default and argv parsing coverage.

Focused red command:
```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-route-seed-contract.test.ts
```

Expected red failure:
- Current library persists empty/whitespace `workspaceSlug`, `hostname`, and `baseDomain` instead of defaults.
- Current script cannot be imported safely for `readArg` testing because it runs at module import, and current `readArg` accepts another flag as a value.

## files changed

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`

## key decisions

- No docs update required; this is package-local validation and CLI input hardening for an existing script.

## validation evidence

- pending

## issues and recovery

- pending

- 2026-06-12 17:51:22 write: `.task/security/fix-workspace-edge-seed-review-comments/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`

## workspace-owned: activity log

- 2026-06-12 17:51:22 fs.write: `.task/security/fix-workspace-edge-seed-review-comments/workpad.md`
- 2026-06-12 17:52:38 write: `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- 2026-06-12 17:52:38 fs.write: `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- 2026-06-12 17:54:38 fs.patch: `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- 2026-06-12 17:56:30 fs.patch: `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- 2026-06-12 17:57:33 fs.patch: `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- 2026-06-12 17:58:41 fs.patch: `packages/os/scripts/seed-workspace-edge-route.ts`
- 2026-06-12 18:00:05 fs.patch: `packages/os/scripts/seed-workspace-edge-route.ts`
- 2026-06-12 18:06:28 fs.write: `.task/security/fix-workspace-edge-seed-review-comments/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-12 17:53:17 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-route-seed-contract.test.ts`: failed exit 1 trace: `trc_8aa0a9efda52`
  - output: sts/workspace-edge-route-seed-contract.test.ts:[2m58:11[22m[39m [90m 56| [39m [90m 57| [39m [35mif[39m ([35mtypeof[39m module[33m.[39mreadArg [33m!==[39m [32m'function'[39m) { [90m 58| [39m throw new Error('workspace edge route seed script is missing readA… [90m | [39m [31m^[39m [90m 59| [39m } [90m 60| [39m [90m [2m❯[22m tests/workspace-edge-route-seed-contract.test.ts:[2m155:25[22m[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-12 17:54:38 patch lines 36-47: `packages/os/scripts/lib/workspace-edge-route-seed.ts`

## workspace-owned: files read

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`

- 2026-06-12 18:00:05 patch lines 83-89: `packages/os/scripts/seed-workspace-edge-route.ts`

## workspace-owned: TDD green evidence

- 2026-06-12 18:00:26 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-route-seed-contract.test.ts`: passed exit 0 trace: `trc_5bc8efb1f304`
  - output: → tmux: opensaas-security-fix-workspace-edge-seed-review-comments-bf262d39 $ vitest run tests/workspace-edge-route-seed-contract.test.ts
- 2026-06-12 18:01:16 `bash -lc CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts tests/workspace-edge-beta-smoke-contract.test.ts`: passed exit 0 trace: `trc_d854fecdf1cf`
  - output: → tmux: opensaas-security-fix-workspace-edge-seed-review-comments-bf262d39 $ vitest run tests/cloudflare-worker-deployment-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts "tests/cloudflare-d1-route-registry.test.ts" tests/workspace-edge-beta-smoke-contract.test.ts

## workspace-owned: validation evidence

- pending
- 2026-06-12 18:04:37 `review.run`: passed — OK
- 2026-06-12 18:05:01 `verify`: passed — OK
- 2026-06-12 18:06:46 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/fix-workspace-edge-seed-review-comments/current.json`, `.task/security/fix-workspace-edge-seed-review-comments/evidence-log.json`, `.task/security/fix-workspace-edge-seed-review-comments/read-log.json`, `.task/security/fix-workspace-edge-seed-review-comments/session.json`, `.task/security/fix-workspace-edge-seed-review-comments/verify.json`, `.task/security/fix-workspace-edge-seed-review-comments/workpad.md`, `.task/tasks/security/fix-workspace-edge-seed-review-comments.json`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/seed-workspace-edge-route.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final implementation notes

- Verified both CodeRabbit findings against current code and reproduced them with focused contract tests.
- Hardened `createWorkspaceEdgeRouteSeedRecord` so whitespace-only `workspaceId`, `workspaceSlug`, `hostname`, `baseDomain`, and `appUpstreamUrl` fall back to canonical defaults before normalization.
- Trimmed connector seed inputs, including `connectorId`, `tunnelOriginUrl`, and `localServiceUrl`, before generating connector routes and D1 seed SQL.
- Exported `readArg` and made it ignore missing values, trailing flags, and flag tokens used as values.
- Guarded the seed script with `import.meta.main` so tests can import `readArg` without executing the seed command.
- No docs update required; this is package-local seed validation and CLI input hardening for an existing script.

## final validation evidence

- Red focused contract: `trc_8aa0a9efda52` — failed on whitespace seed defaults and missing safe `readArg` export.
- Green focused contract: `trc_5bc8efb1f304` — `workspace-edge-route-seed-contract.test.ts`, 5 tests passed.
- Changed-file syntax check: `trc_05e32df5f750` — changed TS files passed.
- Seed script smoke: `trc_8a36fd805573` — missing `--workspace-host` value defaulted to `internal.consuelohq.com`; connector/local/tunnel values were trimmed in emitted SQL.
- Opt-in gateway contracts: `trc_d854fecdf1cf` — 4 files, 18 tests passed.
- `git diff --check`: `trc_f2ebde0e9c96` — passed.
- `git.diff` inspection: `trc_6871c46b7fcc` — inspected working-tree diff.
- `review.run --base origin/stream/security`: `trc_969a2e8ab280` — zero issues, zero blockers.
- `verify --base origin/stream/security`: `trc_04dd4c6d5ebe` — publish-valid true.

## final files changed

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`

- 2026-06-12 18:06:28 append: `.task/security/fix-workspace-edge-seed-review-comments/workpad.md`
