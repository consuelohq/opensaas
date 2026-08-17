# daily security maintenance 2026-08-17

branch: `task/security/daily-security-maintenance-2026-08-17`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2158/daily-security-maintenance-2026-08-17
github pr: https://github.com/consuelohq/opensaas/pull/2158
started: 2026-08-17

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

- 2026-08-17 13:12:59 fs.write: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`
- 2026-08-17 13:14:31 fs.write: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`
- 2026-08-17 13:18:41 fs.write: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`
- 2026-08-17 13:24:42 fs.write: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`
- 2026-08-17 13:25:21 fs.write: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`

## workspace-owned: validation evidence

- 2026-08-17 13:22:12 `review.run`: passed — OK
- 2026-08-17 13:24:35 `verify`: passed — OK
- 2026-08-17 13:26:56 `verify`: passed — OK

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
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/security-scan.ts`
- `packages/os/scripts/test-selection.js`
- `packages/os/scripts/verify.js`

## Daily maintenance scope

- date: 2026-08-17
- source commit inspected: `ea9953c8baa36c4766aea0539afb90bb28a614b7` (`origin/main`)
- security stream tip inspected: `9571b94c1232468a8a2f1600d894aaef3fa982fb` (`origin/stream/security`)
- stream sync status: the existing temporary stream sync worktree is stale and contains an unfinished merge from old stream commit `ed54ee4b77` into old main commit `7416dc9538`, with five substantive conflicts. Because the current remote stream has since advanced, this task was safely started from current main per the maintenance exception and accepted security-stream behavior will be reconciled on this task branch before promotion.
- deterministic scan: installed `security.scan` facade is stale (`security:scan` script unavailable in installed runtime), so the current repository-equivalent `bun run --cwd packages/os security:scan` was used. All four configured scanners completed and the normalized report is `/Users/kokayi/.consuelo/node/cache/security-scans/2026-08-17T13-10-49-870Z/security-scan-report.json`.

## Acceptance criteria

- [ ] Triage new scan groups first, then material critical/high persistent groups, using applicability and reachability rather than scanner severity alone.
- [ ] Check current/open remediation work before changing source.
- [ ] Preserve or deliberately reconcile all accepted security-stream behavior that is still applicable on current main.
- [ ] Make only bounded, high-confidence remediation justified by evidence; a no-source-change decision is acceptable.
- [ ] Run focused validation plus review/verify against `origin/main` for any source change.
- [ ] Leave the daily task mergeable into `stream/security`, promote it when gates permit, and keep the stream-to-main PR as the human boundary.
- [ ] Publish the normalized/redacted scan plus this generated workpad to Daily Schedules.

## Plan

1. Parse the normalized report and rank new/material groups without exposing native secret-match content.
2. Inspect current code/lockfiles plus open/recent PRs for duplication and reachability.
3. Reconcile the four substantive accepted security-stream changes against current main, carrying forward only behavior that is not already superseded.
4. If a bounded source fix is warranted, define the regression contract, run red/characterization evidence where practical, implement, and validate.
5. Rescan, update this workpad with final evidence, push/promote the task, verify the stream review PR, and publish Daily Schedules.

## Test-first contract

behavior under test: pending candidate triage; no production edit will occur until the selected remediation/reconciliation behavior is recorded here.
existing local pattern: use package/lockfile assertions for dependency remediation and the existing focused OS integration tests for reconciled security-stream behavior.
new or changed tests: pending candidate triage.
focused red command: pending candidate triage.
expected red failure: pending candidate triage.
no-test waiver: not granted; if the selected remediation is lockfile-only and no meaningful behavioral red test exists, record the exact verification substitute before editing.

## Issues and recovery

- `stream.sync` first rejected a stale manifest `repo` argument, then exposed an existing stale temporary merge worktree with unresolved substantive conflicts. No reset, force-push, discard, or blanket conflict choice was used.
- Installed `security.scan` routing is stale relative to repository source. The repository-equivalent scanner command completed successfully through task-scoped `code.call`; this is a tooling drift issue, not a scanner failure.

- 2026-08-17 13:12:59 append: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`

## Selected remediation and test-first refinement

Selected remediation: restore the already-accepted security-stream website XML dependency pin on top of current main. This is both required stream reconciliation and today's highest-confidence bounded fix. Current main regressed to `fast-xml-parser` 5.9.3 in Bun resolution and `fast-xml-builder` 1.1.4 in npm resolution. The accepted stream fix pins parser 5.10.1; regenerating both locks also lifts the builder above its patched threshold. The other three substantive security-stream site-publication fixes are already present on current main under later `Stream/security` commits, confirmed by their behavior markers, so duplicating them would create churn.

Applicability: the website ships `@astrojs/rss`, whose runtime imports both `XMLParser` and `XMLBuilder`; its parser use is limited to strings assembled from RSS data rather than arbitrary request XML, reducing parser exploitability, while the builder is part of the generated RSS path. Dependency remediation is low-risk and removes both scanner families without changing the public RSS contract.

behavior under test: the website manifest must force `fast-xml-parser` 5.10.1, Bun resolution must be 5.10.1, and npm resolution must use parser >=5.10.1 and builder >=1.1.7.
existing local pattern: package override plus regenerated `bun.lock` and `package-lock.json`, as already accepted on `stream/security` in `bdf1c6dda3`.
new or changed tests: no permanent source test is warranted for a package-manager lock invariant; use a focused lockfile/manifest assertion before and after regeneration plus website check/build/RSS build verification.
focused red command: task-scoped Bun assertion reading `packages/consuelo-website/package.json`, `bun.lock`, and `package-lock.json` and requiring parser 5.10.1 plus builder >=1.1.7.
expected red failure: current main has no parser override, Bun resolves parser 5.9.3, and npm lock resolves builder 1.1.4.
no-test waiver: permanent regression test waived because the package manifests/lockfiles are the durable contract; focused machine assertions and website build are the verification substitutes.

- 2026-08-17 13:14:31 append: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`

