# Daily self-healing 2026-08-25

branch: `task/self-healing/daily-self-healing-2026-08-25`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2180/daily-self-healing-2026-08-25
github pr: https://github.com/consuelohq/opensaas/pull/2180
started: 2026-08-25 (America/New_York; task service timestamp crossed 2026-08-26 UTC)

## acceptance criteria

- [x] Run the canonical 24h self-healing evidence path and classify non-OK traces by current contracts rather than recurrence alone.
- [x] Check current main, `stream/self-healing`, current authoritative OS development, open/recent OS work, and hosted-user evidence when available before selecting a source fix.
- [x] Fix only one to four coherent, high-confidence OS/tooling defects if the evidence justifies a bounded correction; otherwise record a truthful no-source-change day.
- [x] Run focused regression/validation evidence appropriate to any selected fix and obtain a publish-valid verify stamp against `origin/stream/self-healing`.
- [ ] Push the daily task, promote it only into `stream/self-healing`, preserve the human-only `stream/self-healing -> main` boundary, and publish the normalized report + generated workpad to Daily Schedules.

## plan

1. Reconstruct the 24-hour failure report from the current self-healing source because the installed `monitor.errors` facade is missing its runtime script.
2. Inspect actionable groups against current tool contracts, current source, recent stream/main history, current `stream/os`, and normalized hosted evidence/Sentry when available.
3. Select the smallest coherent root-cause correction only when evidence proves a source defect; write/run a focused RED regression before production edits.
4. Run focused GREEN coverage, diff review, strict review, and full verify against the task start point.
5. Update this generated workpad, push/promote the daily task to `stream/self-healing`, publish Daily Schedules, and stop before `main`.

## current status

