# daily self healing 2026 08 20

branch: `task/self-healing/daily-self-healing-2026-08-20`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2169/daily-self-healing-2026-08-20
github pr: https://github.com/consuelohq/opensaas/pull/2169
started: 2026-08-21

## acceptance criteria

- [x] Reconstruct the governing contracts for the strongest recurring recent OS/tooling failures.
- [x] Fix only bounded, high-confidence source defects not already corrected in current authoritative OS development.
- [x] Add regression coverage before implementation and prove focused RED -> GREEN.
- [ ] Pass strict review/full verify, publish the daily task, promote it into `stream/self-healing`, and publish Daily Schedules without touching `main`.

## plan

1. Synchronize `stream/self-healing` with accepted `main`, inspect current `stream/os`, recent self-healing PRs, and the perpetual review boundary.
2. Build the normalized 24-hour trace report from current source when installed `monitor.errors` is unavailable.
3. Reconstruct candidate contracts, select only source-backed defects, and capture focused RED tests.
4. Implement the smallest fixes, rerun focused/broader tests and normalized monitoring, then run strict review/full verify.
5. Push/promote the daily PR into `stream/self-healing`, publish Daily Schedules, verify the perpetual stream review PR, and stop before `main`.

## current status

- Two related source defects are fixed and validated. Final normalized report is 28 groups: 8 caller-input, 8 defect-candidate, 10 transient, 2 unknown; actionable groups fell from 10 to 8 because `fs.list` missing-directory calls and stale `fs.apply_patch` anchors are now correctly classified as caller input. Strict review has 0 blocking findings and full verify is publish-valid with DB guard 0 risks / 0 findings. Task push/promotion and Daily Schedules publication remain.

## files changed

- `packages/workspace/scripts/stream-sync.js`
- `packages/os/scripts/stream-sync.js`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/workspace/tests/stream-sync-repo-option.test.ts`
- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`

## workspace-owned: files changed

- `packages/workspace/tests/stream-sync-repo-option.test.ts`

## workspace-owned: activity log

- 2026-08-21 01:20:35 fs.write: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`
- 2026-08-21 01:22:52 fs.write: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`
- 2026-08-21 01:23:04 fs.write: `packages/workspace/tests/stream-sync-repo-option.test.ts`
- 2026-08-21 01:24:25 fs.write: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`
- 2026-08-21 01:25:34 fs.write: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`

## workspace-owned: validation evidence

- 2026-08-21 01:26:45 `review.run`: passed — OK
- 2026-08-21 01:27:00 `verify`: passed — OK
- 2026-08-21 01:27:27 `verify`: passed — OK

## key decisions

- Accept `stream.sync --repo` as the compatibility contract advertised by the typed facade instead of removing `repo` from shared `StreamInput`; task/PR promotion already preserves repository identity and valid typed callers must not crash at argv parsing.
- Use persisted stderr only as internal classifier evidence. Strip raw stderr from the normalized monitor report after classification so Daily Schedules stays compact and does not persist large command payloads.
- Do not duplicate the recurring GitHub/session/Daily Schedules failures: current source already contains the GitHub executable-resolution fix and the missing `monitor:errors`, `session:start`, and `daily-schedules` scripts; these are installed-runtime/source drift.
- Do not patch `fs.search` from the current mixed group: recent rows combine missing-path caller input with interrupted-system-call behavior, so the aggregate is not a single high-confidence source defect.

## notes for ko

- Source/base identity for this run: synchronized `origin/stream/self-healing` `b4a0f7263c7aa2c870f07e92b13dc6ca0f06ed32`; accepted `origin/main` `b0e7016159103e3c3850dac6937f7b5333a72450`; inspected `origin/stream/os` `42b152196fd8afabb76169a5d5fb31873f4408eb` for duplicate/current OS work.
- Hosted normalized install/onboarding telemetry was not exposed by the current typed tool surface, so user-impact evidence is limited to local dogfood traces plus repository/PR/runtime evidence. No hosted impact was inferred.

## improvements noticed

- Installed OS facade drift still prevents the canonical `monitor.errors`, `session.start`, and Daily Schedules entrypoints from matching current source. This run uses current source/equivalent supported tooling where the workflow explicitly permits it; no install/update/restart operation is authorized or performed.

## issues and recovery

- Installed `monitor.errors` failed with `Script not found "monitor:errors"`; current source has the implementation, so the equivalent current source report was used.
- The first `stream.sync` attempt reproduced the selected contract defect because the facade forwarded supported `repo` as unsupported `--repo`; retrying without `repo` synchronized the stream successfully before task start.
- Canonical `session.start` failed with `Script not found "session:start"`; `task.start` compatibility tooling created the normal task branch/session/PR/worktree/workpad.
- Typed GitHub inspection currently hits the stale bare-`gh` runtime wrapper; read-only PR inspection used the real `/opt/homebrew/bin/gh` only where needed, while current source was checked to avoid duplicating the already-landed fix.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## Daily self-healing investigation

Date: 2026-08-20
Persistent stream: `stream/self-healing`
Daily task: `task/self-healing/daily-self-healing-2026-08-20`
Task PR: #2169

