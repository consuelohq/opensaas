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
