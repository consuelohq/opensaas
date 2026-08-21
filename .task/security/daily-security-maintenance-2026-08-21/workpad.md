# daily security maintenance 2026-08-21

branch: `task/security/daily-security-maintenance-2026-08-21`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2170/daily-security-maintenance-2026-08-21
github pr: https://github.com/consuelohq/opensaas/pull/2170
started: 2026-08-21

## acceptance criteria

- [x] Inspect synchronized `stream/security`, current `main`, open/recent security PRs, and prior daily security records for duplication or drift.
- [x] Run the canonical normalized security scan with Bun audit, OSV-Scanner, Trivy, and Semgrep.
- [x] Triage new and high-impact persistent findings for actual applicability/reachability before editing.
- [x] Make only evidence-backed bounded remediation, or explicitly record a no-source-change decision.
- [x] Run risk-matched validation, strict review, and publish-valid verify before promotion.
- [ ] Promote the daily task into `stream/security` only; preserve the human `stream/security -> main` boundary.
- [ ] Publish the normalized security report and this generated workpad into Daily Schedules.

## plan

1. Run `security.scan` first on the synchronized task state and capture normalized deltas/evidence paths.
2. Inspect recent/open PRs, prior security maintenance, and material findings for duplication, shipping scope, and reachability.
3. If remediation is justified, record a concrete test-first contract, reproduce red where practical, implement the smallest correct fix, and rerun green plus broader validation.
4. If no remediation is justified, record the applicability analysis and no-change decision without manufacturing source churn.
5. Push, promote into `stream/security`, verify the stream review PR to `main`, publish Daily Schedules, and stop before any main merge/deploy/release action.

## Test-first contract

behavior under test: the Consuelo website dependency graph must not resolve the vulnerable `protobufjs` 7.5.4 line; both committed Bun and npm lockfiles must resolve the compatible patched 7.x release 7.6.5
existing local pattern: the website already uses a root package `overrides` entry to pin a vulnerable transitive XML dependency while preserving the owning package API
new or changed tests: no permanent test file; use an exact lock-resolution assertion before and after the manifest/lock refresh, then run the website build plus final security scan
focused red command: task-scoped Bun assertion that `packages/consuelo-website/bun.lock` and `package-lock.json` resolve `protobufjs` 7.6.5 and do not resolve 7.5.4
expected red failure: both committed locks currently resolve `protobufjs` 7.5.4 through `@opentelemetry/otlp-transformer@0.208.0`
no-test waiver: a permanent runtime regression test is not appropriate for a generated lockfile resolution; the red/green lock assertion, frozen installs, website build, and normalized rescan are the executable replacement evidence

## current status

- `stream/security` was synchronized with current `main` before task start with no conflicts.
- All four scanners completed through the current repository scanner implementation after the installed `security.scan` wrapper failed with `Script not found "security:scan"`.
- The scan contains 1,345 unique groups. Its raw 52-new / 52-resolved delta is entirely Semgrep task-worktree path churn: all 52 pairs are identical when path is ignored, leaving 0 meaningful new and 0 meaningful resolved groups.
- Persistent critical triage selected the website's transitive `protobufjs` 7.5.4 as the highest-confidence bounded remediation. The package is pulled by `@opentelemetry/otlp-transformer@0.208.0` via `protobufjs: ^7.3.0`; website source does not directly load protobuf schemas/descriptors, so the critical RCE precondition is not established, but a compatible 7.x patch removes a vulnerable shipping dependency at low blast radius.
- Current upstream evidence: GHSA-xq3m-2v4x-88gg fixes the critical schema-controlled code-execution issue in 7.5.5; later 7.x advisories require 7.6.3 and 7.6.5, making 7.6.5 the current patched 7.x floor/latest-7 line as of this run.
- Focused red reproduced the lock resolution: Bun had `protobufjs@7.5.4`, npm had `7.5.4`, and neither lock satisfied the 7.6.5 assertion.
- Added a website root override for `protobufjs: 7.6.5` and regenerated both committed lockfiles. The transitive package remains within `@opentelemetry/otlp-transformer`'s compatible `^7.3.0` range.
- Focused green passed: Bun lock resolves 7.6.5 with no 7.5.4 entry, npm lock resolves 7.6.5, and the manifest override is 7.6.5.
- `bun install --frozen-lockfile` reports no lock drift. The full website build passed with 0 errors and generated `/rss.xml` successfully.
- The final four-scanner rescan is complete at `/Users/kokayi/.consuelo/node/cache/security-scans/2026-08-21T13-40-30-184Z/security-scan-report.json`: 1,332 unique groups, 0 new, 1,332 persistent, 13 resolved. All 13 resolved groups are the website protobuf dependency cluster (1 critical, 5 high, 7 medium), including the critical RCE advisory and the July 7.x parser DoS advisory.
- Source state inspected: synchronized `origin/stream/security` is `ab90ac35638a619f32f16a1df50ab79d5a4145cd`; `origin/main` is `b0e7016159103e3c3850dac6937f7b5333a72450` and is the merge base of the stream, so the stream preserves current main plus accepted security history.
- Strict review reported 0 task issues / 0 blocking issues. Full `verify` inspected the three production files, passed, and issued `publishValid: true` at `.task/security/daily-security-maintenance-2026-08-21/verify.json`.

## files changed

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/bun.lock`
- `packages/consuelo-website/package-lock.json`
- generated task metadata/workpad under `.task/security/daily-security-maintenance-2026-08-21/`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-21 13:45:13 `review.run`: passed — OK
- 2026-08-21 13:45:13 `review.run`: passed — OK
- 2026-08-21 13:49:36 `verify`: passed — OK

## key decisions

- Treat the raw 52-new/52-resolved pre-fix delta as path-key churn, not real security movement, because every new/resolved Semgrep group matched exactly when the daily task-worktree path was ignored.
- Do not claim the protobuf RCE was reachable: the advisory requires attacker-controlled schema/descriptor loading, and website source has no direct protobuf schema/descriptor handling. Apply the compatible dependency patch anyway because it is a bounded root-cause removal of a vulnerable shipping dependency and clears a broader 13-advisory cluster.
- Pin 7.6.5 rather than only the first critical fix 7.5.5 because GitHub's reviewed July advisory marks 7.6.4 and below affected by `.proto` parser DoS; 7.6.5 is the current `latest-7` release and remains inside the transitive `^7.3.0` contract.

## notes for ko

- No deployment, release, credential rotation, IAM mutation, destructive production testing, or OS lifecycle operation is part of this run.

## improvements noticed

- none yet

## issues and recovery

- Installed `security.scan` failed with `Script not found "security:scan"`; the task worktree contains the current canonical implementation at `packages/os/scripts/security-scan.ts`, so the run used that repository-equivalent scanner directly and preserved its normalized/redacted report.
- Typed GitHub PR listing and the local `gh pr list` fallback both fail with `JSON Parse error: Unexpected identifier "pr"`. Duplication checks therefore used `stream.context`, recent branch/commit inspection, and public GitHub search; no current protobuf remediation was found in the recent accepted security work or the listed open security tasks.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/os/scripts/security-scan.ts`

- 2026-08-21 13:50:08 apply-patch: `.task/security/daily-security-maintenance-2026-08-21/workpad.md`