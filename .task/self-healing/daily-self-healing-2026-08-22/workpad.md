# daily-self-healing-2026-08-22

branch: `task/self-healing/daily-self-healing-2026-08-22`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2173/daily-self-healing-2026-08-22
github pr: https://github.com/consuelohq/opensaas/pull/2173
started: 2026-08-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-23 01:32:46 fs.write: `.task/self-healing/daily-self-healing-2026-08-22/workpad.md`
- 2026-08-23 01:33:43 fs.write: `.task/self-healing/daily-self-healing-2026-08-22/workpad.md`
- 2026-08-23 01:34:19 fs.write: `.task/self-healing/daily-self-healing-2026-08-22/workpad.md`

## workspace-owned: validation evidence

- 2026-08-23 01:34:02 `review.run`: passed — OK
- 2026-08-23 01:34:09 `verify`: passed — OK
- 2026-08-23 01:34:22 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## Self-healing investigation — 2026-08-22

- Canonical installed `monitor.errors` facade failed with `Script not found "monitor:errors"`; current self-healing source contains `packages/os/scripts/monitor-errors.ts`, so this is installed-runtime/source drift and not a new source defect.
- Current-source 24h monitor report: 17 groups total; 5 actionable defect candidates; 3 caller-input; 6 transient; 2 unknown; 1 expected-policy.
- Repeated `github` and `stream.sync --repo` failures match fixes already present on `stream/self-healing` but not installed locally. `dailySchedules.publish` is also missing its installed script while current source contains the publication path. Do not duplicate those fixes.
- Four repeated `fs.search/COMMAND_FAILED` rows all came from caller-selected nonexistent paths (`rg: ... No such file or directory`) during the prior self-healing task. The current monitor classifies them as actionable defect candidates even though the `fs.search` contract is a read-only targeted search and ripgrep is correctly rejecting nonexistent targets.

## Test-first contract

behavior under test: recurring `fs.search` failures caused solely by nonexistent caller-selected paths are classified as `caller-input` and non-actionable, while other recurring `fs.search/COMMAND_FAILED` failures remain eligible defect candidates.
existing local pattern: `packages/os/tests/monitor-errors.test.ts` already proves caller-caused `fs.apply_patch` stale anchors and `fs.list` nonexistent search paths stay out of the defect bucket.
new or changed tests: extend that focused monitor classifier contract with `fs.search` stderr matching ripgrep's `No such file or directory` target error and a nearby negative-control case.
focused red command: `bun test packages/os/tests/monitor-errors.test.ts`
expected red failure: new `fs.search` missing-path assertion is currently classified `defect-candidate`/actionable because `monitor-errors.ts` has caller-input branches only for `fs.apply_patch` and `fs.list`.
no-test waiver: not applicable.

- 2026-08-23 01:32:46 append: `.task/self-healing/daily-self-healing-2026-08-22/workpad.md`

- 2026-08-23 01:32:52 apply-patch: `packages/os/tests/monitor-errors.test.ts`
- 2026-08-23 01:33:03 apply-patch: `packages/os/scripts/lib/monitor-errors.ts`
## Evidence and decision

- Task source: `stream/self-healing` at `5bf585c9212fe6a93f5bb12716f01779f9a5519b`; task bootstrap `f55ced7445`.
- Current remote `main`: `b0e7016159103e3c3850dac6937f7b5333a72450`; it is an ancestor of `stream/self-healing` (`0` main-only / `26` self-healing-only commits), so the persistent stream is current with accepted main work.
- Current `stream/os`: `42b152196fd8afabb76169a5d5fb31873f4408eb` (`3` main-only / `172` stream/os-only). The relevant `monitor-errors.ts` implementation is not present there, so no duplicate fs.search classifier fix exists in authoritative OS development.
- Installed runtime identity: Consuelo OS `0.1.67`, bundle `sha256:424824f9f75c32c657fc754f7ce975ab1a103c3159ec12351cf7b6ddf6b5a263`; latest recorded lifecycle update succeeded 2026-08-17. This explains the repeated installed/source drift for fixes merged after that date.
- Installed `monitor.errors` failed before source fallback with `Script not found "monitor:errors"`. Installed `github` still recurses through the wrapper; installed `stream.sync --repo` still rejects `--repo`; installed `dailySchedules.publish` reports `Script not found "daily-schedules"`. All of those source corrections/publication paths already exist on `stream/self-healing`, so this task does not duplicate them.
- Hosted normalized install/onboarding telemetry was not exposed by the current typed tool surface; `tools.search` returned no control-plane read model. No hosted-user impact is inferred.

Selected root cause:

1. `monitor.errors` misclassifies caller-selected nonexistent `fs.search` targets as actionable defect candidates. Four independent failures in the current 24h window were all ripgrep `No such file or directory` target errors from the previous task session. `fs.search` is read-only and correctly rejects nonexistent explicit targets; the defect is the monitor attribution, not the filesystem boundary.

TDD evidence:

- RED: `bun test packages/os/tests/monitor-errors.test.ts` -> 8 pass / 1 fail. New fs.search missing-path assertion was reported `defect-candidate`, `actionable: true`.
- GREEN: `bun test packages/os/tests/monitor-errors.test.ts packages/os/tests/monitor-errors-report.test.ts` -> 11 pass / 0 fail.
- Negative control proves a different recurring fs.search transport failure remains `defect-candidate`/actionable.
- Re-running the normalized report after the fix changed the summary from 5 actionable / 3 caller-input to 4 actionable / 4 caller-input without suppressing any trace group.

Remaining current actionable groups after the fix are all already-fixed installed/source drift (`github`, `stream.sync --repo`, `monitor.errors`, `dailySchedules.publish`) rather than new source defects.

- 2026-08-23 01:33:43 append: `.task/self-healing/daily-self-healing-2026-08-22/workpad.md`

## Validation

- `review.run` strict against `origin/stream/self-healing`: 0 blocking issues, 0 pre-existing issues, 0 documentation opportunities across the two production/test files.
- Full `verify` against `origin/stream/self-healing`: passed and publish-valid; exclusive `os-self-healing-monitor` rule selected exactly the focused monitor suite.
- Selected verification suite: `bun test packages/os/tests/monitor-errors.test.ts packages/os/tests/monitor-errors-report.test.ts` -> 11/11 passed.
- DB guard: passed with 0 risks and 0 findings.
- No deploy, release promotion, lifecycle update/restart, IAM change, credential rotation, or stream-to-main merge performed.

- 2026-08-23 01:34:19 append: `.task/self-healing/daily-self-healing-2026-08-22/workpad.md`
