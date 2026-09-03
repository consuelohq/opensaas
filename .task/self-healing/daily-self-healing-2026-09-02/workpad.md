# daily self healing 2026 09 02

branch: `task/self-healing/daily-self-healing-2026-09-02`
stream: `stream/self-healing`
pr: https://github.com/consuelohq/opensaas/pull/2373
started: 2026-09-03
source commit: `1ff1ca7785e689e1e4ff5b9e93f8ba4ebca8bc58`

## acceptance criteria

- [x] Produce the deterministic last-24h OS health report and classify serious candidates from evidence rather than raw non-OK count.
- [x] Check current `main`, `stream/self-healing`, recent OS merges, authoritative OS development, and open daily self-healing tasks so no accepted/current fix is duplicated.
- [x] Investigate the highest-leverage real OS/tooling candidates and make at most four coherent bounded source fixes only when contract and regression evidence justify them.
- [x] Preserve auth, validation, task/session, safety, and provider-failure boundaries; do not hide or swallow failures.
- [x] Run focused regression evidence plus strict review/full verify for any source change, or record a truthful no-source-change decision.
- [ ] Push the daily task, promote it only into `stream/self-healing`, leave the perpetual stream review PR as the human boundary, and publish the normalized report + generated workpad to Daily Schedules.

## plan

1. Recover the deterministic `monitor.errors` report from current source because installed OS `0.1.102` exposes the tool but lacks the `monitor:errors` script.
2. Reconstruct contracts for the top actionable groups using current source, generated manifests, recent PRs, and runtime identity; check normalized hosted-user evidence/Sentry where exposed.
3. Select zero to four coherent root causes. Before any production edit, replace the pending Test-first contract below with the exact behavior/test and run RED; otherwise record an explicit no-source-change decision.
4. Run focused GREEN plus review/verify, inspect the diff, update this workpad, push, promote to `stream/self-healing`, publish Daily Schedules, and verify PR/artifact state.

## current status

- Canonical installed `monitor.errors` failed first with `Script not found "monitor:errors"` (`trc_0fd7482e065a`), so this is recorded as installed-runtime/source drift and the current-source equivalent will be used for the deterministic report.
- Installed lifecycle status is valid OS `0.1.102`, canary channel.
- `stream/self-healing` was synchronized before task start; retrying installed `stream.sync` without its stale `--repo` facade argument succeeded with `Already up to date` and focused sync verification green.
- GitHub comparison after sync: `stream/self-healing` is 56 commits ahead / 0 behind `main`; perpetual PR #1941 is OPEN/CLEAN with 51/51 checks complete and no failures.
- Recent OS development is no longer ahead of main: recent `stream/os` review PRs through #2371 were merged to `main`; the current `stream/os` context was behind main, so it is evidence only, not a duplicate-fix target.
- Historical daily task PRs #2358 (Aug 31) and #2267 (Aug 28) remain open and are being treated as separate prior work, not silently adopted or deleted.
- Initial current-source monitor report: 20 groups — 1 expected-policy, 7 caller-input, 2 defect-candidate, 6 transient, 0 external, 4 unknown; the only actionable groups were `mac.call/COMMAND_FAILED` (12 occurrences) and `fs.list/COMMAND_FAILED` (3 occurrences).
- Raw candidate reconstruction showed `mac.call` was aggregating arbitrary caller-selected host commands: normal `pgrep`/`grep` no-match exits, invalid Hammerspoon CLI/Lua calls, and caller-selected 30ms shell timeouts. The `mac.call` contract is an emergency arbitrary-host-command escape hatch, so a child nonzero exit is insufficient evidence of wrapper failure; explicit parse failures remain actionable.
- The three `fs.list` failures were caller-selected `mods`, `resourcepacks`, and `shaderpacks` paths that did not exist under the resolved repo root; eza reported `No such file or directory (os error 2)`. This is equivalent to already-recognized missing-directory caller input, not a filesystem implementation defect.
- Final post-fix normalized report is persisted at `.task/self-healing/daily-self-healing-2026-09-02/monitor-errors-report.json`: 21 groups — 1 expected-policy, 8 caller-input, 0 runtime-contract-drift, 0 defect-candidate, 7 transient, 0 external, 5 unknown, 0 actionable.
- The isolated `authorization.mcp/OAUTH_INTROSPECTION_UNAVAILABLE` trace occurred once and only reports that introspection was temporarily unavailable; it remains unknown/non-actionable. Read-only Sentry inspection found 0 unresolved issues in the last 24h. No normalized hosted install/onboarding impact read surface was exposed by the current tool catalog, so no hosted-user impact was inferred.
- Focused GREEN: 26/26 monitor classifier/report tests passed (`trc_2324eedd59c8`). Strict review passed with 0 blocking issues (`trc_a2a923938bc6`). Full verify against `origin/stream/self-healing` is publish-valid, with review green and DB guard 0 risks / 0 findings (`trc_386ef0f8b26d`).

