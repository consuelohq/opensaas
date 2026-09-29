# resolve migration stream sync conflicts

branch: `task/twenty-migration/resolve-migration-stream-sync-conflicts`
stream: `stream/twenty-migration`
pr: https://github.com/consuelohq/opensaas/pull/2485
started: 2026-09-20

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(twenty-migration): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: current main must reconcile into the M1-M4 migration stream without resurrecting deleted Twenty application/runtime ownership or dropping current main's newer OS/dialer/test-selection changes.
existing local pattern: stream.sync merges origin/main into the stream, fails closed on source conflicts, and regenerates packages/workspace/test-selection.registry.json from the resolved explicit rules rather than hand-editing generated JSON.
new or changed tests: preserve current-main test-selection coverage; add/retain M4 regression coverage for large suite buffers, --out sidecars, focused Consuelo CI planner selection, and Twenty-free fixture paths; run the existing stream-sync registry recovery and Twenty migration boundary tests.
focused red command: workspace stream.sync --area twenty-migration (2026-09-20)
expected red failure: merge conflict in packages/workspace/test-selection.rules.json, packages/workspace/tests/test-selection.test.js, generated packages/workspace/test-selection.registry.json, and yarn.lock.
red evidence: observed exactly those four conflicts; packages/dialer/src/index.ts and lifecycle-engine.test.ts auto-merged cleanly.
no-test waiver: not applicable.

## Resolution plan

- Merge current origin/main into this task branch created from stream/twenty-migration.
- Preserve current main as the baseline for modern test-selection rules/tests.
- Apply M4 deltas: remove obsolete Twenty project/frontend rule coverage; add consuelo-ci-planner and twenty-migration-os-reference-cleanup; preserve the M4 large-output/sidecar regression tests.
- Regenerate test-selection.registry.json from resolved sources.
- Regenerate yarn.lock from the merged package manifests while Yarn remains the current package manager; M6 will replace Yarn separately.
- Validate migration boundary, test-selection, lifecycle, and canonical verify before promotion.

- 2026-09-21 00:00:05 append: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 00:00:05 fs.write: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`
- 2026-09-21 00:02:00 fs.write: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`
- 2026-09-21 00:06:25 fs.write: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`
- 2026-09-21 00:09:22 fs.write: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`
- 2026-09-21 00:11:04 fs.write: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`
- 2026-09-21 00:11:41 fs.write: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`
- 2026-09-21 00:14:23 fs.write: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`

## Resolution evidence

- Merged current origin/main into the task created from stream/twenty-migration; exactly four expected conflicts reproduced.
- Resolved test-selection source semantically from current main:
  - removed obsolete rules: frontend-lint-config-contract, server-ci-task-contract, twenty-server-project, twenty-front-project;
  - retained M4 rules: consuelo-ci-planner and twenty-migration-os-reference-cleanup;
  - preserved current main's newer explicit rules.
- Rebuilt test-selection.registry.json from the resolved sources: 672 tests, 76 total rules, 62 explicit rules, 14 auto rules.
- Rebuilt yarn.lock with Yarn 4.9.2 update-lockfile mode from the merged manifests; deleted Twenty workspace paths are absent. Existing peer-dependency warnings remain but lock generation succeeded.
- No conflict markers or unresolved index entries remain; git diff --check passed.
- Focused validation:
  - bun test packages/workspace/tests/stream-sync-generated-registry-conflict.test.js: 3 passed.
  - Vitest test-selection + twenty-migration-runtime-boundary: 2 files / 84 tests passed.
  - node packages/os/scripts/check-syntax.js: passed.
  - exact lifecycle handoff suite: 9 files / 143 tests passed.
- An initial combined run invoked the bun:test stream-sync file under Vitest; that file failed to import bun:test under Vitest while the other 84 assertions passed. Re-running with its declared Bun runner passed 3/3; no code change was required for that runner mismatch.

Next: inspect task-push/merge behavior, run strict review + canonical verify, then publish PR #2485 into the stream.

- 2026-09-21 00:02:00 append: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 00:04:06 `review.run`: passed — OK
- 2026-09-21 00:04:34 `review.run`: passed — OK
- 2026-09-21 00:05:45 `verify`: failed — COMMAND_FAILED
- 2026-09-21 00:11:17 `review.run`: passed — OK

## workspace-owned: files read

- none yet

## Verify wait — 2026-09-20

Wait reason: canonical verify is still actively running after the facade call timed out; process inspection shows verify.js and its selected lifecycle Vitest suite are live.
Duration: 30s.
Resume action: inspect the same verify processes and the task verify.json stamp.
Expected signal: verify processes exit and a publish-valid verify record appears.
Fallback: if still active, continue one bounded wait; if exited without a stamp, inspect the persisted evidence/log output before deciding whether a retry is warranted.

- 2026-09-21 00:06:25 append: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`

