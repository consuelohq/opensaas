# seed test selection registry

branch: `task/workspace-agents/seed-test-selection-registry`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/587/seed-test-selection-registry
github pr: https://github.com/consuelohq/opensaas/pull/587
taskSession: `tsk_872edff37081`
started: 2026-05-24
startFrom: `stream` because this builds directly on unshipped verify `because` output in `stream/workspace-agents`.

## objective

Seed a deterministic test-selection registry from all existing repo tests, add policy/rules for critical surfaces, and integrate it into `verify` so changed areas run the tests they should run.

## acceptance criteria

- [ ] Discover and count existing tests before writing implementation code.
- [ ] Add a generated registry seeded from current tests.
- [ ] Add explicit source-to-test rules for non-obvious and critical areas.
- [ ] Add a generator/check script that reports discovered, mapped, unmapped, matched rules, selected suites, and zero-suite reasoning.
- [ ] Integrate test selection into `verify` and include it in `because` output.
- [ ] Fail or warn appropriately when changed code selects zero suites, with critical surfaces treated strictly.
- [ ] Add a nightly report mode writing `/tmp/opensaas-test-reports/latest.md` and `/tmp/opensaas-test-reports/latest.json`.
- [ ] Update owning docs/scripts and generated surfaces if needed.
- [ ] Validate with focused tests, script smokes, audit, formal verify, push, and stream PR.

## plan

1. Explore prior context and current test/review/verify code.
2. Enumerate every existing test file and package test command before editing.
3. Decide registry shape from actual repo structure.
4. Implement generator/check/nightly script plus seed registry and explicit rules.
5. Wire verify to run selected registry tests and emit clear selection reasoning.
6. Validate selection against representative changed files.
7. Publish through the task workflow.

## discovery status

Pending. No implementation code edits before test inventory is captured.

- 2026-05-24 08:50:27 write: `.task/workspace-agents/seed-test-selection-registry/workpad.md`

## files changed

- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-05-24 08:50:27 fs.write: `.task/workspace-agents/seed-test-selection-registry/workpad.md`
- 2026-05-24 08:53:47 fs.write: `.task/workspace-agents/seed-test-selection-registry/workpad.md`
- 2026-05-24 08:55:17 fs.write: `packages/workspace/test-selection.rules.json`
- 2026-05-24 08:56:00 fs.write: `packages/workspace/scripts/test-selection.js`
- 2026-05-24 08:57:48 fs.write: `packages/workspace/tests/test-selection.test.js`
- 2026-05-24 09:04:29 fs.write: `.task/workspace-agents/seed-test-selection-registry/workpad.md`

## discovery pass before implementation

Initial broad scan was too permissive because the task worktree path contained `test`; it matched many source files. I reran discovery against repo-relative paths only.

Refined test inventory:

- 2,158 test-like TypeScript/JavaScript files discovered.
- Top groups:
  - `packages/twenty-server`: 1,148
  - `packages/twenty-front`: 724
  - `packages/twenty-shared`: 71
  - `packages/twenty-sdk`: 63
  - `packages/consuelo-design`: 62
  - `packages/twenty-e2e-testing`: 17
  - `packages/workspace`: 13
  - `packages/api`: 12
  - `packages/dialer`: 10
- Pattern groups:
  - `__tests__`: 1,242
  - `test/`: 687
  - `*.spec.*`: 144
  - `*.test.*`: 75
  - `tests/`: 2
  - `*.e2e.*`: 1

Package/project test command discovery:

- 11 `package.json` files with test-like scripts.
- 15 `project.json` files with lint/typecheck/test targets.
- Important project test targets found:
  - `twenty-server`: `test`, `test:integration`, `jest`, `generate:integration-test`
  - `twenty-front`: `test`, Storybook test targets
  - `twenty-sdk`: unit/integration/e2e test targets
  - `twenty-shared`, `twenty-ui`, `twenty-zapier`, `twenty-eslint-rules`, `twenty-e2e-testing`, `fireflies`, `create-twenty-app`: test targets
  - `openworkspace` has `typecheck` in `project.json` and `vitest run` in `packages/workspace/package.json`

Workspace tests discovered:

- `packages/workspace/tests/audit/audit.test.ts`
- `packages/workspace/tests/chunker.test.js`
- `packages/workspace/tests/codemode.test.ts`
- `packages/workspace/tests/context-trace.test.js`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/git-diff.test.ts`
- `packages/workspace/tests/github.test.ts`
- `packages/workspace/tests/pr-links.test.js`
- `packages/workspace/tests/research-ingest.test.js`
- `packages/workspace/tests/task-meta.test.ts`
- `packages/workspace/tests/task-session.test.js`
- `packages/workspace/tests/task-workpad.test.ts`
- `packages/workspace/tests/verification.test.js`

Selected approach:

- Add a generated registry seeded from repo-relative test discovery.
- Add explicit committed rules for critical/non-obvious surfaces, especially workspace tooling.
- Use the registry in `verify` as an additional affected-test policy check.
- Keep current review static/lint/typecheck behavior; add registry-selected tests as the missing test ownership layer.

- 2026-05-24 08:53:47 append: `.task/workspace-agents/seed-test-selection-registry/workpad.md`

- 2026-05-24 08:55:17 write: `packages/workspace/test-selection.rules.json`

- 2026-05-24 08:56:00 write: `packages/workspace/scripts/test-selection.js`

- 2026-05-24 08:57:48 write: `packages/workspace/tests/test-selection.test.js`

## workspace-owned: validation evidence

- 2026-05-24 09:00:53 `audit`: failed — COMMAND_FAILED
- 2026-05-24 09:01:37 `audit`: passed — OK
- 2026-05-24 09:02:07 `verify`: failed — COMMAND_FAILED
- 2026-05-24 09:02:49 `verify`: passed — OK

## implementation summary

Implemented seeded test selection:

- Added `packages/workspace/scripts/test-selection.js` with `generate`, `check`, and `nightly` modes.
- Added `packages/workspace/test-selection.rules.json` for explicit critical/non-obvious source-to-test mappings.
- Generated `packages/workspace/test-selection.registry.json` seeded from current repo tests.
- Added `packages/workspace/tests/test-selection.test.js` covering discovery, mapping for verify changes, and zero-suite warnings.
- Added package scripts: `test-selection`, `test-selection:generate`, `test-selection:check`, `test-selection:nightly`.
- Updated `verify` to run `test-selection check --run --json` as part of the publish gate.
- Updated `verify` because output to include registry-selected suites.
- Updated `SCRIPTS.md`.

Seeded inventory:

- 2,158 test-like JS/TS files discovered from repo-relative paths.
- 2,077 mapped through generated + explicit rules.
- 81 unmapped tests remain for future registry improvement.
- 19 rules total: 10 explicit, 9 auto-generated.
- Largest groups: twenty-server 1,148; twenty-front 724; workspace 13; api 12; dialer 10.

Validation evidence:

- `node --check packages/workspace/scripts/test-selection.js`: passed.
- `node --check packages/workspace/scripts/verify.js`: passed.
- `bun test packages/workspace/tests/test-selection.test.js`: passed, 3 tests / 16 assertions.
- `node packages/workspace/scripts/test-selection.js check --base origin/stream/workspace-agents --run --json`: passed and ran verification, test-selection, and audit suites.
- `node packages/workspace/scripts/test-selection.js nightly --json`: wrote `/tmp/opensaas-test-reports/latest.md` and `/tmp/opensaas-test-reports/latest.json`.
- `node packages/workspace/scripts/test-selection.js check --changed-file packages/dialer/src/dialer.ts --json`: selected `dialer specs`.
- `node packages/workspace/scripts/test-selection.js check --changed-file packages/unknown/src/example.ts --json`: returned a warning with zero-suite reason.
- `audit --scripts`: passed, 56 documented / 56 actual.
- Direct formal `bun run verify -- --base origin/stream/workspace-agents`: passed. The because section now shows registry selected 3 suites and passed.
- `git.diff`: inspected.

Notes:

- The current running server will only show the new `testSelection` field in typed `verify` responses after this task ships/restarts. Direct task-worktree verify already proves the new behavior.

- 2026-05-24 09:04:29 append: `.task/workspace-agents/seed-test-selection-registry/workpad.md`