Pre-task stream synchronization succeeded after one contract-drift retry: the typed `stream.sync` facade forwarded an unsupported `--repo` flag, while the same operation without `repo` synchronized `origin/main` into `stream/self-healing` and passed its selected verification suites. Installed `monitor.errors` and canonical `session.start` both returned `SCRIPT_NOT_FOUND`; current source/equivalent task tooling remains available, so the run continues under the workflow's runtime/source-drift rule.

## Test-first contract

behavior under test: pending candidate selection from the normalized recent trace report; no production edit has been made.
existing local pattern: use the focused contract test adjacent to the affected OS/workspace boundary.
new or changed tests: pending candidate selection.
focused red command: pending candidate selection; must run before implementation when a source fix is justified.
expected red failure: pending candidate selection.
no-test waiver: not applicable unless the selected correction is metadata-only and explicitly justified.

- 2026-08-21 01:20:35 append: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`

## Candidate selection

Selected two related contract-fidelity defects:

1. `stream.sync` advertises and forwards optional `repo`, but both current stream-sync CLIs reject `--repo` as an unknown flag. This reproduced in self-healing and security maintenance runs and again in this run. Current `stream/os` carries the same implementation, so there is no already-fixed authoritative source to duplicate.
2. `monitor.errors` drops persisted stderr before classification, so obvious caller-side filesystem failures such as `fs.list` on nonexistent directories and `fs.apply_patch` anchor mismatches are promoted to recurring defect candidates. The persisted trace rows contain enough evidence to classify these safely without weakening any runtime validation.

Hosted normalized install/onboarding telemetry was not discoverable from the current typed tool surface; this run therefore uses local dogfood traces plus repository/PR evidence and records that telemetry gap.

## Test-first contract update

behavior under test:
- the stream-sync CLI accepts the typed facade's optional `--repo` argument without changing the selected local stream semantics;
- monitor classification receives persisted stderr and keeps known caller-caused filesystem `COMMAND_FAILED` traces out of the defect bucket.

existing local pattern:
- workspace stream-sync tests invoke both mirrored OS/workspace boundaries where behavior is mirrored;
- monitor unit tests assert classification contracts, while report tests use an isolated trace DB to prove persisted selection/aggregation behavior.

new or changed tests:
- add a focused stream-sync CLI option contract test covering workspace and OS scripts;
- extend monitor classifier tests for patch-hunk and invalid-search-path failures;
- extend monitor report test to prove latest persisted stderr reaches classification.

focused red commands:
- `bun test packages/workspace/tests/stream-sync-repo-option.test.ts`
- `bun test packages/os/tests/monitor-errors.test.ts packages/os/tests/monitor-errors-report.test.ts`

expected red failure:
- stream-sync exits nonzero with `unknown flag: --repo`;
- caller filesystem failures remain `defect-candidate` because report aggregation currently omits stderr and classifier has no tool-specific caller-error rule.

no-test waiver: not applicable.

- 2026-08-21 01:22:52 append: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`

- 2026-08-21 01:23:04 write: `packages/workspace/tests/stream-sync-repo-option.test.ts`

- 2026-08-21 01:23:11 apply-patch: `packages/os/tests/monitor-errors.test.ts`
- 2026-08-21 01:23:11 apply-patch: `packages/os/tests/monitor-errors-report.test.ts`
## Red evidence

Focused RED reproduced both selected defects before implementation:

- `bun test packages/workspace/tests/stream-sync-repo-option.test.ts`: 0/2 passed. Both mirrored stream-sync scripts exited 1 when the typed facade's valid `--repo consuelohq/opensaas` argument was present.
- `bun test packages/os/tests/monitor-errors.test.ts packages/os/tests/monitor-errors-report.test.ts`: the new classifier case remained `defect-candidate`, and the report case omitted persisted stderr and classified the single patch mismatch as generic transient evidence. Existing monitor contracts remained green.

This matches the pre-edit contract; production implementation can now proceed.

- 2026-08-21 01:24:25 append: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`

- 2026-08-21 01:24:33 apply-patch: `packages/workspace/scripts/stream-sync.js`
- 2026-08-21 01:24:33 apply-patch: `packages/os/scripts/stream-sync.js`
- 2026-08-21 01:24:33 apply-patch: `packages/os/scripts/lib/monitor-errors-report.ts`
- 2026-08-21 01:24:33 apply-patch: `packages/os/scripts/lib/monitor-errors.ts`
- 2026-08-21 01:24:50 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-21 01:24:50 apply-patch: `packages/workspace/test-selection.registry.json`

## workspace-owned: files read

- none yet

## Contract refinement

The first GREEN exposed one output-quality issue: carrying stderr into classification also surfaced raw stderr in the normalized report. The classifier needs stderr as internal evidence, but Daily Schedules should remain normalized and compact rather than persist large/raw command payloads. Refine the report contract to use persisted stderr for classification and then omit it from published group output. This strengthens the original intent rather than weakening the pretest.

- 2026-08-21 01:25:34 append: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`

- 2026-08-21 01:25:37 apply-patch: `packages/os/tests/monitor-errors-report.test.ts`
- 2026-08-21 01:25:46 apply-patch: `packages/os/scripts/lib/monitor-errors-report.ts`

- 2026-08-21 01:26:24 apply-patch: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`

- 2026-08-21 01:27:16 apply-patch: `.task/self-healing/daily-self-healing-2026-08-20/workpad.md`