## Full verify integration failure

Canonical verify against origin/main completed with a real critical-suite failure:
- failing rule: twenty-migration-os-reference-cleanup
- failing suite: OS code.call snapshot contracts
- failing assertion: packages/os/tests/code-call-service-architecture.test.ts requires every code-call module to contain no raw `try { }` / `catch (...)` orchestration.
- current main's packages/os/scripts/lib/code-call/location.ts contains two raw synchronous try/catch helpers (`gitOutput` and `canonicalGitPath`), and HEAD is otherwise identical to origin/main for that file.
- decision: preserve the architecture contract and repair location.ts using non-throwing/guarded synchronous primitives; do not weaken or remove M4's focused rule.
- RED evidence: full verify selected the focused M4 rule and failed the architecture suite at code-call-service-architecture.test.ts:80. CLI package tests and DB guard were green in the same run.

- 2026-09-21 00:09:22 append: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`

- 2026-09-21 00:10:23 apply-patch: `packages/os/scripts/lib/code-call/location.ts`
- 2026-09-21 00:10:47 apply-patch: `packages/os/scripts/lib/code-call/process.ts`
## Code-call architecture integration repair — GREEN

- Enumerated all raw await/try/catch matches under packages/os/scripts/lib/code-call after the first fix; only process.ts remained.
- location.ts:
  - gitOutput now captures sync git failures through Effect.try + Effect.catchAll + Effect.runSync.
  - canonicalGitPath now reuses realpathIfExistsEffect through Effect.runSync.
- process.ts:
  - canonicalPath now uses Effect.try/catchAll/runSync instead of raw try/catch.
  - synchronous stdin.end failure capture now uses Effect.try/catchAll/runSync while preserving EPIPE/ERR_STREAM_DESTROYED tolerance and rethrowing unexpected failures.
- Focused architecture/snapshot suite: 2 files / 6 tests passed.
- Broader code.call regression suite: 4 files / 43 passed, 1 existing skip.
- The fix preserves the M4 architecture contract instead of weakening the test or test-selection rule.

- 2026-09-21 00:11:04 append: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`

## Full verify retry plan — after code-call repair

Wait reason: run canonical verify on committed HEAD fa1f0c786e after repairing the integration-only code.call architecture failures.
Duration: poll every 30s while the single verify process is active.
Resume action: read /tmp/twenty-migration-sync-verify-final.json, stderr, and verify.json as soon as the process exits.
Expected signal: passed=true and publishValid=true with no critical failed suites.
Fallback: inspect the exact failed selected suite before any further code change; do not launch duplicate verify processes while one is active.

- 2026-09-21 00:11:41 append: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`

## Canonical integration gate — GREEN

- Strict review against origin/main: 0 blocking findings.
- Canonical full verify on HEAD fa1f0c786e: passed=true, publishValid=true.
- Critical M4 deletion boundary suite passed.
- Critical OS code.call snapshot/architecture suite passed after the integration repair.
- OS work-session Code Call/MCP authority contracts passed.
- Consuelo CI planner contracts passed.
- CLI package tests passed 10/10.
- DB guard passed with 0 risks/findings.
- Published the real two-parent merge ancestry to the task branch: remote head fa1f0c786e contains both origin/main and origin/stream/twenty-migration as ancestors.

- 2026-09-21 00:14:23 append: `.task/twenty-migration/resolve-migration-stream-sync-conflicts/workpad.md`