- Task started from synchronized `stream/self-healing` at source head `8954b32f9a098c2fbf4e816273431dc4beb51288`.
- Installed `monitor.errors` failed with `Script not found "monitor:errors"`; current stream source contains the script and focused contracts, so the run is continuing through the current-source equivalent rather than treating the facade drift as a new source defect.
- Installed `stream.sync` rejected the typed optional `repo` flag; retry without that stale-runtime flag succeeded and verified the stream against current `origin/main` with no merge conflict.
- Final current-source monitor report was refreshed at `.task/self-healing/daily-self-healing-2026-08-25/monitor-errors-report.json`: 11 groups total, 3 caller-input, 2 defect-candidate, 4 transient, 2 unknown, 2 actionable. Later investigation added only caller/transient/wrapper evidence; the actionable set did not change.
- The two actionable groups are `github/COMMAND_FAILED` (5 occurrences) and `monitor.errors/COMMAND_FAILED` (3 occurrences). Both are installed-runtime/source drift, not missing current-source fixes: the task source already resolves a real external `gh` outside Consuelo wrapper paths and already defines `monitor:errors` plus its focused classifier/report contracts.
- Installed runtime identity is Consuelo OS `0.1.67`, bundle `sha256:424824f9f75c32c657fc754f7ce975ab1a103c3159ec12351cf7b6ddf6b5a263`; its last durable update completed 2026-08-17, before the accumulated self-healing fixes.
- Repository state checked: `origin/main` `b0e7016159`, `origin/stream/self-healing` `8954b32f9a` with `0 main-only / 35 self-healing-only` commits, and `origin/stream/os` `db29ab059c` with `2 main-only / 175 os-only` commits. Current `stream/os` head is the owner-auth recovery task; it does not overlap today’s GitHub/monitor runtime-drift candidates.
- Perpetual human review PR #1941 is OPEN, MERGEABLE/CLEAN (`stream/self-healing -> main`). No open daily self-healing task PR existed before this run; today’s task is PR #2180.
- Recent merged OS work to `main` was also checked (most recent stream/os merge PR #2155 on 2026-08-17). No newer main fix supersedes or conflicts with the current self-healing implementations under investigation.
- Hosted normalized install/onboarding telemetry is not exposed by the current typed tool surface. Read-only Sentry inspection found zero unresolved issues in the last 24 hours, so no hosted-user impact is inferred.

## files changed

- No production source files changed.
- Generated task record only: this workpad, normalized `monitor-errors-report.json`, and task-owned validation metadata.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Current-source normalized monitor report generated and persisted successfully from the task worktree after the installed `monitor.errors` script lookup failed.
- Read-only Sentry issue search for `is:unresolved`, 24h: zero issues.
- Direct current GitHub evidence used `/opt/homebrew/bin/gh` only after the typed GitHub facade demonstrably failed from installed wrapper recursion; PR #1941 is OPEN, MERGEABLE, CLEAN.
- Test safety preflight scanned the four selected test files for destructive literals and found none.
- Focused current-source contracts passed 15/15: monitor report/classifier 11, mirrored GitHub external-CLI resolution 2, mirrored stream-sync typed `repo` compatibility 2. Evidence trace: `trc_5a4dbad3f4ae`.
- 2026-08-26 01:38:21 `review.run`: passed — OK
- 2026-08-26 01:38:48 `review.run`: passed — OK
- 2026-08-26 01:41:25 `verify`: passed — OK
- Official full verify against `origin/stream/self-healing` passed with `publishValid=true`, 0 task-attributable issues, 0 blocking issues, and DB guard 0 risks / 0 findings. Existing repository-wide lint/typecheck debt was classified pre-existing and did not affect this no-source-change task.
- 2026-08-26 01:45:26 `verify`: passed — OK

## key decisions

- Treat installed facade/script drift as evidence to reconcile with current source before changing code; do not duplicate fixes already present in `stream/self-healing` or current OS development.
- Remediation decision: no source change. Today’s only high-confidence actionable groups are already corrected in current source; the correct action is to validate those contracts and record installed-runtime drift rather than manufacture duplicate edits.

## candidate investigation

- `github/COMMAND_FAILED` — 5 occurrences, one task session. Reproduced by the installed facade resolving `gh` to the Consuelo wrapper and recursively parsing `gh api`. Current workspace/OS `github.js` calls `resolveGitHubCli()`, whose contract skips `$CONSUELO_HOME/bin`/`~/.consuelo/bin`; focused regression coverage exists in `packages/workspace/tests/github-cli-resolution.test.ts`. Classification: installed-runtime/source drift; no new source edit.
- `monitor.errors/COMMAND_FAILED` — 3 occurrences. Installed facade reports `Script not found "monitor:errors"`. Current `packages/os/package.json` defines `monitor:errors`, current source contains `scripts/monitor-errors.ts`, and focused monitor contracts are present. Classification: installed-runtime/source drift; no new source edit.
- `stream.sync/COMMAND_FAILED` — 2 occurrences and therefore non-actionable in the normalized report. Today’s observed failure is the installed script rejecting the typed `--repo` option; current source has a dedicated mirrored `stream-sync-repo-option` regression. Classification: installed-runtime/source drift/transient evidence; no duplicate source edit.
- `session.start` validation/command failures are caller-input or isolated transient evidence under the advertised strict schema; no contradictory contract was found.
- `batch` and `code.call` command failures propagate child-command failures and remain non-actionable wrapper evidence by contract.

## notes for ko

- Today is intentionally a no-source-change day: every high-confidence actionable signal is already fixed in current source and is waiting on the human-controlled stream review/release/update path to reach the installed runtime.
- Human boundary remains PR #1941, `stream/self-healing -> main`; never merge it autonomously.

## improvements noticed

- The installed typed facades are materially behind current source (`monitor.errors`, GitHub CLI resolution, and `stream.sync --repo`). That drift is now the dominant maintenance signal rather than a new implementation defect.

## issues and recovery

- `monitor.errors` facade: `COMMAND_FAILED`, `Script not found "monitor:errors"`, trace `trc_fcdc4b1815b1`. Recovery: use the source-equivalent monitor implementation in this task worktree and persist the same normalized report.
- First `stream.sync` call included the advertised typed `repo` option and failed because the installed script still rejects `--repo`, trace `trc_4fdbfc759c8b`. Retried with the smallest compatible call; sync passed and pushed no conflicting code.
- Typed `review.run` surfaced an orchestration-layer `ExceptionGroup` rather than a review result. The current-source review script was used as the allowed compatibility fallback; it returned zero task findings/blockers, and the canonical `verify` tool subsequently completed successfully and produced the publish-valid stamp.

## Test-first contract

behavior under test: no new production behavior; validate that current source already enforces the GitHub CLI, monitor, and stream-sync invariants implicated by installed-runtime failures
existing local pattern: `packages/os/tests/monitor-errors.test.ts` and the focused self-healing/tool-specific suites selected by workspace verification
new or changed tests: none; no current-source defect was selected after contract reconstruction
focused red command: not run because there is intentionally no production source edit
expected red failure: not applicable
no-test waiver: justified for this no-source-change maintenance record; existing focused monitor/GitHub/stream-sync contracts were run green to prove the current-source invariants already cover every high-confidence candidate

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/monitor-errors.ts`

- 2026-08-26 01:45:15 apply-patch: `.task/self-healing/daily-self-healing-2026-08-25/workpad.md`