## Test-first contract

behavior under test: recurring arbitrary `mac.call` child-command exits and `fs.list` calls against nonexistent caller-selected directories must not become OS defect candidates solely because they recur; true wrapper/parsing failures must remain actionable
existing local pattern: `packages/os/tests/monitor-errors.test.ts` already exempts recurring arbitrary `code.call`/`batch` child exits and several deterministic filesystem caller mistakes while retaining negative controls
new or changed tests: add a `mac.call COMMAND_FAILED` recurrence case plus a `PARSE_ERROR` negative control; add the observed eza `No such file or directory (os error 2)` `fs.list` case plus an unrelated fs.list wrapper-failure negative control
focused red command: `bun test packages/os/tests/monitor-errors.test.ts`
expected red failure: the two new positive attribution cases currently classify as `defect-candidate`/actionable; existing negative controls remain green
no-test waiver: not applicable

RED evidence: `bun test packages/os/tests/monitor-errors.test.ts` produced 19 pass / 2 fail (`trc_6f3155c0fcaf`), failing exactly the new `mac.call COMMAND_FAILED` and eza-backed missing-directory `fs.list` expectations. The `mac.call PARSE_ERROR` and unrelated `fs.list` wrapper-failure negative controls remained green.

## files changed

- `packages/os/scripts/lib/monitor-errors.ts` — stop recurrence alone from promoting arbitrary `mac.call` child exits; recognize eza missing-directory `fs.list` failures as caller input.
- `packages/os/tests/monitor-errors.test.ts` — regression coverage plus negative controls for both attribution boundaries.
- `.task/self-healing/daily-self-healing-2026-09-02/monitor-errors-report.json` — deterministic normalized 24h report for publication.

## key decisions

- Start from the synchronized persistent self-healing stream, not `main`, because this daily task is explicitly an accumulation lane.
- Treat installed-script failures as drift evidence, not a reason to duplicate source fixes; use current-source equivalents only where this maintenance workflow permits fallback.
- Select one coherent root cause: monitor attribution was over-weighting recurrence for two caller-controlled execution/path families. Correct classification only; do not change `mac.call`, `fs.list`, exception propagation, permissions, validation, or trace persistence.
- Classify recurring `mac.call COMMAND_FAILED` as `unknown`/non-actionable rather than caller-input because the child command can fail for caller, host, or external reasons; retain `PARSE_ERROR` and other genuinely wrapper-shaped failures as defect candidates.
- Extend only the existing `fs.list` missing-directory rule with eza's exact `No such file or directory (os error 2)` evidence; leave unrelated `fs.list` command failures actionable.

## notes for ko

- No deployment, release, install/update/restart, IAM, credential, or production-resource mutation is in scope.
- This run fixes the health monitor's attribution, not the underlying caller-selected commands. No trace is suppressed; the same non-OK records remain visible with more accurate classification.

## improvements noticed

- none yet

## errors i ran into

- Installed `monitor.errors`: `Script not found "monitor:errors"` (`trc_0fd7482e065a`).
- Installed `stream.sync` facade forwarded unsupported `--repo`; retry without `repo` succeeded (`trc_7c2a93cb6935` was the failed compatibility attempt).
- The first current-source `code.call` attempt ran the root package and reproduced the same missing script; rerunning from `packages/os` produced the report.
- One report-persistence helper attempted a relative module import from code.call's temporary program directory and failed (`trc_ba5a63f1c36c`); it was recovered without source changes by running the package script in `packages/os` and writing its JSON output into the generated task directory.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-03 01:18:08 write: `.task/self-healing/daily-self-healing-2026-09-02/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-03 01:18:08 fs.write: `.task/self-healing/daily-self-healing-2026-09-02/workpad.md`

## workspace-owned: files read

- `packages/os/tests/monitor-errors.test.ts`

## workspace-owned: validation evidence

- 2026-09-03 01:20:50 `review.run`: passed — OK
- 2026-09-03 01:21:00 `verify`: passed — OK

- 2026-09-03 01:21:21 apply-patch: `.task/self-healing/daily-self-healing-2026-09-02/workpad.md`