- 2026-08-17 13:14:41 apply-patch: `packages/consuelo-website/package.json`

## Triage and remediation evidence

- Baseline normalized scan (`2026-08-17T13-10-49-870Z`) completed Bun audit, OSV-Scanner, Trivy, and Semgrep: 1,368 unique groups (45 critical, 545 high, 634 medium, 140 low, 4 unknown); 57 new, 1,311 persistent, 52 resolved versus the prior report.
- The 57 apparent new groups were dominated by Semgrep findings introduced by current-main drift plus five website XML dependency groups caused by starting from current main rather than the already-remediated security stream. There were no new critical groups; 39 were high and 18 medium.
- The material bounded candidate was the Consuelo website RSS dependency graph. `@astrojs/rss` imports both `XMLParser` and `XMLBuilder`. The current RSS route is prerendered; parser calls operate on strings constructed by the RSS helper rather than arbitrary request XML, so parser reachability from attacker-supplied raw XML is low. The XML builder is used in the generated RSS path, so keeping its transitive version patched is still justified.
- Current reviewed advisory evidence: GHSA-8r6m-32jq-jx6q affects `fast-xml-parser` >=5.9.3,<5.10.1 and is patched in 5.10.1; GHSA-5wm8-gmm8-39j9 / CVE-2026-44665 affects `fast-xml-builder` <=1.1.6 and is patched in 1.1.7. Primary references: https://github.com/advisories/GHSA-8r6m-32jq-jx6q and https://github.com/advisories/GHSA-5wm8-gmm8-39j9.
- Prior Daily Schedules security workpad for 2026-08-15 was inspected from artifact `artifact-73353bf61fb7ba51`. It selected the same parser remediation, recorded no open duplicate, and successfully promoted the fix into `stream/security`. Today's action therefore restores accepted stream intent on current main rather than inventing a duplicate design.
- Stream/open-work check: `stream.context` showed existing security task PRs #1214, #1213, #1210, #1209, #1182, #946, and #927; none is an XML dependency remediation. Local recent history since 2026-08-01 contains no `fast-xml` or Dependabot commit. The typed GitHub `pr.list` facade currently fails inside its `gh pr list` JSON path, so current stream context, local Git history, and the prior Daily Schedules duplicate check were used as the durable evidence instead of bypassing the facade.
- Reconciliation: accepted stream behaviors from commits `059296db2e`, `e8fedf81bc`, and `49af3777e9` are already present on current main under later security integrations (markers include `WORKSPACE_SITE_SNAPSHOT_IDS`, `isWorkspaceSessionRequired`, and `x-consuelo-site-content-hash`). Only the XML dependency change from `bdf1c6dda3` needed reapplication.
- Focused red evidence failed as expected: no manifest override, Bun did not resolve parser 5.10.1, npm lock had parser 5.4.1 and builder 1.1.4.
- Implementation: added `overrides.fast-xml-parser = 5.10.1` and regenerated both committed locks with Bun and npm package managers. Final resolution assertion: override 5.10.1; Bun parser 5.10.1; npm parser 5.10.1; npm builder 1.3.1.
- Focused validation: `bun install --frozen-lockfile --cwd packages/consuelo-website` passed. Website `build` runs footer generation, `astro check`, and `astro build`; it completed with 0 errors, 0 warnings, existing hints only, built 24 pages, and generated `/rss.xml` successfully.
- Final deterministic rescan (`2026-08-17T13-15-53-879Z`) completed all four scanners: 1,363 unique groups (45 critical, 540 high, 634 medium, 140 low, 4 unknown), 0 new, 1,363 persistent, 5 resolved versus the pre-fix scan. The five resolved groups are the website `fast-xml-parser` repeated-DOCTYPE advisory across Bun/OSV/Trivy and the `fast-xml-builder` attribute-injection advisory across OSV/Trivy. Remaining XML-related findings are in root/legacy `yarn.lock` locations and remain separate reachability/ownership candidates rather than evidence that the website fix failed.

- 2026-08-17 13:18:41 append: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`

## Review and verify

- The strict `review.run` transport disconnected while the review continued server-side. Trace `trc_a3af4b7fb0e3` later confirmed the run completed successfully: 0 task-owned issues, 0 blocking issues, and 3/3 selected review suites passed. Its stderr contained unrelated pre-existing ESLint/TypeScript crashes elsewhere in the monorepo; the review classified those as pre-existing and returned success.
- Full `verify` passed and is publish-valid (`trc_83a58c3b929a`). It recognized the three changed website dependency files, found 0 task-owned or related-pre-existing issues, found no DB/migration risks, and wrote `.task/security/daily-security-maintenance-2026-08-17/verify.json`.

- 2026-08-17 13:24:42 append: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`

## Lifecycle recovery

- `task.push` failed before committing because the installed GitHub helper could not parse its `gh auth` response and reported no GitHub token in the task environment (`trc_a81546e7b164`). The task PR already exists and GitHub authentication is otherwise available through the repository remote. Per workspace recovery policy, use a narrowly scoped task-worktree Git commit/push fallback for this lifecycle step only; no reset, force-push, branch deletion, or history rewrite is permitted.

- 2026-08-17 13:25:21 append: `.task/security/daily-security-maintenance-2026-08-17/workpad.md`
