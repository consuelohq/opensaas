# Add script parity audit tests

branch: `task/os/add-script-parity-audit-tests`
stream: `stream/os`
task pr: https://github.com/consuelohq/opensaas/pull/989
started: 2026-06-13

## Acceptance Criteria

- [x] Add focused Vitest audit for script parity between `packages/workspace/scripts` and `packages/os/scripts`.
- [x] Compute workspace-only, OS-only, changed same-path, and unchanged same-path script inventory.
- [x] Fail when workspace-only, OS-only, or changed same-path scripts lack classifications.
- [x] Fail when classification entries are stale or useful reasons are missing.
- [x] Track the nine high-risk scripts explicitly.
- [x] Classify hardcoded portability terms: `Ko`, `Kokayi`, `kokayi`, `@kokayi`, `/Users/kokayi`, `consuelohq/opensaas`, `opensaas`, `SUPABASE_URL`, `SUPABASE_KEY`, `stream/workspace`, `stream/workspace-agents`.
- [x] Ensure `Ko` preferred replacement contains `user`.
- [x] Encode context backend contract: SQLite standalone default, Supabase optional remote/sync, missing Supabase env must not break standalone OS usage.
- [x] Keep known manifest drift visible for follow-up PR: `task.start`, `task.push`, `task.pr`, `task.prs`, `task.finish`, `task.init`, `task.merge`, `task.exec`, `tools.search`.
- [x] Avoid broad script sync, OS-only deletion, hardcoded value replacement, or productization rewrite.

## Test-first Contract

Behavior under test:
- `packages/os/tests/audit/script-parity-audit.test.ts` reads both script trees, builds the current inventory, and validates the classification JSON as the executable parity contract.
- Missing, stale, weak, or category-incompatible script classifications fail the focused test.
- Hardcoded portability terms, context backend intent, high-risk scripts, and manifest drift are data requirements in the baseline.

Existing pattern:
- OS tests use Vitest under `packages/os/tests/**` and source-contract tests read local files directly.
- `packages/os/tests/tool-manifest.test.ts` uses JSON fixture validation and package-root relative reads.

Focused red command:
```bash
cd packages/os && bun run test -- tests/audit/script-parity-audit.test.ts
```

Expected red failure:
- The newly added test should fail because `packages/os/tooling/script-parity-classifications.json` is missing.

No-test waiver: not applicable.

## Implementation Notes

- Added `packages/os/tests/audit/script-parity-audit.test.ts` first.
- Confirmed red failure from missing classification JSON.
- Generated `packages/os/tooling/script-parity-classifications.json` from current inventory.
- Baseline currently classifies 188 script paths:
  - `same`: 47
  - `changed-needs-review`: 57
  - `workspace-only-needs-port`: 23
  - `os-only-intentional`: 61
- High-risk scripts are marked explicitly through `highRiskScripts` and high-risk reasons on their script entries.
- Context backend contract is encoded as data, with `standaloneDefault: sqlite`, `sqliteStandaloneDefault: true`, `supabaseOptionalRemoteSync: true`, and `missingSupabaseEnvBreaksStandalone: false`.
- Manifest drift remains an explicit list for a later PR instead of being fixed here.

## Files Changed

- `.task/os/add-script-parity-audit-tests/workpad.md`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tooling/script-parity-classifications.json`

## Red Evidence

Command:
```bash
cd packages/os && bun run test -- tests/audit/script-parity-audit.test.ts
```

Result: failed as expected, trace `trc_241a8b4f0061`.

Signal:
```text
AssertionError: Missing script parity classification baseline at packages/os/tooling/script-parity-classifications.json: expected false to be true
```

Note: an earlier attempted command, `bun --cwd packages/os run test -- ...`, printed Bun help and exited 0. It is not used as evidence.

## Green Evidence

Command:
```bash
cd packages/os && bun run test -- tests/audit/script-parity-audit.test.ts
```

Result: passed, trace `trc_90b1a5113fa2`.

Output:
```text
1 file passed, 1 test passed
```

## Broader Validation

Command:
```bash
cd packages/os && bun run typecheck
```

Result: passed, trace `trc_873a08b80184`.

Output:
```text
workspace script syntax checks passed
```

## Follow-up Notes

- PR 2 should review the 57 changed same-path scripts and decide which changes are real OS portability requirements.
- PR 2 should handle the 23 workspace-only scripts, especially `diff_cockpit.ts`, `os-release-install.ts`, `lib/pr-ref.js`, and `lib/stream-workpads.js`.
- Portability replacements for personal/user/repo/stream/Supabase terms are intentionally classified here and intentionally not applied.
- Context backend work should preserve SQLite as standalone default and keep Supabase optional.
- Manifest drift list should drive a separate tool-surface reconciliation PR.

## Issues and Recovery

- `task.start` with a title created an accidental branch/PR (`task/os/add-os-script-parity-audit-tests`, PR #993). I recovered the requested PR #989 session from `.task/os/add-script-parity-audit-tests/session.json` and used `tsk_f559fea80ce6` for all task-scoped work after recovery.
- `code.call` edit mode is gated even with a task session, so file mutations used typed `fs.write`; inventory generation used a temp generator run through task-scoped `task.call`.
- Removed accidental `.pr1-write-probe` from the PR #989 worktree.

- 2026-06-13 05:24:33 write: `.task/os/add-script-parity-audit-tests/workpad.md`

## workspace-owned: files changed

- `.task/os/add-script-parity-audit-tests/workpad.md`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tooling/script-parity-classifications.json`

## workspace-owned: activity log

- 2026-06-13 05:24:33 fs.write: `.task/os/add-script-parity-audit-tests/workpad.md`
- 2026-06-13 05:25:24 fs.write: `.task/os/add-script-parity-audit-tests/workpad.md`

## workspace-owned: validation evidence

- 2026-06-13 05:24:59 `review.run`: passed — OK
- 2026-06-13 05:25:12 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/add-script-parity-audit-tests/current.json`, `.task/os/add-script-parity-audit-tests/evidence-log.json`, `.task/os/add-script-parity-audit-tests/read-log.json`, `.task/os/add-script-parity-audit-tests/session.json`, `.task/os/add-script-parity-audit-tests/workpad.md`, `.task/tasks/os/add-script-parity-audit-tests.json`, `packages/os/tests/audit/script-parity-audit.test.ts`, `packages/os/tooling/script-parity-classifications.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Review and Verify

- `review.run --base origin/stream/os --scope changed`: passed, trace `trc_cb53d0d4e7cd`, 0 issues, 0 blockers.
- `verify --base origin/stream/os`: passed publish-valid, trace `trc_3d978d1d47f6`.
- Verify selected zero automatic suites for the changed files; the manual focused audit test above is the suite required for this PR.

- 2026-06-13 05:25:24 append: `.task/os/add-script-parity-audit-tests/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/task-session.js`
- `packages/os/scripts/task-push.js`
