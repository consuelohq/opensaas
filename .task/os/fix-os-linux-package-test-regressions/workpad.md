# fix os linux package test regressions

branch: `task/os/fix-os-linux-package-test-regressions`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2521
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/tests/helpers/bun-sqlite-vitest.ts`
- `packages/os/tests/helpers/portable-sqlite.ts`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [x] The OS package suite no longer imports Bun-only builtins through Vitest/Node execution on Linux.
- [x] The artifacts skill registry test matches the canonical post-migration load-path contract.
- [x] Slow subprocess-based installer connectivity coverage is stable under Linux CI without masking functional failures.
- [x] The affected focused tests and the full OS package suite pass locally.
- [x] Strict review and full verify pass before promotion; PR #2499 will be rechecked after promotion.

## plan

1. Inspect the three current CI failures and their neighboring test conventions.
2. Treat GitHub run 35623383266 as the RED baseline; reproduce any deterministic failures locally where possible.
3. Make test-harness/expectation fixes only unless evidence shows a product defect.
4. Run focused suites, strict review, and full verify.
5. Promote to stream/os and rerun PR #2499.

## progress

- RED from GitHub run 35623383266 identified three direct package regressions: Vitest could not resolve bun:sqlite, the artifacts skill test expected the pre-migration load path, and installer connectivity exceeded the default 5s test timeout.
- Added a Vitest-only bun:sqlite compatibility alias backed by Node's sqlite API. Dedicated Bun tests still resolve native bun:sqlite unchanged.
- Corrected post-migration test contracts for artifacts, canonical runtime/trace DB paths, script-parity fixture location, and Bun-owned subprocess workers.
- Made scripts-only audit fixtures independent of yaml by loading yaml only when workspace config is actually read.
- Made trace-request-budget portable under Vitest/Node: URL-based test directory resolution, a streaming Node HTTP test server for EventSource coverage, and portable SQL string literals.
- Full OS package suite GREEN: 376 files passed, 3,364 tests passed; 17 files/161 tests intentionally skipped; 7 todos.
- Strict review GREEN: 0 task issues, 0 blockers.
- Full verify GREEN and publish-valid at 2026-09-21T16:35:49.655Z.

## Test-first contract

behavior under test: the OS package regression suite must be portable across the Linux GitHub runner while continuing to validate the same runtime contracts.
existing local pattern: Vitest-based package tests include Bun subprocess/database helpers, manifest assertions, and integration subprocess tests with explicit timeouts where operations may exceed the default 5s.
new or changed tests: adapt the failing test harnesses/expectations to the canonical runtime rather than weakening assertions.
focused red evidence: GitHub Consuelo / verify run 35623383266 failed on bun:sqlite module resolution, the canonical artifacts skill load path, and a 5s installer connectivity timeout.
expected red failure: package-test execution fails before/asserting intended behavior because of runner/runtime assumptions and stale expected metadata.
no-test waiver: not applicable.

- 2026-09-21 16:12:58 append: `.task/os/fix-os-linux-package-test-regressions/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/helpers/bun-sqlite-vitest.ts`
- `packages/os/tests/helpers/portable-sqlite.ts`

## workspace-owned: activity log

- 2026-09-21 16:12:58 fs.write: `.task/os/fix-os-linux-package-test-regressions/workpad.md`
- 2026-09-21 16:21:26 fs.write: `packages/os/tests/helpers/portable-sqlite.ts`
- 2026-09-21 16:23:00 fs.write: `packages/os/tests/helpers/bun-sqlite-vitest.ts`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/audit.js`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/paths.js`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/skills/artifacts/skill.json`
- `packages/os/tests/artifacts-skill.test.ts`
- `packages/os/tests/audit/audit.test.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/doctor-redaction.test.ts`
- `packages/os/tests/fixtures/os-replica-correctness-worker.ts`
- `packages/os/tests/helpers/bun-sqlite-vitest.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/memory.test.ts`
- `packages/os/tests/os-replica-correctness.test.ts`
- `packages/os/tests/stream-context-memory.test.ts`
- `packages/os/tests/test-environment.ts`
- `packages/os/tests/trace-request-budget.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-route-heartbeat-write-budget.test.ts`
- `packages/os/vitest.config.js`
- `packages/os/vitest.config.ts`

## workspace-owned: validation evidence

- 2026-09-21 16:18:54 `review.run`: passed — OK
- 2026-09-21 16:19:54 `verify`: failed — COMMAND_FAILED
- 2026-09-21 16:21:26 write: `packages/os/tests/helpers/portable-sqlite.ts`
- 2026-09-21 16:21:32 apply-patch: `packages/os/tests/workspace-route-heartbeat-write-budget.test.ts`
- 2026-09-21 16:23:00 write: `packages/os/tests/helpers/bun-sqlite-vitest.ts`
- 2026-09-21 16:23:05 apply-patch: `packages/os/vitest.config.ts`
- 2026-09-21 16:25:29 apply-patch: `packages/os/tests/trace-request-budget.test.ts`
- 2026-09-21 16:25:29 apply-patch: `packages/os/tests/doctor-redaction.test.ts`
- 2026-09-21 16:25:29 apply-patch: `packages/os/tests/memory.test.ts`
- 2026-09-21 16:25:29 apply-patch: `packages/os/tests/os-replica-correctness.test.ts`
- 2026-09-21 16:25:29 apply-patch: `packages/os/scripts/lib/paths.js`
- 2026-09-21 16:25:47 apply-patch: `packages/os/tests/memory.test.ts`
- 2026-09-21 16:27:46 apply-patch: `packages/os/tests/trace-request-budget.test.ts`
- 2026-09-21 16:28:22 apply-patch: `packages/os/tests/trace-request-budget.test.ts`
- 2026-09-21 16:29:53 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-09-21 16:31:01 `review.run`: passed — OK
- 2026-09-21 16:31:15 apply-patch: `packages/os/tests/helpers/bun-sqlite-vitest.ts`
- 2026-09-21 16:31:15 apply-patch: `packages/os/tests/trace-request-budget.test.ts`
- 2026-09-21 16:31:27 `review.run`: passed — OK
- 2026-09-21 16:32:50 `verify`: passed — OK
- 2026-09-21 16:33:56 `verify`: passed — OK
- 2026-09-21 16:34:50 `verify`: passed — OK
- 2026-09-21 16:35:49 `verify`: passed — OK

- 2026-09-21 16:36:46 apply-patch: `.task/os/fix-os-linux-package-test-regressions/workpad.md`